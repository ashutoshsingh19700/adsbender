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

// Validates the token against Supabase directly (auth.getUser), rather than
// verifying a JWT signature locally - this is the real check: it confirms
// the session is still live on Supabase's side (not revoked/expired), not
// just that the token was signed with the right secret at some point.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(data.user.id);

    if (!user) {
      throw new UnauthorizedException();
    }

    (request as Request & { user: unknown }).user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return true;
  }
}
