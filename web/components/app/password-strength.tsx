"use client"

import * as React from "react"
import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"

// Kept in one place so the checklist shown to the user and the pass/fail
// check used to gate submission can never drift apart.
export const PASSWORD_RULES = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    key: "lowercase",
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    key: "uppercase",
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: "number",
    label: "One number",
    test: (value: string) => /\d/.test(value),
  },
  {
    key: "symbol",
    label: "One special character (!@#$...)",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const

export function passwordMeetsAllRules(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}

const STRENGTH_LABEL = ["Very weak", "Weak", "Fair", "Good", "Strong"]
const STRENGTH_BAR_COLOR = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
]

// Real-time checklist shown under the sign-up password field: every rule
// starts grey and flips to green the instant it's satisfied, so the user
// can see exactly what's left before the password counts as "strong".
export function PasswordStrength({ password }: { password: string }) {
  const passedCount = PASSWORD_RULES.filter((rule) => rule.test(password)).length

  // An empty field isn't a weak password, it's just empty - don't scare
  // the user with a red meter before they've typed anything.
  if (password.length === 0) return null

  const strengthIndex = Math.min(Math.max(passedCount - 1, 0), STRENGTH_LABEL.length - 1)

  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {STRENGTH_LABEL.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full bg-muted transition-colors",
                index <= strengthIndex && STRENGTH_BAR_COLOR[strengthIndex]
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            passedCount === PASSWORD_RULES.length
              ? "text-green-600"
              : "text-muted-foreground"
          )}
        >
          {STRENGTH_LABEL[strengthIndex]}
        </span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password)
          return (
            <li
              key={rule.key}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                met ? "text-green-600" : "text-muted-foreground"
              )}
            >
              {met ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <X className="size-3.5 shrink-0" />
              )}
              {rule.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
