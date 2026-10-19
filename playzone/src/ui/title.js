import { h } from './dom.js';

// Écran titre : solo (sauvegarde locale) ou en ligne (si un serveur PLAYZONE répond à cette adresse).
// Interroge le serveur. Le délai d'attente n'est armé qu'au moment où l'on attend la réponse
// (wait()), pour ne pas expirer pendant la construction du monde qui occupe le navigateur.
export function probeServer() {
  const req = fetch('api/status', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.game === 'playzone' ? j : null))
    .catch(() => null);
  // le délai démarre après deux images affichées (la 1re image peut être longue : compilation des shaders)
  const afterFrames = (ms) => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => res(null), ms))));
  return { wait: (ms = 5000) => Promise.race([req, afterFrames(ms)]) };
}

export function showTitle(ui, { soloSave, serverInfo, onSolo, onOnline, onNewSolo, quality, onQuality }) {
  return new Promise((resolve) => {
    const el = h('div.title-screen');
    const done = (fn) => () => { el.remove(); resolve(); fn(); };
    const qualityRow = h('div.opt-row', { style: { justifyContent: 'center' } },
      ['low', 'medium', 'high'].map((q) => h(`button.opt${q === quality ? '.sel' : ''}`, {
        onclick: (e) => { qualityRow.querySelectorAll('.opt').forEach((b) => b.classList.remove('sel')); e.target.classList.add('sel'); onQuality(q); },
      }, { low: 'Graphismes : léger', medium: 'Moyen', high: 'Élevé' }[q])));
    const online = serverInfo
      ? h('button.btn.teal.big.block', { onclick: done(onOnline) }, `🌐 Jouer en ligne · ${serverInfo.players} joueur${serverInfo.players > 1 ? 's' : ''} connecté${serverInfo.players > 1 ? 's' : ''}`)
      : h('button.btn.ghost.big.block', { disabled: true, title: 'Aucun serveur détecté' }, '🌐 En ligne : serveur non détecté');
    el.append(h('div.title-card',
      h('div.logo', 'PLAY', h('span', 'ZONE')),
      h('p.tagline', 'Le monde ouvert où tout peut arriver. Surtout des poulets.'),
      h('div.modes',
        soloSave
          ? [h('button.btn.big.block', { onclick: done(onSolo) }, `▶ Continuer en solo · ${soloSave}`), h('button.btn.ghost.block', { onclick: done(onNewSolo) }, 'Nouveau personnage (solo)')]
          : h('button.btn.big.block', { onclick: done(onSolo) }, '▶ Jouer en solo'),
        online),
      qualityRow,
      h('p.note', serverInfo
        ? 'En ligne : ta progression est sauvegardée sur le serveur et vérifiée par lui (argent, objets, récompenses).'
        : 'Solo : tout fonctionne, la progression est sauvegardée sur cet appareil. Le mode en ligne nécessite le serveur PLAYZONE (npm start).'),
      h('p.note', 'Clavier : ZQSD / WASD ou flèches · Maj : courir · Espace : sauter · E : interagir · P : téléphone · Entrée : chat · Glisser la souris : caméra')));
    ui.root.append(el);
  });
}
