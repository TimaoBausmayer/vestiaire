// AUTORITÉ — RÉSEAU SOCIAL « PlayGram » : publications (texte filtré + petite photo prise en jeu),
// abonnés et likes calculés à partir de la réputation (pas d'argent gagné ici).
import { isClean } from './chat-filter.js';

const err = (error) => ({ ok: false, error });
export const followersOf = (p) => Math.max(3, Math.round(12 + Math.max(0, p.rep) * 4.5 + (p.karting?.wins || 0) * 25 + (p.titles?.length || 0) * 15));
// Likes d'une publication : grandissent pendant quelques heures, selon les abonnés.
export const likesOf = (post, followers, now) => Math.round(followers * (0.08 + (post.seed % 13) / 100) * Math.min(1, (now - post.at) / (3 * 3600_000) + 0.15) + (post.photo ? followers * 0.05 : 0));

export const SOCIAL_HANDLERS = {
  'social.post'(ctx, { text, photo }) {
    const p = ctx.profile;
    const t = String(text || '').trim().slice(0, 140);
    if (!t && !photo) return err('Écris quelque chose ou prends une photo.');
    if (t && !isClean(t)) return err('Ce message n\'est pas autorisé.');
    if (ctx.now - (p.cooldowns['social:post'] || 0) < 20_000) return err('Doucement ! Attends un peu avant de republier.');
    const ph = typeof photo === 'string' && photo.startsWith('data:image/jpeg;base64,') && photo.length < 40000 ? photo : null;
    p.cooldowns['social:post'] = ctx.now;
    p.social ||= { posts: [] };
    p.social.posts.push({ id: ctx.newId(), text: t, photo: ph, at: ctx.now, seed: Math.floor(ctx.rand() * 1000) });
    if (p.social.posts.length > 15) p.social.posts.shift();
    return { ok: true, changed: true, data: { followers: followersOf(p) } };
  },
  'social.delete'(ctx, { id }) {
    const p = ctx.profile;
    if (!p.social) return err('Rien à supprimer.');
    p.social.posts = p.social.posts.filter((x) => x.id !== id);
    return { ok: true, changed: true, data: {} };
  },
};
