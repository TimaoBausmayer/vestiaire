import { h } from '../ui/dom.js';
import { LIMITS } from '../../shared/protocol.js';
import { POI } from '../../shared/world-layout.js';

// SOCIAL (en ligne) : chat (proche / groupe), masquer un joueur, signaler, groupes, invitations
// chez soi, messages du téléphone, et réactions du serveur (correction de position, expulsion).
const MUTE_KEY = 'playzone.muted';

export class Social {
  constructor(game) {
    this.game = game;
    this.net = game.net;
    this.party = null;
    this.inbox = [];
    try { this.muted = new Set(JSON.parse(localStorage.getItem(MUTE_KEY) || '[]')); } catch { this.muted = new Set(); }
    this.channel = 'local';
    this.buildChat();
    const net = this.net;
    net.on('chat', (m) => { if (!this.isMuted(m.from)) this.addLine(m.name, m.text, m.channel === 'party' ? 'party' : '', m.from === game.profile.id); });
    net.on('sys', (m) => this.addLine(null, m.text, 'sys'));
    net.on('invite', (m) => this.onInvite(m));
    net.on('party', (m) => { this.party = m.party; this.addLine(null, m.party ? `Groupe : ${m.party.members.map((x) => x.name).join(', ')}` : 'Tu n\'es plus dans un groupe.', 'sys'); this.renderChannel(); });
    net.on('home_data', (m) => {
      if (m.enter) game.home.enter(m.host, m.home, m.name);
      else if (game.home.inside?.ownerId === m.host) game.home.load(m.home);
    });
    net.on('visit_hint', () => { game.waypoint = { x: POI.homeDoor.x, z: POI.homeDoor.z, label: 'Résidence Les Mouettes' }; game.hud.compassTarget = game.waypoint; });
    net.on('correct', (m) => {
      const p = game.player;
      if (m.zone === 'world' && p.zone !== 'world' && game.home.inside) { game.home.exit(); return; }
      if (game.vehicles?.driving) game.vehicles.exit();
      p.teleport(m.x, m.z, p.yaw, m.y);
    });
    net.on('kick', (reason) => this.disconnected(`Déconnecté : ${reason}`));
    net.on('lost', () => this.disconnected('Connexion au serveur perdue.'));
    net.on('disconnected', () => game.ui.toast('Connexion perdue... reconnexion en cours.', 'bad', 4000));
    net.on('reconnected', () => game.ui.toast('Reconnecté !', 'good'));
    this.addLine(null, `Connecté à ${net.worldInfo?.name || 'PLAYZONE'}. Entrée pour discuter (chat proche, ${LIMITS.chatRadius} m).`, 'sys');
  }

  isMuted(id) { return this.muted.has(id); }
  setMuted(id, on) {
    if (on) this.muted.add(id); else this.muted.delete(id);
    try { localStorage.setItem(MUTE_KEY, JSON.stringify([...this.muted])); } catch { /* rien */ }
  }

