import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Two clients, deliberately kept separate:
//
// - `admin` uses the service_role key. It bypasses Row Level Security and
//   can create/delete users outright (auth.admin.*). Server-side only -
//   never construct this with anything but SUPABASE_SERVICE_ROLE_KEY.
// - `anon` uses the public anon key, same as a browser client would. Used
//   for the actual password-grant sign-in, so login goes through the same
//   rate-limited/audited path Supabase applies to any client, rather than
//   the unrestricted admin API.
@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient;
  readonly anon: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
      );
    }

    this.admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Falls back to the service role key only if no anon key is configured,
    // so login still works before SUPABASE_ANON_KEY is copied into
    // backend/.env - but prefer setting it for real deployments.
    this.anon = createClient(url, anonKey ?? serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
