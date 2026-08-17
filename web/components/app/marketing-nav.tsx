"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

type MarketingNavItem = {
  title: string
  desc: string
  href: string
}

type MarketingNavGroup = {
  label: string
  items: MarketingNavItem[]
}

// Mirrors the "Advertisers / Publishers / Ad Formats / Free resources / FAQ"
// mega-menu pattern from established ad networks. Only "Pricing Models" has
// a real destination today — everything else is a coming-soon placeholder
// until those pages get built out.
const MARKETING_NAV: MarketingNavGroup[] = [
  {
    label: "Advertisers",
    items: [
      { title: "Benefits for Advertisers", desc: "Why choose AdsBender", href: "#" },
      { title: "Pricing Models", desc: "CPA, CPC, CPM and more", href: "/pricing-models" },
      { title: "RTB Traffic", desc: "How to buy traffic via RTB", href: "#" },
      { title: "Smart CPM", desc: "Automate your CPM bidding strategy", href: "#" },
      { title: "CPA Goal", desc: "Optimize CPM/CPC traffic for conversions", href: "#" },
    ],
  },
  {
    label: "Publishers",
    items: [
      { title: "Benefits for Publishers", desc: "Why monetize with AdsBender", href: "/publishers/benefits" },
      { title: "Ad Monetization", desc: "Turn traffic into revenue", href: "#" },
      { title: "Payment Methods", desc: "Get paid your way", href: "#" },
      { title: "Referral Program", desc: "Earn from your referrals", href: "#" },
    ],
  },
  {
    label: "Ad Formats",
    items: [
      { title: "Popunder", desc: "High-impact full-page ads", href: "/ad-formats/popunder" },
      { title: "Social Bar", desc: "Native, non-intrusive engagement", href: "/ad-formats/social-bar" },
      { title: "In-Page Push", desc: "Push-style native notifications", href: "/ad-formats/in-page-push" },
      { title: "Interstitial", desc: "Full-screen placements between content", href: "/ad-formats/interstitial" },
    ],
  },
  {
    label: "Free resources",
    items: [
      { title: "Blog", desc: "Tips, guides & industry news", href: "#" },
      { title: "Case Studies", desc: "Real results from real campaigns", href: "#" },
      { title: "Glossary", desc: "Ad-tech terms explained", href: "#" },
    ],
  },
  {
    label: "FAQ",
    items: [
      { title: "General FAQ", desc: "Common questions answered", href: "#" },
      { title: "Advertiser FAQ", desc: "Campaigns, billing & targeting", href: "#" },
      { title: "Publisher FAQ", desc: "Payouts, zones & approval", href: "#" },
    ],
  },
]

export function MarketingNav() {
  const [openLabel, setOpenLabel] = React.useState<string | null>(null)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  function open(label: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenLabel(label)
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenLabel(null), 150)
  }

  function handleItemClick(e: React.MouseEvent, item: MarketingNavItem) {
    if (item.href === "#") {
      e.preventDefault()
      toast.info(`${item.title} — coming soon`)
    }
    setOpenLabel(null)
  }

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {MARKETING_NAV.map((group) => (
        <div
          key={group.label}
          className="relative"
          onMouseEnter={() => open(group.label)}
          onMouseLeave={scheduleClose}
        >
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-orange-50 hover:text-orange-600"
            aria-expanded={openLabel === group.label}
          >
            {group.label}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                openLabel === group.label && "rotate-180"
              )}
            />
          </button>

          {openLabel === group.label && (
            <div className="absolute top-full left-0 z-50 w-72 rounded-lg border bg-popover p-2 shadow-xl">
              {group.items.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={(e) => handleItemClick(e, item)}
                  className="block rounded-md px-3 py-2 transition-colors hover:bg-orange-50"
                >
                  <p className="text-sm font-medium text-foreground hover:text-orange-600">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  )
}