  // ------------------------------------------------------------------ chat
  buildChat() {
    const g = this.game;
    this.log = h('div.chat-log');
    this.input = h('input.text-input', { maxlength: LIMITS.chatLen, placeholder: 'Message (Entrée pour envoyer)', 'aria-label': 'Message de chat' });
    this.chanBtn = h('button.btn.small.ghost', { onclick: () => { this.channel = this.channel === 'local' ? 'party' : 'local'; if (!this.party) this.channel = 'local'; this.renderChannel(); } });
    this.el = h('div.chat', this.log, h('div.chat-row', this.chanBtn, this.input, h('button.btn.small', { onclick: () => this.sendInput() }, '➤')));
    g.ui.root.append(this.el);
    this.renderChannel();
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.sendInput(); this.input.blur(); }
      if (e.key === 'Escape') this.input.blur();
    });
    g.chat = { focus: () => this.input.focus() };
  }

  renderChannel() { this.chanBtn.textContent = this.channel === 'party' ? '👥 Groupe' : '💬 Proche'; }

  sendInput() {
    const t = this.input.value.trim();
    if (!t) return;
    this.net.chat(t, this.channel);
    this.input.value = '';
    this.game.labels.bubble(this.game.avatar.root, t, 4500, 'player');
    this.game.npcs?.hear(t);   // les habitants autour entendent et réagissent
  }

  addLine(name, text, cls = '', mine = false) {
    const line = h(`div.m${cls ? `.${cls}` : ''}`, name ? h('b', `${name}${mine ? ' (moi)' : ''} : `) : null, text);
    this.log.append(line);
    while (this.log.children.length > 60) this.log.firstChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }

  // ------------------------------------------------------------------ invitations
  onInvite(m) {
    const g = this.game;
    const accept = () => {
      if (m.kind === 'party') this.net.send({ t: 'party', action: 'accept', target: m.from });
      else this.net.send({ t: 'visit', host: m.from });
      this.inbox = this.inbox.filter((x) => x !== item);
    };
    const item = {
      title: m.kind === 'party' ? `👥 ${m.name} t'invite dans son groupe` : `🏠 ${m.name} t'invite chez lui/elle`,
      text: m.kind === 'home' ? 'Rends-toi à la porte de la Résidence Les Mouettes puis accepte.' : 'Vous pourrez discuter dans le canal de groupe.',
      actions: [{ label: 'Accepter', run: accept }],
    };
    this.inbox.push(item);
    g.phone?.badge('messages');
    g.sfx('pop');
    const t = g.ui.toast(item.title, 'event', 9000);
    t.style.pointerEvents = 'auto';
    t.append(h('button.btn.small', { onclick: () => { accept(); t.remove(); } }, 'Accepter'));
  }

  // ------------------------------------------------------------------ fiche d'un joueur
  openPlayer(id) {
    const g = this.game;
    const r = g.remotes.get(id);
    if (!r) return;
    const m = g.ui.modal({
      title: `👤 ${r.name}`, sub: `#${r.info.tag}`, width: 'min(440px, 96vw)',
      build: (b) => {
        b.append(h('div.list',
          h('button.btn.block', { onclick: () => { this.net.send({ t: 'party', action: 'invite', target: id }); m.close(); } }, '👥 Inviter dans mon groupe'),
          h('button.btn.block.teal', { onclick: () => { this.net.send({ t: 'invite', kind: 'home', target: id }); m.close(); } }, '🏠 Inviter chez moi'),
          h('button.btn.block.ghost', { onclick: () => { this.setMuted(id, !this.isMuted(id)); m.refresh(); } }, this.isMuted(id) ? '🔊 Ne plus masquer ses messages' : '🔇 Masquer ses messages'),
          h('button.btn.block.coral', { onclick: () => this.report(id, m) }, '🚩 Signaler un comportement')));
      },
    });
  }

  report(id, modal) {
    const g = this.game;
    const reasons = ['Langage insultant', 'Harcèlement', 'Triche', 'Spam', 'Autre'];
    modal.close();
    const m = g.ui.modal({
      title: '🚩 Signaler', sub: 'Les derniers messages de ce joueur sont joints au signalement.', width: 'min(440px, 96vw)',
      build: (b) => b.append(h('div.list', reasons.map((r) => h('button.btn.block.ghost', { onclick: () => { this.net.send({ t: 'report', target: id, reason: r }); this.setMuted(id, true); m.close(); } }, r)))),
    });
  }

  // Liste des joueurs (téléphone)
  renderPlayers(b, refresh) {
    const list = this.game.remotes.all();
    if (this.party) {
      b.append(h('h4', { style: { margin: '0 0 6px' } }, 'Mon groupe'), h('div.list', this.party.members.map((x) => h('div.list-item', h('div.grow', h('div.t', x.name), h('div.d', x.id === this.party.leader ? 'Chef du groupe' : 'Membre'))))),
        h('button.btn.small.ghost', { style: { margin: '8px 0 14px' }, onclick: () => { this.net.send({ t: 'party', action: 'leave' }); setTimeout(refresh, 300); } }, 'Quitter le groupe'));
    }
    b.append(h('h4', { style: { margin: '0 0 6px' } }, `Joueurs proches (${list.length})`));
    if (!list.length) b.append(h('p.muted', 'Personne à proximité pour l\'instant.'));
    b.append(h('div.list', list.map((r) => h('div.list-item', h('div.grow', h('div.t', `${r.name} #${r.info.tag}`), h('div.d', r.info.duty ? `En service` : 'Se promène')),
      h('button.btn.small', { onclick: () => { this.game.phone.close(); this.openPlayer(r.id); } }, 'Voir')))));
  }

  disconnected(text) {
    const g = this.game;
    g.ui.modal({
      title: '📴 Déconnexion', sub: text, width: 'min(420px, 94vw)', blocking: true,
      build: (b) => b.append(h('p', 'Ta progression est sauvegardée sur le serveur.')),
      foot: (f) => f.append(h('button.btn', { onclick: () => location.reload() }, 'Recharger')),
    });
  }
}

