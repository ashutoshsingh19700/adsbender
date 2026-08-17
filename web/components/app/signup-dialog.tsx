"use client"

import * as React from "react"
import Link from "next/link"
import { Globe2, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const SIGNUP_PATHS = [
  {
    role: "ADVERTISER",
    icon: Megaphone,
    title: "As an Advertiser",
    description: "Launch campaigns and put your offer in front of high-intent traffic.",
    cta: "Start Advertising",
  },
  {
    role: "PUBLISHER",
    icon: Globe2,
    title: "As a Publisher",
    description: "Turn your site, app, or social traffic into steady payouts.",
    cta: "Start Earning",
  },
] as const

// Mirrors the "choose your path" sign-up pattern common on ad networks —
// visitors pick advertiser or publisher before landing on a role-scoped
// register form. Both paths land on the same /login register tab with the
// role pre-selected, so there's one form to maintain, not two.
export function SignUpDialog() {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600">
          Sign up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Sign up</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 pt-2 sm:grid-cols-2 sm:divide-x sm:divide-border">
          {SIGNUP_PATHS.map((path) => (
            <div
              key={path.role}
              className="flex flex-col items-center gap-3 px-2 text-center sm:px-6"
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                <path.icon className="size-6" />
              </div>
              <div>
                <p className="font-semibold">{path.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {path.description}
                </p>
              </div>
              <Button
                asChild
                className="mt-2 w-full bg-orange-500 text-white hover:bg-orange-600"
              >
                <Link
                  href={`/login?tab=register&role=${path.role}`}
                  onClick={() => setOpen(false)}
                >
                  {path.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
