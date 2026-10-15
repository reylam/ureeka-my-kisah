import { unwrap } from './db.js';

/**
 * Reading progress for the learning centre. Articles are a static frontend
 * module; only the ids a person has read are stored, and only they can see it.
 */

export async function listRead(ctx) {
  const rows = unwrap(
    await ctx.db.from('educational_progress').select('article_id,read_at').eq('profile_id', ctx.userId),
  );
  return rows.map((row) => row.article_id);
}

export async function markRead(ctx, articleId) {
  unwrap(
    await ctx.db
      .from('educational_progress')
      .upsert({ profile_id: ctx.userId, article_id: articleId }, { onConflict: 'profile_id,article_id', ignoreDuplicates: true }),
  );
  return listRead(ctx);
}

export async function markUnread(ctx, articleId) {
  unwrap(
    await ctx.db.from('educational_progress').delete().eq('profile_id', ctx.userId).eq('article_id', articleId),
  );
  return listRead(ctx);
}
