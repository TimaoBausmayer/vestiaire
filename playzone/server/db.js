// Base de données SQLite intégrée à Node (node:sqlite, sans dépendance native).
// Tables : joueurs (profil JSON + empreinte du jeton), classements, signalements.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');

export class DB {
  constructor(file) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
        profile TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_hash TEXT
      );
      CREATE TABLE IF NOT EXISTS scores (
        mg TEXT NOT NULL, player_id TEXT NOT NULL, name TEXT NOT NULL, score REAL NOT NULL, at INTEGER NOT NULL,
        PRIMARY KEY (mg, player_id)
      );
      CREATE INDEX IF NOT EXISTS scores_mg ON scores (mg, score);
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, reporter TEXT NOT NULL, target TEXT NOT NULL,
        reason TEXT NOT NULL, context TEXT
      );
    `);
    this.q = {
      byToken: this.db.prepare('SELECT * FROM players WHERE token_hash = ?'),
      insert: this.db.prepare('INSERT INTO players (id, token_hash, name, profile, created_at, updated_at, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      save: this.db.prepare('UPDATE players SET profile = ?, name = ?, updated_at = ? WHERE id = ?'),
      countIp: this.db.prepare('SELECT COUNT(*) AS n FROM players WHERE ip_hash = ? AND created_at > ?'),
      getScore: this.db.prepare('SELECT score FROM scores WHERE mg = ? AND player_id = ?'),
      upsertScore: this.db.prepare('INSERT INTO scores (mg, player_id, name, score, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(mg, player_id) DO UPDATE SET score = excluded.score, name = excluded.name, at = excluded.at'),
      rankAsc: this.db.prepare('SELECT COUNT(*) AS n FROM scores WHERE mg = ? AND score < ?'),
      rankDesc: this.db.prepare('SELECT COUNT(*) AS n FROM scores WHERE mg = ? AND score > ?'),
      topAsc: this.db.prepare('SELECT player_id AS id, name, score FROM scores WHERE mg = ? ORDER BY score ASC, at ASC LIMIT ?'),
      topDesc: this.db.prepare('SELECT player_id AS id, name, score FROM scores WHERE mg = ? ORDER BY score DESC, at ASC LIMIT ?'),
      report: this.db.prepare('INSERT INTO reports (at, reporter, target, reason, context) VALUES (?, ?, ?, ?, ?)'),
    };
  }

  findByToken(token) {
    const row = this.q.byToken.get(hashToken(token));
    return row ? { ...row, profile: JSON.parse(row.profile) } : null;
  }

  createPlayer(profile, token, ipHash) {
    const now = Date.now();
    this.q.insert.run(profile.id, hashToken(token), profile.name, JSON.stringify(profile), now, now, ipHash);
  }

  accountsFromIp(ipHash, sinceMs) { return this.q.countIp.get(ipHash, sinceMs).n; }

  saveProfile(profile) { this.q.save.run(JSON.stringify(profile), profile.name, Date.now(), profile.id); }

  // Classements (interface attendue par l'autorité : submit / top). isLowerBetter(mg) : chrono ?
  leaderboard(isLowerBetter) {
    const q = this.q;
    return {
      submit(mg, profile, score, lowerBetter) {
        const cur = q.getScore.get(mg, profile.id);
        if (!cur || (lowerBetter ? score < cur.score : score > cur.score)) q.upsertScore.run(mg, profile.id, profile.name, score, Date.now());
        const best = cur && !(lowerBetter ? score < cur.score : score > cur.score) ? cur.score : score;
        return (lowerBetter ? q.rankAsc : q.rankDesc).get(mg, best).n + 1;
      },
      top(mg, n) { return (isLowerBetter(mg) ? q.topAsc : q.topDesc).all(mg, n); },
    };
  }

  report(reporter, target, reason, context) { this.q.report.run(Date.now(), reporter, target, String(reason).slice(0, 200), JSON.stringify(context || []).slice(0, 4000)); }
}
