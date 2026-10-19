// Tests du serveur multijoueur : comptes, autorité côté serveur, anti-triche, chat, groupes, visibilité.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../../server/index.js';
import { PROTOCOL_VERSION } from '../../shared/protocol.js';
import { BUILDING_BY_ID } from '../../shared/world-layout.js';

const srv = await startServer({ port: 0, dbFile: ':memory:', quiet: true, accountsPerIp: 100 });
after(() => srv.close());

function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
  const msgs = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    msgs.push(m);
    for (const w of [...waiters]) if (w.f(m)) { waiters.splice(waiters.indexOf(w), 1); w.r(m); }
  });
  const c = {
    ws, msgs,
    send: (o) => ws.send(JSON.stringify(o)),
    wait: (f, ms = 3000) => new Promise((r, j) => { const m = msgs.find(f); if (m) return r(m); waiters.push({ f, r }); setTimeout(() => j(new Error(`timeout en attendant : ${f.toString().slice(0, 90)} | reçus : ${msgs.filter((x) => x.t !== 'snap').map((x) => x.t).join(',')}`)), ms); }),
    open: () => new Promise((r) => ws.on('open', r)),
    nextId: 1,
    async req(type, payload) { const id = c.nextId++; c.send({ t: 'req', id, type, payload }); return c.wait((m) => m.t === 'res' && m.id === id); },
    state(x, z, extra = {}) { c.send({ t: 'state', s: { x, y: 0, z, ry: 0, s: 0, p: 'idle', d: 0, g: 1, w: 0, ...extra }, zone: extra.zone || 'world' }); },
  };
  return c;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPlayer(name) {
  const c = client();
  await c.open();
  c.send({ t: 'hello', v: PROTOCOL_VERSION });
  await c.wait((m) => m.t === 'welcome' && m.needProfile);
  c.send({ t: 'create', name, appearance: {} });
  c.token = (await c.wait((m) => m.t === 'created')).token;
  c.welcome = await c.wait((m) => m.t === 'welcome' && m.profile);
  return c;
}

test('création de compte, reconnexion avec le jeton, nom filtré', async () => {
  const a = await newPlayer('Alice');
  assert.equal(a.welcome.profile.coins, 200);
  const bad = client(); await bad.open(); bad.send({ t: 'hello', v: PROTOCOL_VERSION });
  await bad.wait((m) => m.t === 'welcome');
  bad.send({ t: 'create', name: 'connard', appearance: {} });
  const err = await bad.wait((m) => m.t === 'create_error');
  assert.match(err.error, /pas autorisé/);
  a.ws.close(); bad.ws.close();
  await sleep(100);
  const again = client(); await again.open();
  again.send({ t: 'hello', v: PROTOCOL_VERSION, token: a.token });
  const w = await again.wait((m) => m.t === 'welcome' && m.profile);
  assert.equal(w.profile.name, 'Alice');
  again.ws.close();
});

test('les récompenses passent par le serveur : achat refusé loin de la boutique, accepté devant', async () => {
  const c = await newPlayer('Bruno');
  const far = await c.req('shop.buy', { itemId: 'casquette' });
  assert.equal(far.ok, false);
  const door = BUILDING_BY_ID.fringues.door;
  // on marche jusqu'à la boutique à une vitesse plausible (le serveur vérifie la vitesse)
  let x = 0, z = 12;
  while (Math.hypot(door.x - x, door.z - z) > 0.5) {
    const d = Math.hypot(door.x - x, door.z - z), step = Math.min(d, 0.8);
    x += ((door.x - x) / d) * step; z += ((door.z - z) / d) * step;
    c.state(x, z); await sleep(100);
  }
  await sleep(150);
  const ok = await c.req('shop.buy', { itemId: 'casquette' });
  assert.equal(ok.ok, true, ok.error);
  const prof = await c.wait((m) => m.t === 'profile' && m.profile.inventory.casquette === 1);
  assert.equal(prof.profile.coins, 140);
  c.ws.close();
});

test('anti-triche : une téléportation est refusée et corrigée', async () => {
  const c = await newPlayer('Chloe');
  c.state(0, 12); await sleep(120);
  c.state(80, 80); // 100 m en 0,1 s
  const cor = await c.wait((m) => m.t === 'correct');
  assert.ok(Math.hypot(cor.x - 0, cor.z - 12) < 2, 'renvoyé à la dernière position valide');
  c.ws.close();
});

test('chat : filtré, liens interdits, anti-spam, portée limitée', async () => {
  const a = await newPlayer('Dora');
  const b = await newPlayer('Emile');
  a.state(0, 10); b.state(1, 10); await sleep(150);
  a.send({ t: 'chat', text: 'salut espèce de connard' });
  const got = await b.wait((m) => m.t === 'chat' && m.name === 'Dora');
  assert.equal(got.text, 'salut espèce de *******');
  a.send({ t: 'chat', text: 'va sur www.arnaque.com' });
  const sys = await a.wait((m) => m.t === 'sys' && /liens/.test(m.text));
  assert.ok(sys);
  for (let i = 0; i < 7; i++) a.send({ t: 'chat', text: `spam ${i}` });
  await a.wait((m) => m.t === 'sys' && /trop de messages/.test(m.text));
  a.ws.close(); b.ws.close();
});

test('multijoueur : deux joueurs se voient bouger, groupe et invitation', async () => {
  const a = await newPlayer('Fanny');
  const b = await newPlayer('Gaspard');
  a.state(0, 10); b.state(3, 10);
  await sleep(250);
  a.state(0.8, 10);
  const snap = await b.wait((m) => m.t === 'snap' && m.l.some((e) => e[0] === a.welcome.id && e[1] > 0.5));
  assert.ok(snap);
  a.send({ t: 'party', action: 'invite', target: b.welcome.id });
  await b.wait((m) => m.t === 'invite' && m.kind === 'party');
  b.send({ t: 'party', action: 'accept', target: a.welcome.id });
  const party = await a.wait((m) => m.t === 'party' && m.party?.members.length === 2);
  assert.equal(party.party.members.length, 2);
  b.send({ t: 'chat', text: 'coucou le groupe', channel: 'party' });
  const pc = await a.wait((m) => m.t === 'chat' && m.channel === 'party');
  assert.equal(pc.text, 'coucou le groupe');
  a.ws.close(); b.ws.close();
});

test('limite de création de comptes par adresse IP', async () => {
  const s2 = await startServer({ port: 0, dbFile: ':memory:', quiet: true, accountsPerIp: 2 });
  const errs = [];
  for (let i = 0; i < 3; i++) {
    const ws = new WebSocket(`ws://127.0.0.1:${s2.port}/ws`);
    const r = await new Promise((res) => {
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION })));
      ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome' && m.needProfile) ws.send(JSON.stringify({ t: 'create', name: `Joueur${i}x`, appearance: {} })); if (m.t === 'created' || m.t === 'create_error') res(m); });
    });
    errs.push(r.t);
    ws.close();
  }
  await s2.close();
  assert.deepEqual(errs, ['created', 'created', 'create_error']);
});

test('statut public', async () => {
  const r = await fetch(`http://127.0.0.1:${srv.port}/api/status`).then((x) => x.json());
  assert.equal(r.game, 'playzone');
  const forbidden = await fetch(`http://127.0.0.1:${srv.port}/server/db.js`);
  assert.equal(forbidden.status, 404, 'le code serveur n\'est pas servi');
});
