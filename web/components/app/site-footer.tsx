"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AtSign, Mail, MessageCircle, Rss, Send } from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"

// Auth pages (login/register, for either role) use their own minimal
// chrome — the full marketing footer doesn't belong there.
const NO_FOOTER_ROUTES = ["/login", "/forgot-password", "/reset-password"]

type FooterLink = { label: string; href: string }

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Advertisers",
    links: [
      { label: "Benefits for Advertisers", href: "/services" },
      { label: "Pricing Models", href: "/pricing-models" },
      { label: "Self-Serve Platform", href: "/login?tab=register&role=ADVERTISER" },
      // "RTB Traffic" was removed outright, not just unwired — there's no
      // RTB/OpenRTB/bid-request implementation anywhere in the backend
      // (checked ad-engine and the rest of backend/src), so the label
      // itself was advertising a capability that doesn't exist.
    ],
  },
  {
    heading: "Ad Formats",
    links: [
      { label: "Popunder Ads", href: "/ad-formats/popunder" },
      { label: "Social Bar Ads", href: "/ad-formats/social-bar" },
      { label: "In-Page Push", href: "/ad-formats/in-page-push" },
      { label: "Interstitial Ads", href: "/ad-formats/interstitial" },
    ],
  },
  {
    heading: "Verticals",
    links: [
      // No per-vertical landing pages exist — all four route to the
      // pricing-models page, which is where each vertical is actually
      // mapped to a recommended pricing model and ad format today.
      { label: "Games", href: "/pricing-models" },
      { label: "E-commerce", href: "/pricing-models" },
      { label: "Sweepstakes", href: "/pricing-models" },
      { label: "VPN, Utility & Software", href: "/pricing-models" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Case Studies", href: "/case-studies" },
      { label: "Glossary", href: "/glossary" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      // No careers/jobs page exists — left unwired rather than pointed at
      // a guess.
      { label: "Careers", href: "#" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
]

// "Community" and "Social" point at real external profiles (Discord/
// Telegram, X) that don't exist yet — same gap as ORGANIZATION.sameAs in
// lib/seo.ts, left unwired rather than pointed at a guess. "Blog" is an
// in-site link, so it's wired to the real page.
const SOCIALS = [
  { icon: MessageCircle, href: "#", label: "Community" },
  { icon: AtSign, href: "#", label: "Social" },
  { icon: Rss, href: "/blog", label: "Blog" },
  { icon: Send, href: "#", label: "Telegram" },
]

// Contact details are placeholders — this is a demo network, not a
// registered company, so nothing here should read as a real legal entity.
export function SiteFooter() {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // Same rule as the marketing header: signed-in users are on their
  // dashboard, not the public site, so the marketing footer stays hidden.
  if (loading || user) return null
  if (NO_FOOTER_ROUTES.includes(pathname)) return null

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 sm:grid-cols-3 lg:grid-cols-6">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-sm font-medium text-foreground">{col.heading}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-violet-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-sm font-medium text-foreground">Get in touch</p>
            <a
              href="mailto:support@adsbender.example"
              className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-violet-600"
            >
              <Mail className="size-3.5" />
              support@adsbender.example
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t pt-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Follow us:</span>
            <div className="flex items-center gap-3">
              {SOCIALS.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex size-7 items-center justify-center rounded-full border text-muted-foreground hover:border-violet-300 hover:text-violet-600"
                >
                  <social.icon className="size-3.5" />
                </Link>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AdsBender. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
