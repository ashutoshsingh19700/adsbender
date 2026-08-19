"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Headphones,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const SIGNUP_PATHS = [
  {
    role: "ADVERTISER",
    image: "/signup/advertiser-icon.png",
    title: "As an",
    highlight: "Advertiser",
    description: "Launch powerful campaigns and get high-quality traffic that converts.",
    perks: ["Target real audiences", "Track performance in real-time", "Maximize ROI on every campaign"],
    cta: "Start Advertising",
  },
  {
    role: "PUBLISHER",
    image: "/signup/publisher-icon.png",
    title: "As a",
    highlight: "Publisher",
    description: "Monetize your website, app or social traffic and earn steady payouts.",
    perks: ["Multiple ad formats", "Weekly payouts", "Dedicated support"],
    cta: "Start Earning",
  },
] as const

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Trusted by Marketers",
    description: "Secure, reliable & transparent",
  },
  {
    icon: BarChart3,
    title: "Performance Driven",
    description: "Better traffic. Better results.",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "We're here to help you grow",
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
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="px-6 pt-8 sm:px-10">
          <DialogHeader className="items-center text-center">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-6 items-center justify-center rounded-md bg-orange-500 text-xs font-bold text-white">
                A
              </span>
              AdsBender
            </div>
            <DialogTitle className="mt-3 text-2xl font-bold sm:text-3xl">
              Create your account
            </DialogTitle>
            <DialogDescription className="text-sm">
              Join AdsBender and choose the right way to grow.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-8 grid gap-8 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border">
            <span className="absolute top-1/2 left-1/2 z-10 hidden size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground sm:flex">
              OR
            </span>
            {SIGNUP_PATHS.map((path) => (
              <div
                key={path.role}
                className="flex flex-col items-center gap-3 px-2 pb-8 text-center sm:px-8"
              >
                <Image
                  src={path.image}
                  alt=""
                  width={112}
                  height={82}
                  className="h-auto w-28"
                />
                <div>
                  <p className="text-lg font-semibold">
                    {path.title} <span className="text-orange-500">{path.highlight}</span>
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {path.description}
                  </p>
                </div>
                <ul className="mt-1 space-y-1.5 self-start text-left text-sm">
                  {path.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-orange-500" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-3 w-full bg-orange-500 text-white hover:bg-orange-600"
                >
                  <Link
                    href={`/login?tab=register&role=${path.role}`}
                    onClick={() => setOpen(false)}
                  >
                    {path.cta}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 border-t bg-orange-50/60 px-6 py-6 sm:grid-cols-3 sm:px-10">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="flex items-center gap-2.5">
              <item.icon className="size-5 shrink-0 text-foreground" />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
