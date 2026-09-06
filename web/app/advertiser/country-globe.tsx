"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { GlobeMethods } from "react-globe.gl"

import { COUNTRIES } from "@/app/advertiser/campaign-fields"

// react-globe.gl renders to a WebGL canvas and touches `document` on import,
// so it can only run in the browser - load it client-side only, after
// mount, never during SSR.
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false })

type GlobePoint = {
  lat: number
  lng: number
  label: string
  code: string
}

export function CountryGlobe({
  selectedCountries,
  highlightedCountry,
}: {
  selectedCountries: string[]
  highlightedCountry?: string
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

  const points: GlobePoint[] = React.useMemo(
    () =>
      COUNTRIES.filter((c) => selectedCountries.includes(c.value)).map(
        (c) => ({ lat: c.lat, lng: c.lng, label: c.label, code: c.value })
      ),
    [selectedCountries]
  )

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
    <div
      ref={containerRef}
      className="mx-auto w-full max-w-[320px] overflow-hidden rounded-full"
    >
      {mounted ? (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => "#f97316"}
          pointAltitude={0.02}
          pointRadius={0.6}
          pointLabel={(d: object) => (d as GlobePoint).label}
          labelsData={points}
          labelLat="lat"
          labelLng="lng"
          labelText={(d: object) => (d as GlobePoint).label}
          labelSize={1.1}
          labelDotRadius={0.4}
          labelColor={() => "#f97316"}
          labelResolution={2}
          animateIn
        />
      ) : (
        <div className="aspect-square w-full animate-pulse rounded-full bg-muted" />
      )}
    </div>
  )
}
