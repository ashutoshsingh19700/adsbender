import { CheckCircle2 } from "lucide-react"

import type { UserRole } from "@/lib/types"

type BenefitGroup = {
  heading: string
  items: string[]
}

// Copy here is written fresh for AdsBender, not lifted from any competitor
// site — figures are illustrative placeholders, not real network stats.
const BENEFITS: Record<Extract<UserRole, "ADVERTISER" | "PUBLISHER">, {
  title: string
  groups: BenefitGroup[]
}> = {
  ADVERTISER: {
    title: "What you get as an advertiser",
    groups: [
      {
        heading: "Reach that converts",
        items: [
          "A growing network of publisher ad zones across dozens of verticals",
          "Popunder, Social Bar, In-Page Push, and Interstitial formats in one place",
          "Coverage spanning iGaming, VPN, dating, e-commerce, and more",
        ],
      },
      {
        heading: "Spend you can control",
        items: [
          "Self-serve dashboard with live budget and pacing controls",
          "Granular targeting by geo, device, OS, and connection type",
          "Automated bidding tools to protect your margin",
        ],
      },
      {
        heading: "Support that scales with you",
        items: [
          "Click-level reporting, not just rollups",
          "Multi-layer fraud filtering on every campaign",
          "Responsive partner support when you need it",
        ],
      },
    ],
  },
  PUBLISHER: {
    title: "What you get as a publisher",
    groups: [
      {
        heading: "Rates that stay competitive",
        items: [
          "Demand competes for your inventory in real time",
          "Consistently strong fill rates across ad zones",
          "An expanding base of active advertiser campaigns",
        ],
      },
      {
        heading: "Payouts on your terms",
        items: [
          "Low minimum payout threshold",
          "A choice of payout methods",
          "Predictable, on-schedule payments",
        ],
      },
      {
        heading: "Formats built for UX",
        items: [
          "Popunder, Social Bar, In-Page Push, and native placements",
          "Fast ad zone review",
          "Built-in anti-malware ad scanning",
        ],
      },
    ],
  },
}

export function SignupBenefits({ role }: { role: UserRole }) {
  const content = role === "PUBLISHER" ? BENEFITS.PUBLISHER : BENEFITS.ADVERTISER

  return (
    <div className="rounded-xl border bg-muted/40 p-6">
      <p className="text-sm font-semibold tracking-wide text-orange-600 uppercase">
        {content.title}
      </p>
      <div className="mt-5 space-y-5">
        {content.groups.map((group) => (
          <div key={group.heading}>
            <p className="border-l-2 border-orange-500 pl-2.5 text-sm font-medium">
              {group.heading}
            </p>
            <ul className="mt-2 space-y-1.5 pl-2.5">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-orange-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
