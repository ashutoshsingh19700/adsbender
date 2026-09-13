"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Caveat } from "next/font/google"
import type { GlobeMethods } from "react-globe.gl"

import { COUNTRIES } from "@/app/advertiser/campaign-fields"
import { cn } from "@/lib/utils"

// react-globe.gl renders to a WebGL canvas and touches `document` on import,
// so it can only run in the browser - load it client-side only, after
// mount, never during SSR. The wizard kicks this import off as soon as it
// mounts (see the preloadCountryGlobe() call in campaign-wizard.tsx) instead
// of waiting for the advertiser to reach the Countries step, so by the time
// they get there the chunk is usually already warm and the globe doesn't
// sit on a blank/loading state.
const loadGlobe = () => import("react-globe.gl")
const Globe = dynamic(loadGlobe, { ssr: false })
export function preloadCountryGlobe() {
  void loadGlobe()
}

const caveat = Caveat({ subsets: ["latin"], weight: ["600", "700"] })

const SELECTED_COLOR = "#f43f5e"

type Marker = {
  code: string
  lat: number
  lng: number
  label: string
  color: string
  selected: boolean
}

function buildMarkers(
  selectedCountries: string[],
  pickableCountries: typeof COUNTRIES
): Marker[] {
  const byCode = new Map(pickableCountries.map((c) => [c.value, c]))
  const markers = new Map<string, Marker>()

  // Only countries the advertiser has actually picked get a pin - no
  // pre-marked "showcase" countries, which used to make the globe look like
  // something was already selected before the advertiser touched anything.
  for (const code of selectedCountries) {
    const c = byCode.get(code)
    if (!c) continue
    markers.set(code, { code, lat: c.lat, lng: c.lng, label: c.label, color: SELECTED_COLOR, selected: true })
  }
  return Array.from(markers.values())
}

function createPinElement(marker: Marker, onClick?: (code: string) => void): HTMLElement {
  const wrap = document.createElement("div")
  wrap.style.cssText =
    "transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;"
  wrap.innerHTML = `
    <div style="margin-bottom:4px;white-space:nowrap;border-radius:9999px;background:rgba(255,255,255,.95);box-shadow:0 2px 6px rgba(15,23,42,.18);padding:2px 8px;font-size:11px;font-weight:600;color:#1e293b;">${marker.label}</div>
    <div style="position:relative;width:22px;height:26px;">
      ${
        marker.selected
          ? `<span style="position:absolute;left:50%;top:8px;width:26px;height:26px;margin-left:-13px;margin-top:-13px;border-radius:9999px;background:${marker.color};opacity:.45;animation:globe-pin-pulse 1.8s ease-out infinite;"></span>`
          : ""
      }
      <svg viewBox="0 0 24 28" width="22" height="26" style="position:relative;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));">
        <path d="M12 0C6.75 0 2.5 4.25 2.5 9.5c0 7.13 9.5 18.5 9.5 18.5s9.5-11.37 9.5-18.5C21.5 4.25 17.25 0 12 0z" fill="${marker.color}" />
        <circle cx="12" cy="9.5" r="3.6" fill="white" />
      </svg>
    </div>
  `
  if (onClick) {
    wrap.addEventListener("click", (e) => {
      e.stopPropagation()
      onClick(marker.code)
    })
  }
  return wrap
}

export function CountryGlobe({
  selectedCountries,
  highlightedCountry,
  onToggleCountry,
  // Countries the network actually has publisher supply in - only these get
  // a pin/click target on the globe. Defaults to every country in
  // campaign-fields.ts's COUNTRIES for backward compatibility.
  pickableCountries = COUNTRIES,
}: {
  selectedCountries: string[]
  highlightedCountry?: string
  onToggleCountry?: (code: string) => void
  pickableCountries?: typeof COUNTRIES
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const globeRef = React.useRef<GlobeMethods | undefined>(undefined)
  const [size, setSize] = React.useState({ width: 320, height: 320 })
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 320
      setSize({ width, height: width })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const markers = React.useMemo(
    () => buildMarkers(selectedCountries, pickableCountries),
    [selectedCountries, pickableCountries]
  )

  // Slow idle spin so the globe reads as alive/interactive even before the
  // advertiser touches it; dragging (OrbitControls) takes over on interaction
  // and this resumes automatically once they let go.
  React.useEffect(() => {
    const controls = globeRef.current?.controls?.()
    if (!controls) return
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
  }, [mounted])

  // Spin the globe to face the most recently added/highlighted country.
  React.useEffect(() => {
    if (!highlightedCountry || !globeRef.current) return
    const country = COUNTRIES.find((c) => c.value === highlightedCountry)
    if (!country) return
    globeRef.current.pointOfView(
      { lat: country.lat, lng: country.lng, altitude: 1.8 },
      750
    )
  }, [highlightedCountry])

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px]">
      {/* Soft radial backdrop behind the sphere */}
      <div className="absolute inset-[4%] -z-10 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(125,211,252,0.35),rgba(199,210,254,0.18)_45%,transparent_72%)] blur-lg" />

      {/* Decorative dashed orbit rings */}
      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 text-indigo-300/50"
        aria-hidden
      >
        <ellipse
          cx="50"
          cy="50"
          rx="47"
          ry="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 3"
          transform="rotate(-12 50 50)"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="47"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="2 3"
          transform="rotate(18 50 50)"
          className="text-sky-300/40"
        />
      </svg>

      <div
        ref={containerRef}
        className="absolute inset-[8%] overflow-visible"
        // The stock earth-blue-marble texture reads a bit muddy/dull at this
        // size - punch up saturation/contrast/brightness so the globe feels
        // more lively without swapping the texture itself.
        style={{ filter: "saturate(1.5) brightness(1.12) contrast(1.08)" }}
      >
        {mounted ? (
          <Globe
            ref={globeRef}
            width={size.width}
            height={size.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            showAtmosphere
            atmosphereColor="#38bdf8"
            atmosphereAltitude={0.25}
            htmlElementsData={markers}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.01}
            htmlElement={(d: object) =>
              createPinElement(d as Marker, onToggleCountry)
            }
            animateIn
          />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-full bg-muted" />
        )}
      </div>

      {/* Floating "reach worldwide" card */}
      <div className="absolute bottom-1 left-0 z-20 flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm sm:gap-3 sm:px-3.5 sm:py-2.5">
        <div className="flex -space-x-2.5">
          {[
            "from-orange-400 to-pink-500",
            "from-indigo-500 to-violet-500",
            "from-sky-400 to-cyan-500",
          ].map((gradient, i) => (
            <span
              key={i}
              className={cn(
                "flex size-6 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br text-[10px] font-semibold text-white sm:size-7",
                gradient
              )}
            >
              {["A", "D", "M"][i]}
            </span>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Reach worldwide</p>
          <p className="text-[11px] text-muted-foreground">+195 countries</p>
        </div>
      </div>

      {/* Handwritten flourish */}
      <div className="pointer-events-none absolute -bottom-1 right-0 z-20 flex flex-col items-end text-right">
        <svg width="64" height="42" viewBox="0 0 64 42" className="text-foreground/35">
          <path
            d="M58 6C30 2 14 16 12 36"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="1 5"
            strokeLinecap="round"
          />
          <path
            d="M6 30 L12 38 L19 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p
          className={cn(
            caveat.className,
            "-mt-1 -rotate-3 text-lg leading-tight text-foreground/70 sm:text-xl"
          )}
        >
          Global Opportunities
          <br />
          Await
        </p>
      </div>
    </div>
  )
}
