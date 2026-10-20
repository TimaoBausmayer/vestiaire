import { hourlyBills } from '../../shared/property.js';

// FACTURES : loyer, mensualités de crédit et charges sont prélevés à chaque minute de jeu (pas quand
// on est déconnecté). En solo, c'est le client qui déclenche le prélèvement ; en ligne, le serveur.
// On ne dérange le joueur qu'avec un récapitulatif de temps en temps, ou en cas de problème.
export class Bills {
  constructor(game) {
    this.game = game;
    this.t = 60;
    this.paidSince = 0;
    this.lastRecap = performance.now();
    this.warnedDebt = 0;
    game.net.on?.('bills', (d) => this.onResult(d));
  }

  update(dt) {
    const g = this.game;
    if (g.net.mode === 'online') return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 60;
    g.net.request('bills.tick', {}).then((d) => this.onResult(d)).catch(() => {});
  }

  onResult(d) {
    const g = this.game;
    if (!d) return;
    this.paidSince += d.paid || 0;
    if (d.evicted) {
      g.sfx('fail');
      g.ui.toast('📦 Loyers impayés : tu as été expulsé·e ! Retour au studio de la Résidence Les Mouettes (avec tes meubles et ta dette).', 'bad', 7000);
    } else if (d.debt > 0 && performance.now() - this.warnedDebt > 180_000) {
      this.warnedDebt = performance.now();
      g.ui.toast(`⚠️ Pas assez d'argent pour les factures : dette de ${Math.round(d.debt)} PC. Rembourse à l'agence immobilière ou à la banque.`, 'bad', 6000);
    }
    if (performance.now() - this.lastRecap > 600_000 && this.paidSince > 0) {
      const b = hourlyBills(g.profile);
      g.ui.toast(`🧾 Factures des 10 dernières minutes : -${Math.round(this.paidSince)} PC (loyer ${b.rent}/h, crédit ${b.loans}/h, charges ${b.charges}/h).`, '', 5000);
      this.paidSince = 0;
      this.lastRecap = performance.now();
    }
  }
}
