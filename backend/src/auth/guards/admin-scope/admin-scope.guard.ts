import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ADMIN_SCOPES_KEY } from '../../decorators/admin-scopes.decorator';

// Some routes this guard sits on (e.g. WalletController's payout endpoints)
// are shared between ADMIN and a non-admin role via @Roles('PUBLISHER',
// 'ADMIN') - RolesGuard already confirmed the caller's role is one of those
// allowed roles by the time this runs. This guard only narrows *which*
// admin, so a non-ADMIN caller (already legitimately allowed in by
// RolesGuard) always passes through untouched: an endpoint tagged
// @AdminScopes('PUBLISHER') is off-limits to an ADMIN whose adminScope is
// 'ADVERTISER', but has no bearing on an actual PUBLISHER user. MASTER (and
// a legacy admin with no adminScope set at all, for backward compatibility
// with admins created before scopes existed) always passes.
@Injectable()
export class AdminScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      ADMIN_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || user.role !== 'ADMIN') {
      return true;
    }

    if (!user.adminScope || user.adminScope === 'MASTER') {
      return true;
    }

    if (!requiredScopes.includes(user.adminScope)) {
      throw new ForbiddenException(
        `This action requires the ${requiredScopes.join(' or ')} admin scope.`,
      );
    }

    return true;
  }
}
