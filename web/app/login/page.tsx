import { Suspense } from "react"

import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
