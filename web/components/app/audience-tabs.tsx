"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type AudienceCard = {
  icon: LucideIcon
  title: string
  description: string
}

// Small "Advertisers / Publishers" pill toggle over a card grid — used on
// ad-format pages to show the same feature from both sides of the network
// without duplicating the section.
export function AudienceTabs({
  advertiserCards,
  publisherCards,
  columns = 4,
}: {
  advertiserCards: AudienceCard[]
  publisherCards: AudienceCard[]
  columns?: 3 | 4
}) {
  const [audience, setAudience] = React.useState<"advertisers" | "publishers">(
    "advertisers"
  )
  const cards = audience === "advertisers" ? advertiserCards : publisherCards

  return (
    <div>
      <div className="mx-auto flex w-fit rounded-full border p-1">
        {(["advertisers", "publishers"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setAudience(key)}
            className={cn(
              "rounded-full px-6 py-2 text-sm font-medium capitalize transition-colors",
              audience === key
                ? "bg-neutral-900 text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mt-10 grid gap-8",
          columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {cards.map((card) => (
          <div key={card.title}>
            <div className="flex size-11 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <card.icon className="size-5" />
            </div>
            <h3 className="mt-4 font-medium">{card.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
