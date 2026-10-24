import { h } from '../ui/dom.js';
import { openShop, openWardrobe, openBasket } from '../ui/shop.js';
import { STAFF_LINES } from './templates.js';
import { chatMode } from '../characters/chat-ui.js';
import { ROLE_NAME as ROLE_LABEL } from './interiors.js';
import { quizOfDay } from '../../shared/activities.js';
import { VEHICLES } from '../../shared/content/vehicles.js';
import { dealerPanel, usedCarsPanel, rentalPanel, immoPanel, secondHandPanel, isSecondHand, scrapPanel } from '../property/panels.js';
import { repairPanel } from '../vehicles/vehicles.js';
import { HOUSING_BY_ID } from '../../shared/property.js';
import { cashPanel } from '../property/bank.js';
import { jobPanel, schoolPanel, poleEmploiPanel } from '../career/career.js';
import { createCompanyPanel } from '../career/business.js';
import { gymPassPanel, hairPanel, hospitalCarePanel } from '../life/body.js';
import { policeDesk, prisonGuard, tryEscape } from '../police/panels.js';
import { cookPanel, shower, sleep, showerFx } from '../life/home-life.js';
import { slotsPanel, roulettePanel, blackjackPanel, pokerPanel, casinoDesk } from '../leisure/casino.js';
import { rangePanel } from '../leisure/range.js';
import { kartingDesk } from '../sports/karting.js';
import { adminKiosk } from '../ui/admin.js';

// ACTIONS DES POINTS D'INTÉRIEUR : acheter, s'asseoir, dormir, parler, regarder la télé, jouer...
// Tout ce qui touche à l'argent, aux besoins ou aux récompenses passe par l'autorité (activity.do).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const TV = ['"Les Feux de l\'Amour (des poulets)", épisode 4 012.', 'Un documentaire sur les pigeons de la Grande Place. Captivant.', 'La météo : il fera beau, sauf s\'il pleut.', 'Un jeu télévisé où l\'on gagne une baguette.', 'Les infos : "Un caddie aperçu à 80 km/h sur le boulevard".'];
const FRIDGE = ['Un yaourt de 2019, une chaussette et un citron. L\'habitant : "Pas touche !"', 'Trois bouteilles de ketchup vides et une lasagne qui vous regarde.', 'Il fait froid là-dedans. Le frigo vous referme la porte au nez.'];
const MAIL = ['Une carte postale de la tante Ginette : "Il fait beau. Le chat va bien. Le chat c\'est moi."', 'Une facture d\'électricité... pour un grille-pain.', 'Une publicité : "Achetez un caddie turbo, vous ne le regretterez (presque) pas".', 'Une lettre d\'amour d\'un pigeon. Écriture approximative.'];
const MOVIES = ['« Le Retour du Poulet Masqué »', '« Fast & Croissants 9 »', '« La Vie Secrète des Caddies »', '« Mamie Turbo contre les Zombies Mous »'];
const DIAG = ['Diagnostic : vous êtes en parfaite santé. Un peu trop de frites, peut-être.', 'Vous avez une légère "pigeonnite". Ça se soigne avec une sieste.', 'Votre cœur bat. C\'est bon signe. Au revoir !', 'Prenez deux croissants et rappelez-moi demain.'];

async function activity(game, kind, b, extra = {}) {
  try { return (await game.net.request('activity.do', { kind, buildingId: b.id, ...extra })); } catch (e) { game.ui.toast(e.message, 'bad'); game.sfx('error'); return null; }
}

function needsToast(game, data, label) {
  if (!data) return;
  const n = data.needs;
  game.emit('needs', n);
  if (label) game.ui.toast(`${label}${n ? ` · 🍔 ${Math.round(n.faim)} · ⚡ ${Math.round(n.energie)} · 🙂 ${Math.round(n.humeur)}` : ''}`, 'good', 3200);
}

