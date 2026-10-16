import * as serialize from './serializers.js';

/** The signed-in staff account. */
export function me(ctx) {
  return serialize.account({ id: ctx.userId, email: ctx.email, full_name: ctx.fullName, role: ctx.role });
}

/** Revoke the caller's refresh tokens so the session cannot be resumed elsewhere. */
export async function signOut(ctx) {
  const { error } = await ctx.admin.auth.admin.signOut(ctx.token, 'global');
  // A token that is already gone is not a failure of logging out.
  if (error && !/not found|invalid|expired/i.test(error.message ?? '')) throw error;
}
