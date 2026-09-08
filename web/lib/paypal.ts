// Minimal typing for the bits of the PayPal JS SDK this app actually uses.
export type PayPalButtonsOptions = {
  createOrder: () => Promise<string>
  onApprove: (data: { orderID: string }) => Promise<void> | void
  onCancel?: () => void
  onError?: (err: unknown) => void
  style?: Record<string, string | number>
}

type PayPalButtonsInstance = {
  render: (container: HTMLElement) => void
  close: () => Promise<void>
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: PayPalButtonsOptions) => PayPalButtonsInstance
    }
  }
}

const SDK_ID = "paypal-sdk"

let loadPromise: Promise<void> | null = null
let loadedClientId: string | null = null

// Loads the PayPal Checkout JS SDK for a given client id once and caches
// the in-flight/loaded promise. The client id is baked into the script URL
// itself (PayPal has no "configure after load" step), so a different
// client id (e.g. switching sandbox <-> live) re-injects the script.
export function loadPayPalSdk(clientId: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PayPal Checkout requires a browser"))
  }

  if (window.paypal && loadedClientId === clientId) {
    return Promise.resolve()
  }

  if (loadPromise && loadedClientId === clientId) {
    return loadPromise
  }

  document.getElementById(SDK_ID)?.remove()
  loadedClientId = clientId

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.id = SDK_ID
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&currency=USD&intent=capture`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      loadedClientId = null
      reject(new Error("Could not load PayPal Checkout"))
    }
    document.body.appendChild(script)
  })

  return loadPromise
}

// Renders the PayPal Buttons into `container`, replacing whatever was there
// before (re-rendering for a new order re-uses the same container element).
export function renderPayPalButtons(
  container: HTMLElement,
  options: PayPalButtonsOptions
): PayPalButtonsInstance {
  if (!window.paypal) {
    throw new Error("PayPal Checkout did not load")
  }

  const instance = window.paypal.Buttons(options)
  instance.render(container)
  return instance
}