export async function runAction(game, action, { b, spot, staff }) {
  const g = game;
  switch (action) {
    case 'shop': {
      const s = b.shop;
      if (s === 'cars-new' || s === 'cars-luxe') dealerPanel(g, b, () => openShop(g, s, b));
      else if (s === 'auto-ecole') policeDesk(g, true);
      else if (s === 'foot-club') g.races?.clubDesk();
      else if (s === 'bikepark') g.races?.bikeDesk(b);
      else if (s === 'voile-club') g.sailing?.desk(b);
      else if (s === 'f1') g.races?.desk('f1');
      else if (s === 'surf') g.wingfoil?.desk(b);
      else if (s === 'pole-emploi') poleEmploiPanel(g);
      else if (s === 'cars-used') usedCarsPanel(g, b);
      else if (s === 'rental') rentalPanel(g, b);
      else if (s === 'immo') immoPanel(g, b);
      else if (s === 'scrapyard') scrapPanel(g, b);
      else if (s === 'repair') repairPanel(g, b);
      else if (isSecondHand(s)) secondHandPanel(g, b);
      else if (s === 'vehicles') {
        g.ui.dialog({ name: 'Garagiste', role: b.name, text: 'Salut ! On vend, on répare, on repeint. Et on ne pose pas de questions sur les bosses.', choices: [
          { label: '🛵 Acheter / peintures', action: (m) => { m.close(); openShop(g, s, b); } },
          { label: '🔧 Réparer un véhicule', action: (m) => { m.close(); repairPanel(g, b); } },
          { label: 'Au revoir', ghost: true, action: (m) => m.close() },
        ] });
      } else openShop(g, s, b);
      break;
    }
    case 'wardrobe': openWardrobe(g); break;
    case 'casino-desk': casinoDesk(g); break;
    case 'casino-slots': slotsPanel(g); break;
    case 'casino-roulette': roulettePanel(g); break;
    case 'casino-bj': blackjackPanel(g); break;
    case 'casino-poker': pokerPanel(g); break;
    case 'range': if (!g.range) rangePanel(g, b); break;
    case 'karting': if (!g.karting?.s) kartingDesk(g, b); break;
    case 'admin': adminKiosk(g); break;
    case 'basket': openBasket(g, b); break;
    case 'checkout': g.basket?.checkout(b); break;
    case 'sit': g.sitting?.sit(spot.seat, b); break;
    case 'nap': {
      g.sitting?.sit({ ...spot.seat, lie: true }, b);
      g.labels.bubble(g.avatar.root, 'Zzzz...', 3500, 'player');
      const r = await activity(g, 'nap', b);
      if (r) needsToast(g, r, '😴 Petite sieste réparatrice');
      break;
    }
    case 'talk': {
      const who = staff || (g.interiors.loaded.get(b.id)?.people[0]);
      const lines = STAFF_LINES[who?.role] || ['Bonjour ! Belle journée, n\'est-ce pas ?'];
      const chat = { id: `${b.id}:${who?.name}`, name: who?.name || 'Quelqu\'un', role: ROLE_LABEL[who?.role] || b.name, root: who?.av?.root };
      const choices = [{ label: 'Encore une !', action: (mm) => say(mm) }, { label: '⌨️ Écrire', action: (mm) => chatMode(g, mm, chat, say) }, { label: 'Au revoir', ghost: true, action: (mm) => mm.close() }];
      const say = (m) => m.show(pick(lines), choices);
      g.ui.dialog({ name: chat.name, role: b.name, text: pick(lines), choices });
      break;
    }
    case 'tv': {
      g.labels.bubble(g.avatar.root, `📺 ${pick(TV)}`, 4500, 'player');
      const r = await activity(g, 'tv', b); if (r) needsToast(g, r, '📺 Un moment de détente');
      break;
    }
    case 'fridge': g.ui.toast(`🧊 ${pick(FRIDGE)}`, '', 4500); break;
    case 'mail': {
      g.ui.toast(`📬 ${pick(MAIL)}`, '', 5000);
      await activity(g, 'mail', b);
      break;
    }
    case 'elevator': {
      // appartement du joueur dans cet immeuble : l'ascenseur y monte
      const p = g.profile;
      const mine = p.properties.map((x) => HOUSING_BY_ID[x.id]).find((x) => x?.kind === 'appart' && x.building === b.id);
      if (!mine) { g.ui.toast('🛗 "Ascenseur réservé aux résidents. Et en panne depuis 1997." (Agence Immo Pas Cher pour louer ou acheter ici.)', '', 4500); break; }
      if (p.home.place !== mine.id) { g.ui.toast(`🛗 Tu possèdes l'${mine.name.toLowerCase()} mais tu n'y habites pas : emménage depuis l'agence immobilière.`, '', 4500); break; }
      g.home.enter(null, null, null, { x: spot.x, z: spot.z });
      break;
    }
    case 'homefun': g.home?.useFunItem(spot.item); break;
    case 'job': jobPanel(g, b); break;
    case 'training': schoolPanel(g); break;
    case 'company': createCompanyPanel(g); break;
    case 'publicshower': {
      const r = await activity(g, 'douche', b);
      if (r) { showerFx(g); needsToast(g, r, '🚿 Douche des vestiaires'); }
      break;
    }
    case 'machine': g.body?.startMachine(spot.machine, spot.seat); break;
    case 'gympass': gymPassPanel(g); break;
    case 'pushups': g.body?.pushups(); break;
    case 'hair': hairPanel(g); break;
    case 'care': hospitalCarePanel(g); break;
    case 'cook': cookPanel(g); break;
    case 'shower': shower(g); break;
    case 'sleep': sleep(g, spot.seat); break;
    case 'police': policeDesk(g); break;
    case 'court': g.police.courtDesk(); break;
    case 'submarine': g.submarine.desk(); break;
    case 'hospital': {
      const r = await activity(g, 'hospital', b);
      if (r) { g.ui.dialog({ name: 'Dr Bobo', role: 'Hôpital Saint-Bobo', text: pick(DIAG), choices: [{ label: 'Merci docteur', ghost: true, action: (m) => m.close() }] }); needsToast(g, r, '🩺 Consultation terminée'); }
      break;
    }
    case 'bank': {
      g.ui.dialog({ name: 'Votre conseiller·ère', role: 'Banque PlayCoins', text: `Bonjour ! Compte : ${g.profile.coins.toLocaleString('fr-FR')} PC, livret : ${Math.round(g.profile.savings || 0).toLocaleString('fr-FR')} PC. Que puis-je pour vous ?`, choices: [
        { label: '💵 Retirer / déposer des espèces', action: (m) => { m.close(); cashPanel(g, 'Guichet de la Banque PlayCoins'); } },
        { label: '🐷 Livret et factures (appli Banque)', action: (m) => { m.close(); g.phone?.open('bank'); } },
        { label: 'Au revoir', ghost: true, action: (m) => m.close() },
      ] });
      break;
    }
    case 'vault': g.crimes?.robBank(); break;
    case 'mairie': {
      const r = await activity(g, 'mairie', b);
      if (r) { g.ui.dialog({ name: 'Le Maire', role: 'Mairie', text: 'Votre réclamation "les pigeons me regardent bizarrement" a été enregistrée sous le numéro 4 812 007. Vous recevez le titre officiel de Râleur !', choices: [{ label: '😤 Merci !', ghost: true, action: (m) => m.close() }] }); g.reward({ coins: 0 }); if (r.title) g.ui.toast(`🏅 Nouveau titre : ${r.title}`, 'good', 4500); }
      break;
    }
    case 'arcade': {
      g.player.setPose('celebrate', 1.4);
      const r = await activity(g, 'arcade', b);
      if (r) { g.sfx(r.jackpot ? 'levelup' : 'beep'); g.labels.bubble(g.avatar.root, r.jackpot ? `JACKPOT ! +${r.coins} PC` : pick(['GAME OVER', 'Nouveau record ! (de défaites)', 'Niveau 2 atteint... puis perdu.', 'Bip bip boup !']), 2500, 'player'); }
      break;
    }
    case 'claw': {
      const r = await activity(g, 'claw', b);
      if (r) { g.sfx(r.prize ? 'success' : 'fail'); g.ui.toast(r.prize ? '🐥 Vous avez attrapé la PELUCHE POULET GÉANTE ! (installez-la chez vous)' : 'La pince a lâché la peluche au dernier moment. Classique.', r.prize ? 'good' : '', 4000); }
      break;
    }
    case 'movie': {
      const r = await activity(g, 'movie', b);
      if (r) { g.labels.bubble(g.avatar.root, `🎬 ${pick(MOVIES)}... quel film !`, 5000, 'player'); needsToast(g, r, '🍿 Bonne séance'); }
      break;
    }
    case 'bowling': {
      g.player.setPose('throw', 1);
      const r = await activity(g, 'bowling', b);
      if (r) { g.sfx(r.strike ? 'levelup' : 'land'); g.labels.bubble(g.avatar.root, r.strike ? '🎳 STRIKE ! (+5 PC)' : `🎳 ${r.pins} quille${r.pins > 1 ? 's' : ''}`, 3000, 'player'); }
      break;
    }
    case 'gym': {
      g.player.setPose('celebrate', 2);
      const r = await activity(g, 'gym', b);
      if (r) { g.labels.bubble(g.avatar.root, pick(['Hmpf ! 💪', 'Encore une... !', 'Je sens mes muscles... pousser ?']), 2200, 'player'); needsToast(g, r, '🏋️ Séance de musculation'); }
      break;
    }
    case 'drink': { const r = await activity(g, 'drink', b); if (r) needsToast(g, r, '💧 Glou glou'); break; }
    case 'pole': {
      const r = await activity(g, 'pole', b);
      if (r) { g.player.vel.y = 6; g.player.grounded = false; g.sfx('whistle'); g.labels.bubble(g.avatar.root, 'Wiiiii !', 1500, 'player'); }
      break;
    }
    case 'chest': {
      const r = await activity(g, 'chest', b);
      if (r) { g.reward({ coins: r.coins, xp: r.xp }, '🗝️ Trésor de la cabane'); g.sfx('secret'); }
      break;
    }
    case 'quiz': {
      const q = quizOfDay(g.now());
      g.ui.dialog({ name: 'Professeur·e', role: 'École des Petits Génies', text: q.q, choices: q.c.map((c, i) => ({ label: c, action: async (m) => {
        m.close();
        const r = await activity(g, 'quiz', b, { answer: i });
        if (!r) return;
        if (r.correct) { g.reward({ coins: r.coins, xp: r.xp }, '📚 Bonne réponse'); } else { g.sfx('fail'); g.ui.toast(`Raté ! La bonne réponse était : ${r.answer}. Revenez dans 10 minutes.`, 'bad', 4500); }
      } })) });
      break;
    }
    case 'prison': prisonGuard(g); break;
    case 'jailescape': if (g.profile.justice.jail) tryEscape(g); else g.ui.toast('Tu n\'es pas prisonnier·ère... pourquoi creuser ?', '', 2500); break;
    case 'car': carDialog(g, spot.model); break;
    case 'repair': repairPanel(g, b); break;
    default: g.ui.toast('...', '', 1000);
  }
}

