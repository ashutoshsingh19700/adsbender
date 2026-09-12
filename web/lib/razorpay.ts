// Minimal typing for the bits of the Razorpay Checkout JS SDK this app
// actually uses - the real SDK has no published types.
export type RazorpayCheckoutResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
  handler: (response: RazorpayCheckoutResponse) => void
  modal?: { ondismiss?: () => void }
}

type RazorpayInstance = { open: () => void }

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

let loadPromise: Promise<void> | null = null

// Loads Razorpay's Checkout script once and caches the in-flight/loaded
// promise, so multiple "Add funds" clicks in one session don't inject the
// script tag repeatedly.
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout requires a browser"))
  }

  if (window.Razorpay) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      reject(new Error("Could not load Razorpay Checkout"))
    }
    document.body.appendChild(script)
  })

  return loadPromise
}

export function openRazorpayCheckout(
  options: Omit<RazorpayOptions, "handler">
): Promise<RazorpayCheckoutResponse> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Razorpay Checkout did not load"))
      return
    }

    const instance = new window.Razorpay({
      ...options,
      handler: (response) => resolve(response),
      modal: {
        ...options.modal,
        ondismiss: () => {
          options.modal?.ondismiss?.()
          reject(new Error("DISMISSED"))
        },
      },
    })

    instance.open()
  })
}
