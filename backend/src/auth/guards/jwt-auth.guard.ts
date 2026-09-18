import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { SupabaseService } from '../../supabase/supabase.service';
import { UsersService } from '../../users/users.service';

export const extractToken = (request: Request): string | null => {
  const cookieToken = request?.cookies?.token;
  if (cookieToken) return cookieToken;

  const header = request?.headers?.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  return null;
};

// How long a validated token's Supabase result is trusted before we hit
// Supabase's Auth API again. Every guarded endpoint calls this guard, and a
// dashboard can fire a dozen+ requests on a single page load - without this
// cache, each of those pays its own live HTTPS round trip to Supabase, which
// is what made production (real network latency to Supabase) feel slow even
// though the login POST itself is fast. 30s keeps revocation/expiry
// responsive while collapsing a burst of requests into one Supabase call.
const TOKEN_CACHE_TTL_MS = 30_000;

type CachedAuth = { userId: string; expiresAt: number };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly tokenCache = new Map<string, CachedAuth>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  // Validates the token against Supabase (auth.getUser), rather than only
  // verifying a JWT signature locally - this is the real check: it confirms
  // the session is still live on Supabase's side (not revoked/expired), not
  // just that the token was signed with the right secret at some point. The
  // result is cached briefly per-token (see TOKEN_CACHE_TTL_MS) so repeated
  // requests with the same token don't each pay a fresh network round trip.
  private async resolveUserId(token: string): Promise<string> {
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.userId;
    }

    // Every new/refreshed token adds an entry that's only ever removed when
    // it's looked up again after expiring - opportunistically sweep stale
    // entries once the map grows large so a long-running process doesn't
    // accumulate tokens from expired sessions indefinitely.
    if (this.tokenCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.tokenCache) {
        if (value.expiresAt <= now) {
          this.tokenCache.delete(key);
        }
      }
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);

    if (error || !data.user) {
      this.tokenCache.delete(token);
      throw new UnauthorizedException();
    }

    this.tokenCache.set(token, {
      userId: data.user.id,
      expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
    });

    return data.user.id;
  }

  // Called on logout so a revoked token stops working immediately instead
  // of remaining valid against this guard for up to TOKEN_CACHE_TTL_MS after
  // Supabase itself has revoked the session - without this, "logout" only
  // cleared the browser cookie while the token (if it had leaked - a proxy
  // log, a browser history entry, malware) stayed live for up to 30s more.
  invalidateToken(token: string): void {
    this.tokenCache.delete(token);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const userId = await this.resolveUserId(token);
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    (request as Request & { user: unknown }).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      adminScope: user.adminScope,
      country: user.country,
    };

    return true;
  }
}
