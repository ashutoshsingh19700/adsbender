"use client"

import * as React from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { ApiError, forgotPassword } from "@/lib/api"
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
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/app/turnstile-widget"

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
})

export function ForgotPasswordForm() {
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  function resetCaptcha() {
    setCaptchaToken(null)
    turnstileRef.current?.reset()
  }

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!captchaToken) {
      toast.error("Please complete the security check")
      return
    }

    try {
      await forgotPassword({ ...values, captchaToken })
      // Same generic message the backend returns regardless of whether the
      // email is registered - keeps this endpoint from being used to probe
      // which emails have accounts.
      setSentTo(values.email)
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Something went wrong"
      )
      resetCaptcha()
    }
  }

  if (sentTo) {
    return (
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          If an account exists for {sentTo}, we&apos;ve sent a link to reset
          your password. It may take a few minutes to arrive.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-orange-600 hover:underline"
        >
          Back to log in
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Forgot your password?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email on your account and we&apos;ll send you a link to reset
        it.
      </p>

      <Form {...form}>
        {/* react-hook-form's handleSubmit wraps onSubmit, which only reads
            turnstileRef.current inside an error handler (post-render, on
            submit) - not during render itself. The lint rule can't see
            through handleSubmit's wrapping to confirm that, so it flags a
            false positive here (see web/app/login/login-form.tsx, which
            has the identical pattern). */}
        {/* eslint-disable-next-line react-hooks/refs */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <FormField
            control={form.control}
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
          <TurnstileWidget
            ref={turnstileRef}
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
          />
          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
            disabled={form.formState.isSubmitting || !captchaToken}
          >
            {form.formState.isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-orange-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  )
}