// Fiche d'une voiture exposée (concession) : caractéristiques et achat.
function carDialog(g, model) {
  const s = VEHICLES[model];
  const item = g.net.content.items[model];
  const owned = g.profile.vehicles.some((v) => v.model === model);
  const text = `${s.name} — ${Math.round(s.max * 3.6)} km/h max, ${s.seats} places, réservoir ${s.fuel} L. Prix : ${s.price.toLocaleString('fr-FR')} PC${s.level ? ` (niveau ${s.level} requis)` : ''}.`;
  g.ui.dialog({ name: 'Commercial·e', role: 'Concession Auto Paillettes', text: owned ? `${text} Vous l'avez déjà !` : text, choices: [
    ...(item && !owned ? [{ label: `Acheter (${s.price.toLocaleString('fr-FR')} PC)`, action: async (m) => {
      try { await g.net.request('shop.buy', { itemId: model }); g.sfx('cash'); m.show(`Félicitations ! Votre ${s.name} vous attend, garée devant la concession. Voici les clés 🔑 (touche K pour verrouiller).`, [{ label: 'Super !', ghost: true, action: (x) => x.close() }]); } catch (e) { g.sfx('error'); m.show(e.message, [{ label: 'D\'accord', ghost: true, action: (x) => x.close() }]); }
    } }] : []),
    { label: 'Fermer', ghost: true, action: (m) => m.close() },
  ] });
}

export { h };
