// After JwtAuthGuard runs, req.user is set to { id, email, role } - see
// auth/guards/jwt-auth.guard.ts. Controllers only ever read req.user.id, so
// this type stays minimal on purpose (not the full Express Request) - that
// also keeps it easy to build a fake req in unit tests.
export type AuthenticatedRequest = {
  user: { id: string };
};
