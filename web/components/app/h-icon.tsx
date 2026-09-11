import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

// Thin wrapper around HugeiconsIcon so an icon can still be passed around as
// data (`icon: SomeHugeicon`) and rendered the same way lucide-react icons
// were (`<Icon className="size-4" />`) - keeps every call site that does
// `<item.icon className="..." />` working unchanged.
export function HIcon({
  icon,
  className,
}: {
  icon: IconSvgElement
  className?: string
}) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} />
}

// For spots that need a standalone `React.ComponentType<{ className }>`
// instead of an `icon` prop (e.g. <StatCard icon={...} />) - wrap once at
// module scope, not inside render, so the component identity stays stable.
export function toIconComponent(icon: IconSvgElement) {
  return function IconComponent({ className }: { className?: string }) {
    return <HIcon icon={icon} className={className} />
  }
}
