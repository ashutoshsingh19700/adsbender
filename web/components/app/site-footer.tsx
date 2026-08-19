"use client"

import Link from "next/link"
import { AtSign, Mail, MessageCircle, Rss, Send } from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"

type FooterLink = { label: string; href: string }

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Advertisers",
    links: [
      { label: "Benefits for Advertisers", href: "#" },
      { label: "Pricing Models", href: "/pricing-models" },
      { label: "Self-Serve Platform", href: "#" },
      { label: "RTB Traffic", href: "#" },
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
      { label: "Games", href: "#" },
      { label: "E-commerce", href: "#" },
      { label: "Sweepstakes", href: "#" },
      { label: "VPN, Utility & Software", href: "#" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "#" },
      { label: "Case Studies", href: "#" },
      { label: "Glossary", href: "#" },
      { label: "FAQ", href: "#" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact Us", href: "#" },
    ],
  },
]

const SOCIALS = [
  { icon: MessageCircle, href: "#", label: "Community" },
  { icon: AtSign, href: "#", label: "Social" },
  { icon: Rss, href: "#", label: "Blog" },
  { icon: Send, href: "#", label: "Telegram" },
]

// Contact details are placeholders — this is a demo network, not a
// registered company, so nothing here should read as a real legal entity.
export function SiteFooter() {
  const { user, loading } = useAuth()

  // Same rule as the marketing header: signed-in users are on their
  // dashboard, not the public site, so the marketing footer stays hidden.
  if (loading || user) return null

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
                      className="text-sm text-muted-foreground hover:text-orange-600"
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
              className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-orange-600"
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
                  className="flex size-7 items-center justify-center rounded-full border text-muted-foreground hover:border-orange-300 hover:text-orange-600"
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
