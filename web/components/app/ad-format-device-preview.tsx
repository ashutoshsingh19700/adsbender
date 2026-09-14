"use client"

import * as React from "react"
import {
  Laptop,
  Play,
  Smartphone,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { AdFormatDefinition, PreviewSlot } from "@/lib/ad-formats"

// Real "where will this actually show up" mockup for the ad-format pickers
// in the advertiser's campaign wizard and the publisher's create/edit ad
// zone flows. Every AdFormatDefinition carries a `previewSlot` (see
// lib/ad-formats.ts) that maps to one of the layouts drawn below - a phone
// or laptop screen with a generic site (or email/video player) on it and
// the ad highlighted exactly where it would sit, instead of a plain
// dimensions box.

type Device = "phone" | "laptop"

// Sidebars and hero banners only really make sense on a wider screen -
// default those slots to laptop, everything else defaults to phone since
// that's where most traffic (and most of these formats) actually lands.
const LAPTOP_DEFAULT_SLOTS: PreviewSlot[] = ["sidebar", "hero-banner", "email"]

function AdChip({
  className,
  children,
  small,
}: {
  className?: string
  children?: React.ReactNode
  small?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-[3px] border border-dashed border-violet-400 bg-violet-100/80 font-semibold text-violet-600 dark:border-violet-500 dark:bg-violet-500/20 dark:text-violet-300",
        small ? "text-[6px]" : "text-[7px]",
        className
      )}
    >
      {children ?? "AD"}
    </div>
  )
}

// Skeleton line - stands in for real text/headings in the mock page.
function Line({ w, className }: { w: string; className?: string }) {
  return (
    <div
      className={cn("h-[3px] rounded-full bg-neutral-200 dark:bg-neutral-700", className)}
      style={{ width: w }}
    />
  )
}

function NavBar() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="size-2.5 rounded-sm bg-neutral-800 dark:bg-neutral-200" />
      <Line w="24px" />
      <div className="ml-auto flex gap-1">
        <Line w="8px" />
        <Line w="8px" />
      </div>
    </div>
  )
}

function ContentBlock({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Line w="70%" className="h-[4px]" />
      <Line w="100%" />
      <Line w="92%" />
      <Line w="60%" />
    </div>
  )
}

function FeedCard({ sponsored }: { sponsored?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded border p-1",
        sponsored
          ? "border-dashed border-violet-400 bg-violet-100/80 dark:border-violet-500 dark:bg-violet-500/20"
          : "border-neutral-200 dark:border-neutral-700"
      )}
    >
      <div
        className={cn(
          "size-6 shrink-0 rounded-sm",
          sponsored ? "bg-violet-300 dark:bg-violet-400/40" : "bg-neutral-200 dark:bg-neutral-700"
        )}
      />
      <div className="min-w-0 flex-1 space-y-1">
        {sponsored ? (
          <span className="text-[5px] font-semibold uppercase tracking-wide text-violet-500">
            Sponsored
          </span>
        ) : null}
        <Line w="90%" />
        <Line w="60%" />
      </div>
    </div>
  )
}

