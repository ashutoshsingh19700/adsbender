"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"

import { useAuth } from "@/app/providers/auth-provider"
import { ApiError, login, register } from "@/lib/api"
import { ROLE_HOME } from "@/lib/roles"
import type { UserRole } from "@/lib/types"
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
  password: z.string().min(6, "Password must be at least 6 characters"),
})

// "I'm a Publisher / I'm an Advertiser" — like the marketing header CTAs,
// role picks the article that reads correctly in front of it.
function withArticle(role: AudienceRole) {
  return role === "ADVERTISER" ? "an" : "a"
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useAuth()

  const [mode, setMode] = React.useState<"login" | "register">(
    searchParams.get("tab") === "register" ? "register" : "login"
  )
  const [role, setRole] = React.useState<AudienceRole>(
    searchParams.get("role") === "PUBLISHER" ? "PUBLISHER" : "ADVERTISER"
  )
  const [showPassword, setShowPassword] = React.useState(false)

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  async function afterAuth(userRole: UserRole) {
    await refresh()
    const next = searchParams.get("next")
    router.push(next && next.startsWith("/") ? next : ROLE_HOME[userRole])
    router.refresh()
  }

  async function onLogin(values: z.infer<typeof loginSchema>) {
    try {
      const { user } = await login(values)
      toast.success(`Signed in as ${user.email}`)
      await afterAuth(user.role)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Login failed")
    }
  }

  async function onRegister(values: z.infer<typeof registerSchema>) {
    try {
      await register({ ...values, role })
      toast.success("Account created — signing you in...")
      const { user } = await login({
        email: values.email,
        password: values.password,
      })
      await afterAuth(user.role)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Registration failed"
      )
    }
  }

  const otherRole: AudienceRole = role === "PUBLISHER" ? "ADVERTISER" : "PUBLISHER"

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
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {mode === "login" ? "Log in as " : "Sign up as "}
        {withArticle(role)} <span className="text-orange-600">{ROLE_LABEL[role]}</span>
      </h1>
      <button
        type="button"
        onClick={() => setRole(otherRole)}
        className="mt-2 text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-orange-600"
      >
        I&apos;m {withArticle(otherRole)} {ROLE_LABEL[otherRole]}
      </button>

      {mode === "login" ? (
        <Form {...loginForm}>
          <form
            onSubmit={loginForm.handleSubmit(onLogin)}
            className="mt-6 space-y-4"
          >
            <FormField
              control={loginForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Login / Email *"
                      className="h-12 rounded-xl px-4 text-base"
                      {...field}
                    />
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
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Password *"
                        className="h-12 rounded-xl px-4 pr-11 text-base"
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
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    "Password resets aren't self-serve yet — email support@adsbender.example."
                  )
                }
                className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-orange-600"
              >
                Forgot Password?
              </button>
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
              disabled={loginForm.formState.isSubmitting}
            >
              {loginForm.formState.isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...registerForm}>
          <form
            onSubmit={registerForm.handleSubmit(onRegister)}
            className="mt-6 space-y-4"
          >
            <FormField
              control={registerForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      placeholder="Full name *"
                      className="h-12 rounded-xl px-4 text-base"
                      {...field}
                    />
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
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Email *"
                      className="h-12 rounded-xl px-4 text-base"
                      {...field}
                    />
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
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Password *"
                        className="h-12 rounded-xl px-4 pr-11 text-base"
                        {...field}
                      />
                      {passwordToggle}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
              disabled={registerForm.formState.isSubmitting}
            >
              {registerForm.formState.isSubmitting
                ? "Creating account..."
                : "Create account"}
            </Button>
          </form>
        </Form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have {withArticle(role)} {ROLE_LABEL[role]} account?{" "}
            <button
              type="button"
              onClick={() => setMode("register")}
              className="font-medium text-orange-600 hover:underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-medium text-orange-600 hover:underline"
            >
              Log in
            </button>
          </>
        )}
      </p>
    </div>
  )

  if (mode === "register") {
    return (
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
        {card}
        <SignupBenefits role={role} />
      </div>
    )
  }

  return card
}
