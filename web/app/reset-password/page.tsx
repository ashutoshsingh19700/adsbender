import type { Metadata } from "next"

import { ResetPasswordForm } from "./reset-password-form"

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-16 sm:px-8">
      <ResetPasswordForm />
    </div>
  )
}