function VideoPlayer({ marker }: { marker: "start" | "middle" | "end" | "overlay" }) {
  return (
    <div className="relative w-full overflow-hidden rounded-sm bg-neutral-800" style={{ aspectRatio: "16 / 9" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <Play className="size-4 fill-white/70 text-white/70" />
      </div>
      {marker === "overlay" ? (
        <AdChip className="absolute inset-x-2 bottom-2 h-3">AD</AdChip>
      ) : (
        <AdChip className="absolute inset-0 m-auto h-3 w-10">AD</AdChip>
      )}
      {/* progress bar with a marker at the point this ad plays */}
      <div className="absolute inset-x-1 bottom-1 h-[3px] rounded-full bg-white/30">
        <div
          className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-violet-400"
          style={{
            left: marker === "start" ? "2%" : marker === "middle" ? "48%" : marker === "end" ? "92%" : "0%",
          }}
        />
      </div>
    </div>
  )
}

function Screen({
  device,
  children,
}: {
  device: Device
  children: React.ReactNode
}) {
  if (device === "phone") {
    return (
      <div className="mx-auto w-[190px]">
        <div className="rounded-[26px] border-[6px] border-neutral-900 bg-neutral-900 shadow-lg dark:border-neutral-700">
          <div className="relative h-[360px] overflow-hidden rounded-[20px] bg-white dark:bg-neutral-900">
            <div className="absolute inset-x-0 top-0 z-30 flex h-4 items-center justify-center bg-neutral-900">
              <div className="h-1 w-10 rounded-full bg-neutral-700" />
            </div>
            <div className="absolute inset-0 top-4 flex flex-col">{children}</div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="flex items-center gap-1.5 rounded-t-md border border-b-0 border-neutral-700 bg-neutral-800 px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-red-400" />
        <span className="size-1.5 rounded-full bg-yellow-400" />
        <span className="size-1.5 rounded-full bg-green-400" />
        <div className="ml-2 flex-1 truncate rounded-sm bg-neutral-700 px-2 py-0.5 text-[7px] text-neutral-300">
          yoursite.com
        </div>
      </div>
      <div className="relative flex h-[290px] flex-col overflow-hidden rounded-b-md border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        {children}
      </div>
      <div className="mx-auto h-1.5 w-20 rounded-b-md bg-neutral-300 dark:bg-neutral-700" />
    </div>
  )
}

// Renders the body of the screen for a given slot/device combo. Kept as one
// function (rather than per-slot components) since almost every slot shares
// the same "nav + page" skeleton and only the overlay/highlight differs.
function SlotBody({ slot, device }: { slot: PreviewSlot; device: Device }) {
  const showSidebar = device === "laptop" && (slot === "sidebar" || slot === "floating-side")

  // Email formats replace the whole page with an inbox/email mockup.
  if (slot === "email") {
    return (
      <div className="flex h-full flex-col bg-white p-2 dark:bg-neutral-900">
        <div className="mb-1.5 space-y-1 border-b border-neutral-200 pb-1.5 dark:border-neutral-700">
          <Line w="40%" className="h-[4px]" />
          <Line w="60%" />
        </div>
        <div className="space-y-1.5">
          <Line w="100%" />
          <Line w="90%" />
          <AdChip className="my-1 h-7 w-full">Sponsored · AD</AdChip>
          <Line w="100%" />
          <Line w="70%" />
        </div>
      </div>
    )
  }

  // Video formats replace the content area with a player mockup.
  if (slot.startsWith("video-")) {
    const marker =
      slot === "video-preroll" ? "start" : slot === "video-midroll" ? "middle" : slot === "video-postroll" ? "end" : "overlay"
    return (
      <div className="flex h-full flex-col">
        <NavBar />
        <div className="flex-1 space-y-2 p-2">
          <VideoPlayer marker={marker} />
          <ContentBlock />
        </div>
      </div>
    )
  }

  const mainColumn = (() => {
    switch (slot) {
      case "top-banner":
        return (
          <>
            <AdChip className="h-4 w-full shrink-0">AD</AdChip>
            <div className="space-y-2 p-2">
              <ContentBlock />
              <ContentBlock />
            </div>
          </>
        )
      case "hero-banner":
        return (
          <>
            <AdChip className="h-9 w-full shrink-0">AD</AdChip>
            <div className="space-y-2 p-2">
              <ContentBlock />
              <ContentBlock />
            </div>
          </>
        )
      case "sticky-top":
        return (
          <>
            <div className="shrink-0 p-1">
              <AdChip className="h-4 w-full shadow-sm">
                📌 AD
              </AdChip>
            </div>
            <div className="space-y-2 p-2 pt-0">
              <ContentBlock />
              <ContentBlock />
              <ContentBlock />
            </div>
          </>
        )
      case "native-feed":
        return (
          <div className="space-y-1.5 p-2">
            <FeedCard />
            <FeedCard sponsored />
            <FeedCard />
          </div>
        )
      case "in-content":
        return (
          <div className="space-y-2 p-2">
            <ContentBlock />
            <AdChip className="h-6 w-full">AD</AdChip>
            <ContentBlock />
          </div>
        )
      case "floating-corner":
        return (
          <div className="relative h-full p-2">
            <div className="space-y-2">
              <ContentBlock />
              <ContentBlock />
            </div>
            <AdChip className="absolute bottom-2 right-2 size-8 shadow-md">
              <X className="absolute -right-1 -top-1 size-2.5 rounded-full bg-neutral-700 p-0.5 text-white" />
              AD
            </AdChip>
          </div>
        )
      case "sidebar":
      case "floating-side":
        if (device === "phone") {
          return (
            <div className="space-y-2 p-2">
              <ContentBlock />
              <ContentBlock />
              <AdChip className="h-8 w-full">AD (shown below content on mobile)</AdChip>
            </div>
          )
        }
        return (
          <div className="space-y-2 p-2">
            <ContentBlock />
            <ContentBlock />
          </div>
        )
      default:
        return (
          <div className="space-y-2 p-2">
            <ContentBlock />
            <ContentBlock />
          </div>
        )
    }
  })()

  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{mainColumn}</div>
        {showSidebar ? (
          <div className="w-9 shrink-0 border-l border-neutral-200 p-1 dark:border-neutral-700">
            <AdChip
              className={cn(
                "h-full w-full",
                slot === "floating-side" && "shadow-md ring-1 ring-violet-400"
              )}
            >
              AD
            </AdChip>
          </div>
        ) : null}
      </div>
      {slot === "sticky-bottom" ? (
        <div className="shrink-0 p-1 pt-0">
          <AdChip className="h-4 w-full shadow-sm">📌 AD</AdChip>
        </div>
      ) : null}
    </div>
  )
}

function OverlaySlot({ slot, device }: { slot: PreviewSlot; device: Device }) {
  const isFull = slot === "fullscreen-interstitial" || slot === "welcome-overlay" || slot === "page-transition"

  if (slot === "popunder") {
    return (
      <div className="relative h-full">
        <div className="absolute -right-2 bottom-4 h-[70%] w-[85%] translate-x-2 rounded-sm border border-neutral-300 bg-neutral-100 opacity-70 shadow dark:border-neutral-600 dark:bg-neutral-800" />
        <div className="relative z-10 h-full">
          <SlotBody slot="top-banner" device={device} />
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20 bg-black/70 px-1.5 py-1 text-center text-[6px] font-medium text-white">
          A second window opens behind this one — seen when it&apos;s closed
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div className={cn("h-full", isFull ? "opacity-30" : "")}>
        <SlotBody slot="in-content" device={device} />
      </div>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          isFull ? "bg-white dark:bg-neutral-900" : "bg-black/40"
        )}
      >
        <div
          className={cn(
            "relative flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-violet-400 bg-violet-100/90 p-3 text-center shadow-lg dark:border-violet-500 dark:bg-violet-500/20",
            isFull ? "inset-2 h-[85%] w-[90%]" : "h-16 w-[72%]"
          )}
        >
          {!isFull ? (
            <X className="absolute -right-1.5 -top-1.5 size-3.5 rounded-full bg-neutral-700 p-0.5 text-white" />
          ) : null}
          <span className="text-[7px] font-semibold text-violet-600 dark:text-violet-300">AD</span>
          {slot === "exit-intent" ? (
            <span className="text-[5.5px] text-violet-500">Triggers as the visitor tries to leave</span>
          ) : slot === "welcome-overlay" ? (
            <span className="text-[5.5px] text-violet-500">Shown once, right on arrival</span>
          ) : slot === "fullscreen-interstitial" ? (
            <span className="text-[5.5px] text-violet-500">Covers the whole screen between pages</span>
          ) : slot === "page-transition" ? (
            <span className="text-[5.5px] text-violet-500">Shown briefly while navigating</span>
          ) : null}
        </div>
      </div>
      {isFull ? (
        <div className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[5.5px] font-medium text-white">
          Skip in 5s
        </div>
      ) : null}
    </div>
  )
}

const OVERLAY_SLOTS: PreviewSlot[] = [
  "modal",
  "exit-intent",
  "popunder",
  "welcome-overlay",
  "fullscreen-interstitial",
  "page-transition",
]

export function AdFormatDevicePreview({
  format,
  className,
}: {
  format: AdFormatDefinition | null
  className?: string
}) {
  const slot = format?.previewSlot
  const [device, setDevice] = React.useState<Device>("phone")

  React.useEffect(() => {
    if (!slot) return
    setDevice(LAPTOP_DEFAULT_SLOTS.includes(slot) ? "laptop" : "phone")
  }, [slot])

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Where it shows up
        </p>
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
          <button
            type="button"
            aria-pressed={device === "phone"}
            onClick={() => setDevice("phone")}
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
              device === "phone" ? "bg-violet-600 text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Smartphone className="size-3" /> Phone
          </button>
          <button
            type="button"
            aria-pressed={device === "laptop"}
            onClick={() => setDevice("laptop")}
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
              device === "laptop" ? "bg-violet-600 text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Laptop className="size-3" /> Laptop
          </button>
        </div>
      </div>

      {slot ? (
        <Screen device={device}>
          {OVERLAY_SLOTS.includes(slot) ? (
            <OverlaySlot slot={slot} device={device} />
          ) : (
            <SlotBody slot={slot} device={device} />
          )}
        </Screen>
      ) : (
        <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
          Pick a format to preview it
        </div>
      )}

      {format ? (
        <div className="mt-3 space-y-1 text-center">
          <p className="text-xs font-semibold text-foreground">
            {format.label}{" "}
            <span className="font-normal text-muted-foreground">
              {format.recommendedWidth}×{format.recommendedHeight}
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">{format.description}</p>
        </div>
      ) : null}
    </div>
  )
}
