# PLAYZONE

Monde ouvert 3D, drôle et vivant, jouable dans le navigateur (ordinateur et téléphone), en **solo** ou **en ligne** avec un vrai serveur multijoueur.

> Première version jouable (0.1). Ce document dit précisément ce qui fonctionne, comment c'est construit, et ce qui reste à faire.

---

## Jouer

### En ligne (multijoueur réel)

```bash
cd playzone
npm install        # installe "ws" (WebSocket) ; Three.js est déjà copié dans vendor/
npm start          # http://localhost:8080
```

Ouvre `http://localhost:8080` dans plusieurs navigateurs (ou sur d'autres appareils du même réseau : `http://<ip-de-la-machine>:8080`) puis **Jouer en ligne**.

Variables utiles : `PORT` (8080), `HOST` (0.0.0.0), `DB` (fichier SQLite, par défaut `server/data/playzone.db`), `ACCOUNTS_PER_IP` (créations de personnages par IP et par heure, 6 par défaut).
Prérequis : **Node.js 22.13 ou plus** (base de données SQLite intégrée à Node, aucune dépendance native).

Pour un serveur public : n'importe quel hébergeur Node avec disque persistant (VPS, Render, Fly.io, Railway…), derrière un proxy HTTPS qui laisse passer les WebSocket (`/ws`).

### En solo (sans serveur)

Le dossier `playzone/` est un site statique : n'importe quel hébergement statique suffit (GitHub Pages, Netlify, `npx serve playzone`…). Il doit être servi en HTTP(S) : les modules JavaScript ne se chargent pas en ouvrant le fichier directement (`file://`). Sans serveur détecté, le bouton « En ligne » est grisé et tout le reste fonctionne, avec une sauvegarde dans le navigateur (exportable/importable depuis le téléphone du jeu).

### Commandes

| Action | Clavier / souris | Tactile |
|---|---|---|
| Bouger | ZQSD / WASD / flèches | joystick (pouce gauche) |
| Courir | Maj | bouton 🏃 (ou joystick poussé à fond) |
| Sauter | Espace | bouton ⤒ |
| Interagir (parler, entrer, ramasser, monter…) | E | bouton ✋ |
| Caméra | glisser la souris, molette pour zoomer | glisser à droite |
| Téléphone / carte | P / M | bouton 📱 |
| Chat (en ligne) | Entrée | zone de chat |
| Danser / saluer | 1, 2, 3 / 4 | bouton 💃 |
| Lance à incendie | clic maintenu ou F | bouton 💦 (en mission) |
| Conduire | Z/S accélérer-freiner, Q/D tourner, H klaxon | joystick |

---

## Ce qui fonctionne réellement (version 0.1)

Tout ce qui suit est implémenté, jouable, et couvert par des tests automatiques (voir « Tests »).

| Demandé pour la première version | État |
|---|---|
| Zone 3D explorable | ✅ Une île de 256 × 256 m : Grande Place, centre-ville, quartier résidentiel, plage, port et ponton, ferme et champs, parc de loisirs (grande roue, étang), forêt, zone des ateliers, cabane secrète. Jour/nuit (cycle de 20 min, identique pour tous les joueurs), mer animée, nage. |
| Personnage contrôlable | ✅ Créateur (peau, silhouette, taille, regard, 9 coiffures, couleurs, tenues), marche/course/saut/nage, animations procédurales, trampoline. |
| Bâtiments et PNJ | ✅ 30+ bâtiments générés, 16 habitants avec rôle, personnalité et répliques humoristiques ; ils se promènent, discutent entre eux, réagissent quand on les bouscule, donnent des conseils et des indices. Circulation automobile à double sens qui freine et klaxonne. |
| 3 mini-jeux | ✅ **Bataille de tartes** (tir sur cibles mobiles), **Course de poulets**, **Parcours du Combattant Mou** (course d'obstacles chronométrée) : règles, compte à rebours, fin, médailles, classements, récompenses. |
| 3 métiers avec missions | ✅ **Livreur** (4 missions), **Pompier** (4), **Cuisinier** (3) : niveaux 1 à 10, missions débloquées par niveau, 3 améliorations achetables par métier, uniforme. |
| Logement visitable | ✅ Studio puis grand appartement, 20 meubles, mode déco (placer, tourner, ranger), meubles interactifs, invitation d'amis en ligne. |
| PlayCoins | ✅ Gagnés (métiers, mini-jeux, événements, canards dorés, bonus quotidien), dépensés (vêtements, meubles, animaux, véhicules, améliorations, organisation d'événements). |
| Boutique fonctionnelle | ✅ 4 boutiques physiques (vêtements avec essayage, meubles, animalerie, garage), revente de certains objets. |
| Animaux animés | ✅ Les **20 espèces** demandées, chacune avec un comportement (fuite, envol, pâture, nage, vol circulaire, meute qui hurle la nuit, crocodile qui claque, requin qui tourne autour des nageurs…). 10 espèces adoptables : l'animal suit son maître, a faim, s'ennuie, apprend 4 tours. |
| Événement déclenchable | ✅ **Invasion de poulets**, **Soirée DJ**, et **Chasse aux citrouilles** (saison Halloween) : organisables par les joueurs au tableau des événements, lancés aussi automatiquement par la Mairie, avec podium. |
| Sauvegarde | ✅ Solo : navigateur (+ export/import). En ligne : base SQLite sur le serveur. |

En plus : téléphone virtuel (carte avec repère, missions, animaux, garage, sac, événements, messages, joueurs, profil, saison, réglages), 4 véhicules conduisibles, 10 canards dorés cachés, bonus quotidien progressif, réputation, titres, sons synthétisés (aucun fichier audio), contrôles tactiles, 3 niveaux de qualité graphique.

### Multijoueur : ce qui est réel

Avec `npm start`, le multijoueur est **réel** : les joueurs se voient bouger (interpolation à 10 Hz), discutent, forment des groupes, s'invitent chez eux, participent ensemble aux événements publics et partagent les classements. **Aucun joueur n'est simulé** : les seuls personnages contrôlés par l'ordinateur sont les habitants (PNJ), clairement présentés comme tels (y compris leurs records dans les classements du mode solo, marqués « PNJ »).

---

## Architecture

```
playzone/
├── index.html, style.css      page et interface (aucune étape de compilation)
├── vendor/                    Three.js r180 (copié par `npm run vendor`)
├── shared/                    code commun au navigateur ET au serveur
│   ├── world-layout.js        plan de la carte (positions vérifiées par le serveur)
│   ├── content/               contenu en PACKS : objets, métiers, mini-jeux, espèces, événements
│   │   ├── packs/base.js, packs/halloween-2026.js, registry.js, roadmap.js
│   ├── authority.js           ⚖️ L'AUTORITÉ : argent, achats, missions, récompenses, validations
│   ├── rules.js               niveaux, récompenses, rendements décroissants, bonus quotidien
│   ├── minigame-logic.js      logique déterministe (graines) : cibles, poulets, citrouilles
│   ├── events-director.js     événements publics : lancement, validation, podium
│   ├── protocol.js            messages réseau, limites anti-abus, vitesses maximales
│   └── chat-filter.js         filtre de langage, détection de liens/numéros
├── src/                       client (navigateur)
│   ├── core/                  moteur, entrées, collisions, décor fusionné, sons, particules
│   ├── world/                 terrain, bâtiments, décor, jour/nuit, circulation, canards dorés
│   ├── characters/            avatar, joueur, caméra, habitants (PNJ)
│   ├── animals/               modèles des 20 espèces, comportements, animaux de compagnie
│   ├── jobs/                  livreur, pompier, cuisinier
│   ├── minigames/             socle commun + 3 mini-jeux + registre
│   ├── events/                événements publics, décorations de saison
│   ├── home/                  logement, meubles, décoration
│   ├── vehicles/              véhicules
│   ├── net/                   local.js (solo), online.js (serveur), remotes.js, social.js
│   └── ui/                    HUD, téléphone, boutiques, créateur, écran titre, tactile
├── server/                    serveur Node : index.js (HTTP + WebSocket), world.js, db.js
└── tests/                     unit/ (node:test) et e2e/ (Chromium sans écran)
```

### Choix techniques

- **Three.js** en modules ES natifs, **sans build** : le jeu se publie tel quel sur n'importe quel hébergement statique, et le même code `shared/` tourne côté serveur.
- **Rendu « cel-shading »** (`MeshToonMaterial` en 4 tons), couleurs portées par les sommets : tout le décor immobile est fusionné en quelques grands maillages par zone (≈ 60 appels de dessin pour toute la ville ; 55 à 240 selon l'endroit avec habitants, animaux et voitures). Tous les modèles (personnages, 20 espèces, meubles, véhicules) sont construits en code : aucun fichier 3D, aucune licence tierce.
- **Une seule autorité** (`shared/authority.js`) : en ligne elle s'exécute sur le serveur avec ses propres positions et son horloge ; en solo elle s'exécute dans le navigateur. Le jeu ne fait donc qu'une implémentation des règles.
- **Logique déterministe par graine** : le serveur envoie une graine, client et serveur calculent les mêmes cibles/poulets/citrouilles, et le serveur peut vérifier chaque action (« cette cible existait-elle à cet instant ? », « ce poulet était-il à moins de 3,6 m ? »).
- **Serveur** : Node.js + `ws` + **SQLite intégré à Node** (`node:sqlite`). Mondes (instances) de 40 joueurs maximum : au-delà, un « Monde 2 » est créé automatiquement. Les quantités des événements s'adaptent au nombre de joueurs (ex. 18 à 60 poulets).

---

## Sécurité, anti-triche et anti-abus

Ce que le serveur vérifie **lui-même** :

- **Argent, inventaire, XP, réputation** : modifiés uniquement par l'autorité serveur ; le client ne fait que demander.
- **Déplacements** : vitesse maximale (à pied / en véhicule) avec un petit « crédit » de distance pour absorber la gigue réseau ; toute téléportation est refusée et le joueur est renvoyé à sa dernière position valide. Les changements de zone (entrer chez soi, visiter un ami) ne sont acceptés que devant la bonne porte et sur invitation.
- **Achats** : article en vente, niveau/réputation requis, solde suffisant, et il faut être **dans la boutique**.
- **Métiers** : colis livré seulement **devant la bonne porte** ; feu éteint seulement si le joueur est resté à portée assez longtemps pour la puissance de sa lance ; burger payé seulement si la **recette est exacte** et servie à temps.
- **Mini-jeux** : chaque cible touchée est revérifiée (présente à cet instant ?) ; poulets déposés seulement au panier, avec un délai minimal ; **chrono du parcours calculé par le serveur** à partir des positions (anneaux franchis dans l'ordre), temps impossibles refusés.
- **Farm** : rendements décroissants (au-delà de 6 parties/missions par heure sur la même activité : 60 %, puis 30 %).
- **Réseau** : limiteur de débit par connexion, messages de 8 Ko maximum, création de personnages limitée par adresse IP.
- **Chat** : 140 caractères, 5 messages / 10 s, messages répétés bloqués, insultes masquées, **liens et numéros de téléphone refusés**, portée de 45 m (ou canal de groupe), masquer un joueur, **signaler** (les derniers messages sont joints au signalement en base).

Limites honnêtes : le serveur valide des **plausibilités** (positions, délais, graines) mais ne simule pas toute la physique ; un programme qui joue « parfaitement » (bot) reste possible. Les comptes sont des comptes invités liés à un jeton stocké dans le navigateur (pas de mot de passe ni de récupération) ; les signalements sont enregistrés mais il n'existe pas encore d'interface de modération.

---

## Économie (PlayCoins)

- Départ : 200 PC. Bonus quotidien : 50 PC, +15 par jour consécutif (140 max).
- Gains typiques : mission 30 à 190 PC (+10 % par niveau de métier), mini-jeu 10 à 90 PC, canard doré 60 PC (600 PC bonus pour les 10), événement 8 à 25 PC par action + podium.
- Prix : vêtements et accessoires 50 à 5 000 PC (couronne), meubles 50 à 4 000 PC, animaux 120 à 700 PC, véhicules 600 à 4 500 PC, agrandissement du logement 3 000 PC. Les objets haut de gamme demandent aussi un **niveau** (et parfois de la **réputation**) : un joueur riche ne peut pas tout acheter immédiatement, et un débutant a toujours un objectif proche.

---

## Mises à jour mensuelles

Le contenu est organisé en **packs** (`shared/content/packs/`). Un pack peut contenir des objets, des mini-jeux, des événements, des décorations et des répliques d'habitants, avec des **dates de début et de fin** : il s'active et se désactive tout seul, côté client comme côté serveur. Les objets achetés pendant une saison restent utilisables après.

Exemple réel : `packs/halloween-2026.js` (actif du 15 octobre au 8 novembre 2026) ajoute la Chasse aux citrouilles, 5 objets, des citrouilles et des fantômes dans la ville.

Calendrier proposé (alternance grosse mise à jour de saison / petite mise à jour), visible dans l'appli « Saison » du téléphone (`shared/content/roadmap.js`) :

| Mois | Type | Contenu prévu |
|---|---|---|
| Oct. 2026 | Saison | **Halloween** — disponible |
| Nov. 2026 | Petite | Métier Fermier, Course de caddies, recettes |
| Déc. 2026 | Saison | Neige, patinoire, marché de Noël, bataille de boules de neige |
| Janv. 2027 | Petite | Métier Entrepreneur, Sumo, guildes |
| Févr. 2027 | Petite | Carnaval : parade d'animaux, chaises musicales |
| Mars 2027 | Saison | Printemps : jardinage, concours d'animaux, Vétérinaire |
| Avr. 2027 | Petite | Chasse aux œufs, Photographe |
| Juin 2027 | Saison | Été : surf, jet-ski, fêtes de plage, Pêcheur |

Seule la saison d'octobre 2026 est développée ; les autres sont **planifiées**, pas encore construites.

### Ajouter du contenu

- **Objet / vêtement / meuble** : une entrée dans un pack (`items`). Pour un nouveau chapeau ou meuble, ajouter aussi son modèle dans `src/characters/avatar.js` ou `src/home/furniture.js`.
- **Mini-jeu** : (1) définition dans un pack (`minigames` : règles, durée, récompenses) ; (2) validation de ses actions dans `shared/authority.js` (`mg.event`) ; (3) une classe qui étend `Minigame` dans `src/minigames/` et l'ajouter au `REGISTRY` de `src/minigames/index.js`.
- **Métier** : missions et améliorations dans `shared/content/jobs.js`, validation dans `shared/authority.js` (`job.start` / `job.step`), mécanique côté client dans `src/jobs/`.
- **Événement** : définition dans un pack, validation dans `shared/events-director.js`, affichage dans `src/events/events.js`.
- **Saison** : un nouveau fichier de pack avec `start`/`end`, ajouté à `PACKS` dans `shared/content/registry.js`.

---

## Tests

```bash
npm test           # 17 tests unitaires : autorité (économie, métiers, mini-jeux, triche refusée) + serveur
npm run test:e2e   # parcours complets dans Chromium sans écran (Playwright requis)
```

Les tests de bout en bout jouent réellement au jeu : création du personnage, achat, mini-jeux complets, les 3 métiers, logement et déco, animal, véhicule, téléphone, 3 événements, version tactile, et **deux navigateurs connectés au vrai serveur** (ils se voient, discutent, l'un visite le logement de l'autre ; une téléportation-triche est refusée ; les profils sont en base).

Ce qui n'a **pas** pu être mesuré : la fluidité sur une vraie carte graphique et sur de vrais téléphones (l'environnement de développement n'a pas de GPU : le rendu logiciel y tourne à quelques images/seconde, ce qui n'est pas représentatif). Le jeu a été conçu pour les machines modestes (décor fusionné, distance d'affichage selon la qualité, ombres coupées en qualité « légère »).

---

## Limites connues et prochaines étapes

- Métiers du cahier des charges **pas encore développés** : policier, mécanicien, éboueur, constructeur, agent immobilier, vendeur, fermier, pêcheur, vétérinaire, chauffeur, entrepreneur, influenceur/streamer, DJ, styliste, photographe, restaurateur (« organisateur » existe en partie : tout joueur peut organiser un événement public).
- Mini-jeux **pas encore développés** : sumo, course de caddies, chaises musicales, défis d'équilibre (seule la poutre du parcours existe), concours de danse noté (la soirée DJ récompense la danse sans la noter), courses de véhicules, cache-cache, chasse au trésor libre, défis entre joueurs.
- Événements **pas encore développés** : courses géantes, tournois, parades d'animaux, fêtes sur la plage, concours de décoration, tournois entre amis. Les fêtes à la maison sont possibles en ligne (invitations + boule disco) mais sans récompense dédiée.
- L'architecture (packs de contenu, autorité unique, registres de mini-jeux/métiers) est prévue pour ajouter tout cela un élément à la fois.
- Pas encore : création d'entreprise, revente entre joueurs, groupes permanents (guildes), comptes avec mot de passe, outils de modération, sauvegarde du solo vers le compte en ligne.
- Musique et sons synthétisés simples ; pas de doublage.
- Une instance de serveur (pas de répartition sur plusieurs machines).
