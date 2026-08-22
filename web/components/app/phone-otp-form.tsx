"use client"

import * as React from "react"
import { toast } from "sonner"

import { ApiError, sendPhoneOtp, verifyPhoneOtp } from "@/lib/api"
import type { AuthUser, UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/app/turnstile-widget"

interface PhoneOtpFormProps {
  // Which role a brand-new account gets if this phone number has never
  // signed in before - mirrors the role toggle above the email/password
  // form. Ignored when the phone already belongs to an existing user.
  role: UserRole
  onSuccess: (user: AuthUser) => void
}

// Alternative to email/password: verify a phone number via a one-time SMS
// code (delegated to Supabase's phone auth - see AuthService.sendPhoneOtp/
// verifyPhoneOtp), then log in or finish signing up in the same step.
export function PhoneOtpForm({ role, onSuccess }: PhoneOtpFormProps) {
  const [phone, setPhone] = React.useState("")
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [step, setStep] = React.useState<"phone" | "code">("phone")
  const [sending, setSending] = React.useState(false)
  const [verifying, setVerifying] = React.useState(false)

  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null)

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault()

    if (!captchaToken) {
      toast.error("Please complete the security check")
      return
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      toast.error("Enter your phone number in international format, e.g. +15551234567")
      return
    }

    setSending(true)
    try {
      await sendPhoneOtp({ phone, captchaToken })
      toast.success(`Code sent to ${phone}`)
      setStep("code")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not send code")
      captchaTokenReset()
    } finally {
      setSending(false)
    }
  }

  function captchaTokenReset() {
    setCaptchaToken(null)
    turnstileRef.current?.reset()
  }

  async function handleVerifyCode(event: React.FormEvent) {
    event.preventDefault()

    if (!code) {
      toast.error("Enter the verification code")
      return
    }

    setVerifying(true)
    try {
      const { user } = await verifyPhoneOtp({
        phone,
        token: code,
        name: name || undefined,
        role,
      })
      toast.success(`Signed in as ${user.email}`)
      onSuccess(user)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Verification failed"
      )
    } finally {
      setVerifying(false)
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter the code sent to <span className="font-medium">{phone}</span>.
        </p>
        {/* Only used if this phone number turns out to be a new account -
            harmless to collect up front alongside the code. */}
        <Input
          placeholder="Full name (new accounts only)"
          className="h-12 rounded-xl px-4 text-base"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Verification code"
          className="h-12 rounded-xl px-4 text-base"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
          disabled={verifying}
        >
          {verifying ? "Verifying..." : "Verify & continue"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("phone")
            setCode("")
          }}
          className="w-full text-center text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-orange-600"
        >
          Use a different number
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <Input
        type="tel"
        autoComplete="tel"
        placeholder="Phone number, e.g. +15551234567"
        className="h-12 rounded-xl px-4 text-base"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <TurnstileWidget ref={turnstileRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
      <Button
        type="submit"
        className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
        disabled={sending || !captchaToken}
      >
        {sending ? "Sending code..." : "Send verification code"}
      </Button>
    </form>
  )
}
