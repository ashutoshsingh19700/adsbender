import { Suspense } from "react"
import Link from "next/link"
import { AtSign, MessageCircle, Send } from "lucide-react"

import { LoginForm } from "./login-form"

// Auth page gets its own minimal chrome (see SiteHeader/SiteFooter route
// checks) — this shell supplies the decorative dot field and the small
// social/copyright row that replace the full marketing footer here.
export default function LoginPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] max-w-xl lg:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(249,115,22,0.4) 1.5px, transparent 1.6px)",
          backgroundSize: "22px 22px",
          WebkitMaskImage:
            "radial-gradient(75% 130% at 90% 100%, black 0%, black 40%, transparent 78%)",
          maskImage:
            "radial-gradient(75% 130% at 90% 100%, black 0%, black 40%, transparent 78%)",
        }}
      />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-16 sm:px-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-4 px-4 pb-8 text-sm text-muted-foreground sm:px-8">
        <Link href="#" aria-label="Community" className="hover:text-orange-600">
          <MessageCircle className="size-4" />
        </Link>
        <Link href="#" aria-label="Social" className="hover:text-orange-600">
          <AtSign className="size-4" />
        </Link>
        <Link href="#" aria-label="Telegram" className="hover:text-orange-600">
          <Send className="size-4" />
        </Link>
        <Link href="#" className="font-medium tracking-wide hover:text-orange-600">
          BLOG
        </Link>
      </div>
    </div>
  )
}
