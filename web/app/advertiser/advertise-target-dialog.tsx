"use client"

import * as React from "react"
import { Check, Globe, Layers, Smartphone } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type AdvertiseTarget = "website" | "app" | "social_media"

const TARGET_OPTIONS: {
  value: AdvertiseTarget
  label: string
  icon: React.ElementType
}[] = [
  { value: "website", label: "Website", icon: Globe },
  { value: "app", label: "App", icon: Smartphone },
  { value: "social_media", label: "Social media", icon: Layers },
]

export function AdvertiseTargetDialog({
  open,
  onSubmit,
  onClose,
}: {
  open: boolean
  onSubmit: (targets: AdvertiseTarget[], landingUrl: string) => void
  /** Cross button — lets the advertiser back out of the intake step without
   * filling anything in. Only submitting via "Next" enforces the required
   * fields below. */
  onClose?: () => void
}) {
  const [targets, setTargets] = React.useState<AdvertiseTarget[]>([])
  const [landingUrl, setLandingUrl] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  function toggleTarget(value: AdvertiseTarget) {
    setTargets((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value]
    )
    if (error) setError(null)
  }

  function handleNext() {
    if (targets.length === 0) {
      setError("Select at least one option to continue")
      return
    }
    if (!landingUrl.trim()) {
      setError("Enter a landing URL to continue")
      return
    }
    setError(null)
    onSubmit(targets, landingUrl.trim())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose?.()
      }}
    >
      <DialogContent
        showCloseButton={Boolean(onClose)}
        className="sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>What do you want to advertise?</DialogTitle>
          <DialogDescription>
            Pick what you&apos;re promoting and where people should land —
            select as many as apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {TARGET_OPTIONS.map((option) => {
              const selected = targets.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTarget(option.value)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                    selected
                      ? "tile-select text-foreground"
                      : "border-border text-foreground tile-select-hover"
                  )}
                >
                  {selected ? (
                    <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-black text-white">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                  <option.icon className="size-5" />
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="intake-landing-url">Landing URL</Label>
            <Input
              id="intake-landing-url"
              placeholder="https://fakirefashion.com"
              value={landingUrl}
              onChange={(e) => {
                setLandingUrl(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleNext()
                }
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="w-full brand-gradient text-white sm:w-auto"
            onClick={handleNext}
          >
            Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
