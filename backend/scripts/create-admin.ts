// Creates (or promotes) an ADMIN user directly against Supabase Auth + the
// database.
//
// The public POST /auth/register endpoint intentionally rejects role:
// "ADMIN" (see src/auth/dto/register.dto.ts) so nobody can self-register as
// an admin - this script is the supported way to provision one instead.
//
// Usage:
//   npm run create-admin -- admin@example.com "S0meStrongPassword!" "Ops Admin"
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set (see
// backend/.env).

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const [, , email, password, name] = process.argv;

  if (!email || !password) {
    console.error('Usage: npm run create-admin -- <email> <password> [name]');
    process.exitCode = 1;
    return;
  }

  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exitCode = 1;
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see backend/.env).',
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    let userId: string;

    if (existing) {
      // Promote an existing account: reset the Supabase password and flip
      // the local role to ADMIN.
      const { error } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password },
      );
      if (error) throw new Error(error.message);
      userId = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name ?? 'Admin', role: 'ADMIN' },
      });
      if (error || !data.user) {
        throw new Error(error?.message ?? 'Failed to create Supabase user');
      }
      userId = data.user.id;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: {
        id: userId,
        email,
        name: name ?? 'Admin',
        role: 'ADMIN',
        balance_usd: 0,
      },
    });

    console.log(`Admin ready: ${user.email} (id: ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
