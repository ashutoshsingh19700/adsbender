"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"

import { ApiError, resetPassword } from "@/lib/api"
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
  PasswordStrength,
  passwordMeetsAllRules,
} from "@/components/app/password-strength"

const schema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(passwordMeetsAllRules, {
      message: "Password doesn't meet all the requirements below",
    }),
})

// Supabase's password-recovery email links back here with the session
// tokens in the URL *fragment* (`#access_token=...&type=recovery`), not the
// query string - fragments never leave the browser, so this has to be read
// client-side rather than via useSearchParams/server props.
function useRecoveryAccessToken() {
  const [accessToken, setAccessToken] = React.useState<string | null>(null)
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash
    const params = new URLSearchParams(hash)
    // Bootstraps state from the URL fragment on mount - there's no
    // server-renderable value to initialize from, same reasoning as
    // AuthProvider's refresh() effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccessToken(params.get("access_token"))
    setChecked(true)
  }, [])

  return { accessToken, checked }
}

export function ResetPasswordForm() {
  const router = useRouter()
  const { accessToken, checked } = useRecoveryAccessToken()
  const [showPassword, setShowPassword] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  })

  const password = form.watch("password")

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!accessToken) return

    try {
      await resetPassword({ accessToken, password: values.password })
      setDone(true)
      setTimeout(() => router.push("/login"), 2500)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not reset password"
      )
    }
  }

  if (!checked) return null

  if (!accessToken) {
    return (
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">
          This link is invalid or has expired
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Request a new password reset link and open it from the same
          browser.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-medium text-orange-600 hover:underline"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Password updated</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Redirecting you to log in...
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Set a new password
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="New password *"
                      className="h-12 rounded-xl px-4 pr-11 text-base"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <PasswordStrength password={password ?? ""} />
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
