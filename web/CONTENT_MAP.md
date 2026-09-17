# Content cheat-sheet — where to find page text

Quick reference for which file controls the text/content on each page of
adsbender.com. All paths are relative to `web/`. Routes are Next.js App
Router, so a folder under `app/` = a URL path, and `page.tsx` (or in a few
cases a `*-view.tsx` it renders) is the file with the actual copy.

If a page isn't listed here, or the text you're looking for isn't in the
file you'd expect, search for the exact text across `web/` — whatever file
matches is the one controlling it (see "When this map doesn't help" below).

## Public marketing pages

| Page (URL) | File |
|---|---|
| Home (`/`) | `app/home-view.tsx` (rendered by `app/page.tsx`) |
| About (`/about`) | `app/about/page.tsx` |
| Services (`/services`) | `app/services/page.tsx` |
| Pricing models (`/pricing-models`) | `app/pricing-models/page.tsx` |
| Case studies (`/case-studies`) | `app/case-studies/page.tsx` |
| FAQ (`/faq`) | `app/faq/page.tsx` |
| Glossary (`/glossary`) | `app/glossary/page.tsx` |
| Contact (`/contact`) | `app/contact/page.tsx` |
| Schedule a meeting (`/schedule-meeting`) | `app/schedule-meeting/page.tsx` |
| Blog index (`/blog`) | `app/blog/page.tsx` |
| Blog post (`/blog/[slug]`) | `app/blog/_posts/` (post source files) + `app/blog/[slug]/` (template) |
| Publishers landing (`/publishers`) | `app/publishers/benefits/benefits-view.tsx` (via `app/publishers/benefits/page.tsx`) |
| Ad formats — in-page push | `app/ad-formats/in-page-push/page.tsx` |
| Ad formats — interstitial | `app/ad-formats/interstitial/page.tsx` |
| Ad formats — popunder | `app/ad-formats/popunder/page.tsx` |
| Ad formats — social bar | `app/ad-formats/social-bar/page.tsx` |

## Auth pages

| Page | File |
|---|---|
| Log in (`/login`) | `app/login/page.tsx`, `app/login/login-form.tsx`, `app/login/signup-benefits.tsx` |
| Forgot password | `app/forgot-password/page.tsx`, `app/forgot-password/forgot-password-form.tsx` |
| Reset password | `app/reset-password/page.tsx`, `app/reset-password/reset-password-form.tsx` |
| Sign-up dialog (modal, appears on multiple pages) | `components/app/signup-dialog.tsx` |

## Dashboards (logged-in areas)

| Area | File |
|---|---|
| Admin overview | `app/admin/admin-dashboard.tsx`, `app/admin/admin-overview.tsx` |
| Admin — money flow / revenue | `app/admin/money-flow-panel.tsx`, `app/admin/revenue-panel.tsx` |
| Admin — advertisers list | `app/admin/advertisers/` |
| Admin — publishers list | `app/admin/publishers/` |
| Admin — campaign review | `app/admin/campaign-review-panel.tsx` |
| Admin — payouts | `app/admin/payouts-panel.tsx` |
| Admin — pricing | `app/admin/pricing-panel.tsx` |
| Admin — sites | `app/admin/sites-panel.tsx` |
| Admin — traffic quality | `app/admin/traffic-quality-panel.tsx` |
| Admin — users | `app/admin/users-panel.tsx` |
| Admin — blacklist | `app/admin/blacklist-panel.tsx` |
| Advertiser dashboard | `app/advertiser/advertiser-overview.tsx` |
| Advertiser — campaigns | `app/advertiser/campaign-manager.tsx`, `app/advertiser/campaign-wizard.tsx`, `app/advertiser/campaigns/` |
| Advertiser — statistics | `app/advertiser/statistics/` |
| Advertiser — wallet | `app/advertiser/wallet/` |
| Publisher dashboard | `app/publisher/publisher-dashboard.tsx`, `app/publisher/publisher-overview.tsx` |
| Publisher — ad zones | `app/publisher/ad-zone-manager.tsx` |
| Publisher — websites | `app/publisher/websites/` |
| Publisher — earnings | `app/publisher/earnings/` |
| Publisher — statistics | `app/publisher/statistics/` |
| Analytics dashboard | `app/analytics/analytics-dashboard.tsx` |

## Shared components (affect multiple pages at once)

| Component | Used for |
|---|---|
| `components/app/site-header.tsx` | Top nav bar (logo, "Log in", "Sign up", "For Publishers" etc.) — shown on public pages |
| `components/app/site-footer.tsx` | Footer, shown on public pages |
| `components/app/app-shell.tsx`, `role-aware-shell.tsx` | Overall layout wrapper for logged-in dashboards |
| `components/app/app-sidebar.tsx`, `advertiser-sidebar.tsx`, `publisher-sidebar.tsx`, `mobile-sidebar.tsx` | Dashboard side navigation menus |
| `components/app/advertiser-topbar.tsx`, `publisher-topbar.tsx` | Dashboard top bars |
| `components/app/signup-dialog.tsx` | The signup modal (pops up from multiple entry points) |
| `components/app/stat-card.tsx` | Reusable metric/number card used across dashboards |
| `components/app/breadcrumbs.tsx` | Breadcrumb trail on inner pages |
| `components/app/blog-article.tsx` | Blog post rendering template |
| `components/app/logo.tsx` | Logo mark/wordmark |
| `components/ui/` | Low-level generic UI primitives (buttons, inputs, etc. from shadcn/ui) — edit only for styling, not page copy |

**Editing a shared component changes it everywhere it's used** — check
where else it's imported before changing wording, not just styling.

## When this map doesn't help

- **Text not found in any `.tsx` file**: it's probably pulled dynamically
  from the backend (`../backend/`) or a Supabase table, not hardcoded.
  Search `backend/` for the API route, or check Supabase directly.
- **New pages added after this doc**: rerun the search-by-text method —
  grep the exact on-screen string across `web/app` and `web/components`.
- **SEO metadata (page titles, meta descriptions)**: usually in the same
  `page.tsx`/`layout.tsx` file as an exported `metadata` object, near the
  top of the file.

_Generated 2026-09-18. Update this file if routes are added/renamed._
