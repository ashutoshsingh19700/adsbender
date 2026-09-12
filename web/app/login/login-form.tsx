"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import { ApiError, login, register } from "@/lib/api"
import { ROLE_HOME } from "@/lib/roles"
import { cn } from "@/lib/utils"
import type { AuthUser, UserRole } from "@/lib/types"
import { COUNTRIES, countryFlag } from "@/app/advertiser/campaign-fields"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PasswordStrength,
  passwordMeetsAllRules,
} from "@/components/app/password-strength"
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/app/turnstile-widget"
import { GoogleSignInButton } from "@/components/app/google-sign-in-button"
import { PhoneOtpForm } from "@/components/app/phone-otp-form"
import { SignupBenefits } from "./signup-benefits"

type AudienceRole = Extract<UserRole, "ADVERTISER" | "PUBLISHER">

const ROLE_LABEL: Record<AudienceRole, string> = {
  ADVERTISER: "Advertiser",
  PUBLISHER: "Publisher",
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  // Mirrors the checklist in PASSWORD_RULES (password-strength.tsx) so the
  // form can't be submitted with a password the checklist itself still
  // shows as incomplete.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(passwordMeetsAllRules, {
      message: "Password doesn't meet all the requirements below",
    }),
})

// "I'm a Publisher / I'm an Advertiser" — like the marketing header CTAs,
// role picks the article that reads correctly in front of it.
function withArticle(role: AudienceRole) {
  return role === "ADVERTISER" ? "an" : "a"
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()

  const [mode, setMode] = React.useState<"login" | "register">(
    searchParams.get("tab") === "register" ? "register" : "login"
  )
  const [role, setRole] = React.useState<AudienceRole>(
    searchParams.get("role") === "PUBLISHER" ? "PUBLISHER" : "ADVERTISER"
  )
  const [showPassword, setShowPassword] = React.useState(false)
  // Which credential the form collects - email/password stays the default;
  // phone swaps in the OTP mini-flow in place of the password field.
  const [method, setMethod] = React.useState<"email" | "phone">("email")

  // Cloudflare Turnstile token for whichever form (login or register) is
  // currently active - a fresh, single-use token is required per
  // submission, so it's cleared and re-verified after every attempt.
  // Mirrored into a ref (kept in sync in the onVerify handler below) so the
  // register -> auto-login chain can poll for the widget's next token
  // without capturing a stale closure over the state value.
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  const captchaTokenRef = React.useRef<string | null>(null)
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null)

  function handleCaptchaVerify(token: string) {
    captchaTokenRef.current = token
    setCaptchaToken(token)
  }

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  // Country is shared across all three sign-up paths (email/password, phone
  // OTP, Google) rather than living inside registerForm - phone and Google
  // never go through that form at all, so a single piece of state here is
  // simpler than duplicating the field into each sub-flow.
  const [country, setCountry] = React.useState("")

  const registerPassword = registerForm.watch("password")

  function resetCaptcha() {
    captchaTokenRef.current = null
    setCaptchaToken(null)
    turnstileRef.current?.reset()
  }

  // Turnstile tokens are single-use, so the token spent on register() can't
  // also verify the immediate follow-up login() call. Turnstile's default
  // "managed" mode usually re-verifies non-interactively within a second or
  // two of reset(), so poll briefly for the next token instead of asking
  // the user to solve anything twice.
  function waitForNextCaptchaToken(timeoutMs = 8000): Promise<string> {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const poll = () => {
        if (captchaTokenRef.current) {
          resolve(captchaTokenRef.current)
          return
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for security check"))
          return
        }
        setTimeout(poll, 150)
      }
      poll()
    })
  }

  // The login/register/phone/Google responses already carry the full
  // authenticated user, so this sets auth state from that directly rather
  // than issuing a follow-up GET /auth/profile — that call re-validates the
  // token against Supabase's Auth API (a second external round trip on top
  // of the one login() just made) purely to fetch data already in hand,
  // which was adding a very noticeable extra delay before the redirect.
  function afterAuth(user: AuthUser) {
    setUser(user)
    const next = searchParams.get("next")
    router.push(next && next.startsWith("/") ? next : ROLE_HOME[user.role])
    router.refresh()
  }

  // Shared success path for the phone-OTP and Google flows, which each
  // return an already-authenticated user (the session cookie is set by the
  // backend as part of that same request) rather than needing a follow-up
  // login() call like register() does.
  function handleExternalAuthSuccess(user: AuthUser) {
    afterAuth(user)
  }

  async function onLogin(values: z.infer<typeof loginSchema>) {
    if (!captchaToken) {
      toast.error("Please complete the security check")
      return
    }

    try {
      const { user } = await login({ ...values, captchaToken })
      toast.success(`Signed in as ${user.email}`)
      afterAuth(user)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Login failed")
      resetCaptcha()
    }
  }

  async function onRegister(values: z.infer<typeof registerSchema>) {
    if (!country) {
      toast.error("Please select your country")
      return
    }
    if (!captchaToken) {
      toast.error("Please complete the security check")
      return
    }

    try {
      await register({ ...values, role, country, captchaToken })
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Registration failed"
      )
      resetCaptcha()
      return
    }

    toast.success("Account created — signing you in...")
    resetCaptcha()

    try {
      const nextToken = await waitForNextCaptchaToken()
      const { user } = await login({
        email: values.email,
        password: values.password,
        captchaToken: nextToken,
      })
      afterAuth(user)
    } catch {
      toast.error(
        "Account created, but automatic sign-in failed — please log in below."
      )
      resetCaptcha()
      setMode("login")
    }
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((value) => !value)}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  )

  const card = (
    <div className="w-full max-w-md rounded-3xl border bg-card p-5 shadow-lg shadow-black/[0.03] sm:p-6">
      <div className="inline-flex rounded-full border bg-muted/50 p-1">
        {(["ADVERTISER", "PUBLISHER"] as AudienceRole[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRole(option)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
              role === option
                ? "sidebar-pill-gradient text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {ROLE_LABEL[option]}
          </button>
        ))}
      </div>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {mode === "login" ? "Log in as " : "Sign up as "}
        {withArticle(role)}{" "}
        <span className="bg-gradient-to-r from-fuchsia-600 to-pink-500 bg-clip-text text-transparent">
          {ROLE_LABEL[role]}
        </span>
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <button
              type="button"
              onClick={() => {
                resetCaptcha()
                setMode("register")
              }}
              className="font-medium text-violet-600 hover:underline"
            >
              Create an account
            </button>{" "}
            instead.
          </>
        ) : (
          <>
            Already {withArticle(role)} {ROLE_LABEL[role]}?{" "}
            <button
              type="button"
              onClick={() => {
                resetCaptcha()
                setMode("login")
              }}
              className="font-medium text-violet-600 hover:underline"
            >
              Log in
            </button>{" "}
            instead.
          </>
        )}
      </p>

      {mode === "register" ? (
        <div className="mt-5 space-y-1.5">
          <label className="sr-only">Country</label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="h-12 w-full rounded-xl px-3.5 text-base">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {countryFlag(option.value)} {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {method === "phone" ? (
        <div className="mt-6">
          <PhoneOtpForm
            role={role}
            country={mode === "register" ? country : undefined}
            onSuccess={handleExternalAuthSuccess}
          />
        </div>
      ) : mode === "login" ? (
        <Form {...loginForm}>
          <form
            onSubmit={loginForm.handleSubmit(onLogin)}
            className="mt-5 space-y-3"
          >
            <FormField
              control={loginForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="Email address"
                        className="h-12 rounded-xl pl-11 pr-4 text-base"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={loginForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Password"
                        className="h-12 rounded-xl pl-11 pr-11 text-base"
                        {...field}
                      />
                      {passwordToggle}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-muted-foreground hover:text-violet-600"
              >
                Forgot password?
              </Link>
            </div>
            {/* Cloudflare Turnstile - blocks scripted login attempts */}
            <div className="rounded-2xl border bg-muted/30 p-2">
              <TurnstileWidget
                ref={turnstileRef}
                onVerify={handleCaptchaVerify}
                onExpire={() => {
                  captchaTokenRef.current = null
                  setCaptchaToken(null)
                }}
              />
            </div>
            <Button
              type="submit"
              className="brand-gradient btn-shine h-12 w-full rounded-xl border-0 text-base font-semibold text-white"
              disabled={loginForm.formState.isSubmitting || !captchaToken}
            >
              {loginForm.formState.isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...registerForm}>
          <form
            onSubmit={registerForm.handleSubmit(onRegister)}
            className="mt-5 space-y-3"
          >
            <FormField
              control={registerForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoComplete="name"
                        placeholder="Full name"
                        className="h-12 rounded-xl pl-11 pr-4 text-base"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="Email address"
                        className="h-12 rounded-xl pl-11 pr-4 text-base"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Password"
                        className="h-12 rounded-xl pl-11 pr-11 text-base"
                        {...field}
                      />
                      {passwordToggle}
                    </div>
                  </FormControl>
                  <PasswordStrength password={registerPassword ?? ""} />
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Cloudflare Turnstile - blocks scripted/bot sign-ups */}
            <div className="rounded-2xl border bg-muted/30 p-2">
              <TurnstileWidget
                ref={turnstileRef}
                onVerify={handleCaptchaVerify}
                onExpire={() => {
                  captchaTokenRef.current = null
                  setCaptchaToken(null)
                }}
              />
            </div>
            <Button
              type="submit"
              className="brand-gradient btn-shine h-12 w-full rounded-xl border-0 text-base font-semibold text-white"
              disabled={registerForm.formState.isSubmitting || !captchaToken}
            >
              {registerForm.formState.isSubmitting
                ? "Creating account..."
                : "Create account"}
            </Button>
          </form>
        </Form>
      )}

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setMethod(method === "email" ? "phone" : "email")}
          className="text-sm font-medium text-muted-foreground hover:text-violet-600"
        >
          {method === "email"
            ? "Use phone number instead"
            : "Use email and password instead"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-3">
        <GoogleSignInButton
          role={role}
          mode={mode}
          country={mode === "register" ? country : undefined}
          onSuccess={handleExternalAuthSuccess}
          onError={(message) => toast.error(message)}
        />
      </div>
    </div>
  )

  if (mode === "register") {
    return (
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-stretch">
        {card}
        <SignupBenefits role={role} />
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-md justify-center">{card}</div>
  )
}
