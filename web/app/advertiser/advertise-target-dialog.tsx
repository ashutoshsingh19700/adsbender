"use client"

import * as React from "react"
import { Globe, Layers, Smartphone } from "lucide-react"

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
}: {
  open: boolean
  onSubmit: (target: AdvertiseTarget, landingUrl: string) => void
}) {
  const [target, setTarget] = React.useState<AdvertiseTarget>("website")
  const [landingUrl, setLandingUrl] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  function handleNext() {
    if (!landingUrl.trim()) {
      setError("Enter a landing URL to continue")
      return
    }
    setError(null)
    onSubmit(target, landingUrl.trim())
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What do you want to advertise?</DialogTitle>
          <DialogDescription>
            Pick what you&apos;re promoting and where people should land.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {TARGET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={target === option.value}
                onClick={() => setTarget(option.value)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                  target === option.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-foreground hover:border-foreground/30"
                )}
              >
                <option.icon className="size-5" />
                {option.label}
              </button>
            ))}
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
          <Button type="button" className="w-full sm:w-auto" onClick={handleNext}>
            Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
