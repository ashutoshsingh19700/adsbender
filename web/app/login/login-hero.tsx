import type { UserRole } from "@/lib/types"

type AudienceRole = Extract<UserRole, "ADVERTISER" | "PUBLISHER">

// Dark gradient hero panel shown beside the login/register card - reuses the
// same sidebar-shell tokens (globals.css) as the in-app advertiser sidebar so
// the auth pages read as the same product rather than a bolted-on form.
export function LoginHero({ role }: { role: AudienceRole }) {
  return (
    <div className="sidebar-shell relative hidden overflow-hidden rounded-3xl px-10 py-12 text-white lg:flex lg:flex-col">
      <div className="relative z-10 mt-auto">
        <h2 className="text-4xl font-extrabold tracking-tight sm:text-[2.75rem]">
          Welcome
          <br />
          back.
        </h2>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/60">
          Log in to manage, launch and scale your ad campaigns across every
          channel that matters.
        </p>
      </div>
    </div>
  )
}
