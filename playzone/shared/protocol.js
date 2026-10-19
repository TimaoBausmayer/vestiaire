// Protocole réseau PLAYZONE (messages JSON sur WebSocket) et limites de sécurité.
export const PROTOCOL_VERSION = 1;

export const LIMITS = {
  maxPayload: 8 * 1024,          // taille max d'un message (octets)
  msgRate: 30,                   // messages / seconde autorisés (seau à jetons)...
  msgBurst: 60,                  // ...avec une rafale max
  chatLen: 140,                  // longueur max d'un message de chat
  chatRate: 5,                   // messages de chat...
  chatWindowMs: 10_000,          // ...par fenêtre de 10 s
  chatRadius: 45,                // le chat "proche" porte à 45 m
  playersPerWorld: 40,           // au-delà, un nouveau monde (instance) est créé
  partyMax: 6,
  interestRadius: 160,           // on ne reçoit que les joueurs à moins de 160 m
  snapshotHz: 10,
  accountsPerIpPerHour: 6,
};

// Vitesses horizontales maximales vérifiées par le serveur (m/s), marges comprises.
export const SPEED = {
  foot: 12.5,        // sprint 9 m/s x amélioration 1,12 + marge
  vehicle: 21,       // (ancien plafond unique) : chaque modèle a désormais le sien, voir maxSpeedOf()
  knock: 16,         // éjection (bras tournants, crocodile...) absorbée par le "crédit" de distance
  creditMax: 7,      // crédit de distance (m) pour absorber la gigue réseau et les petits sauts
  creditRefill: 1.5, // m/s
};

// Types de messages
// Client -> serveur : hello, create, req, state, tp, chat, party, invite, visit, leave_home, report, ping
// Serveur -> client : welcome, created, res, profile, snap, join, leave, pupdate, chat, sys, correct,
//                     event.start, event.update, event.end, party, invite, home_data, pong, kick
