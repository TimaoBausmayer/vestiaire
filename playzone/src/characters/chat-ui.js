import { npcReply } from '../../shared/chat.js';
import { windAtPos } from '../../shared/wingfoil.js';

// Discussion libre dans une boîte de dialogue de PNJ : un champ de saisie, la réponse s'affiche à la
// place du texte (avec ce qu'on vient de dire). La mémoire (prénom, humeur) reste attachée au PNJ.
const MEMORY = new Map();
export function chatMode(g, m, who, back) {
  const key = who.id || who.name;
  if (!MEMORY.has(key)) MEMORY.set(key, {});
  const mem = MEMORY.get(key);
  const ctx = () => ({ hour: g.world?.dayNight?.hour ?? 12, kts: windAtPos(Date.now(), g.player.pos.x, g.player.pos.z).kts, pos: { x: g.player.pos.x, z: g.player.pos.z }, player: g.profile?.name });
  const choices = [
    ...(back ? [{ label: '↩︎ Retour', ghost: true, action: (x) => back(x) }] : []),
    { label: 'Au revoir', ghost: true, action: (x) => x.close() },
  ];
  const input = {
    placeholder: `Écris à ${who.name}... (où est la banque ? une blague ? ça va ?)`,
    submit: (text, x) => {
      const r = npcReply(text, who, ctx(), mem);
      g.sfx?.('click');
      if (who.root) g.labels?.bubble?.(who.root, r.length > 70 ? `${r.slice(0, 68)}…` : r, 3500);
      x.show(`« ${text} »\n${r}`, choices, input);
      g.onNpcChat?.(who, text, r);
    },
  };
  m.show(`${who.name} t'écoute. Écris ce que tu veux !`, choices, input);
}
