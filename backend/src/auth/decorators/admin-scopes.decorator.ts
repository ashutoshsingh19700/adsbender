import { SetMetadata } from '@nestjs/common';

export const ADMIN_SCOPES_KEY = 'adminScopes';

// Narrows an @Roles('ADMIN') endpoint to specific AdminScope values -
// MASTER always passes regardless of what's listed here (see
// AdminScopeGuard). Endpoints with no @AdminScopes at all are unrestricted
// (every admin, of any scope, can call them) - only add this where the data
// genuinely belongs to one side of the marketplace.
export const AdminScopes = (...scopes: string[]) =>
  SetMetadata(ADMIN_SCOPES_KEY, scopes);
