// Registre des entreprises des joueurs (en ligne) : liste pour les investisseurs, mouvements de
// trésorerie quand quelqu'un achète ou revend des parts (le patron peut être hors ligne : on met alors
// à jour son profil en base).
import { sharePrice, SECTORS } from '../shared/business.js';

export class CompanyRegistry {
  constructor(server) {
    this.server = server;
    this.map = new Map(); // id -> { ownerId, ownerName, company }
    try {
      for (const prof of server.db.allProfiles?.() || []) {
        const c = prof.company;
        if (c && !c.bankrupt) this.map.set(c.id, { ownerId: prof.id, ownerName: prof.name, company: c });
      }
    } catch { /* base vide */ }
  }

  update(c, p) {
    if (c.bankrupt) { this.map.delete(c.id); return; }
    this.map.set(c.id, { ownerId: p.id, ownerName: p.name, company: c });
  }

  get(id) { return this.map.get(id) || null; }

  list(now) {
    return [...this.map.entries()].map(([id, e]) => ({
      id, name: e.company.name, sector: e.company.sector, emoji: SECTORS[e.company.sector]?.emoji, owner: e.ownerName, ownerId: e.ownerId,
      price: sharePrice(e.company, now), float: e.company.float, sold: e.company.sold, staff: e.company.staff, quality: e.company.quality,
    }));
  }

  adjust(id, cash, shares) {
    const e = this.map.get(id);
    if (!e) return;
    const live = this.server.online.get(e.ownerId);
    if (live?.profile.company?.id === id) {
      const c = live.profile.company;
      c.cash += cash; c.sold += shares;
      e.company = c;
      live.dirty = true;
      live.send({ t: 'profile', profile: live.profile });
      live.send({ t: 'sys', text: `📈 Un investisseur a ${shares > 0 ? 'acheté' : 'revendu'} ${Math.abs(shares)} part(s) de ${c.name}.` });
      return;
    }
    const prof = this.server.db.profileById(e.ownerId);
    if (prof?.company?.id === id) {
      prof.company.cash += cash; prof.company.sold += shares;
      this.server.db.saveProfile(prof);
      e.company = prof.company;
    }
  }
}
