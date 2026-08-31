// Central SEO configuration. Every metadata export and JSON-LD block in the
// app should read from here instead of hardcoding the domain/name/socials —
// one place to update when the domain, brand, or social handles change.

export const SITE_URL = "https://adsbender.com"
export const SITE_NAME = "AdsBender"
export const SITE_LOCALE = "en_US"

export const DEFAULT_TITLE = "AdsBender — Ad Network for Advertisers & Publishers"
export const DEFAULT_DESCRIPTION =
  "AdsBender is a global ad network connecting advertisers and publishers. Launch popunder, social bar, in-page push and interstitial campaigns, or monetize your traffic with high-eCPM ad formats — all from one dashboard."

// Organization identity reused by the Organization JSON-LD block and by
// anything (Twitter card, OG) that needs a canonical "who is this" answer.
export const ORGANIZATION = {
  name: SITE_NAME,
  legalName: "AdsBender",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/adsbender-mark.png`,
  sameAs: [
    // TODO: fill in the real, live profile URLs — placeholders in
    // site-footer.tsx currently point at "#". An Organization/sameAs entry
    // that 404s or points nowhere is worse for E-E-A-T than omitting it.
  ] as string[],
} as const

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

// Shared JSON-LD builders — kept as plain functions (not React components)
// so both server components and route handlers can use them, and so the
// output is trivially JSON.stringify-able into a <script type="application/
// ld+json"> tag.

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: ORGANIZATION.url,
    logo: ORGANIZATION.logo,
    sameAs: ORGANIZATION.sameAs,
  }
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export type BreadcrumbItem = { name: string; path: string }

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function serviceJsonLd(input: {
  name: string
  description: string
  path: string
  serviceType?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    serviceType: input.serviceType,
    url: absoluteUrl(input.path),
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    areaServed: "Worldwide",
  }
}

export function aboutPageJsonLd(input: { path: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${SITE_NAME}`,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntity: organizationJsonLd(),
  }
}

export function contactPageJsonLd(input: { path: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${SITE_NAME}`,
    description: input.description,
    url: absoluteUrl(input.path),
  }
}

export function blogPostingJsonLd(input: {
  title: string
  description: string
  path: string
  datePublished: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    datePublished: input.datePublished,
    dateModified: input.datePublished,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: ORGANIZATION.logo },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(input.path) },
  }
}

export function definedTermSetJsonLd(input: {
  name: string
  path: string
  terms: { term: string; definition: string }[]
}) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: input.name,
    url: absoluteUrl(input.path),
    hasDefinedTerm: input.terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.definition,
      inDefinedTermSet: absoluteUrl(input.path),
    })),
  }
}

export type FaqItem = { question: string; answer: string }

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

// Renders a JSON-LD block as a <script> tag. Usage:
//   <JsonLd data={organizationJsonLd()} />
// Deliberately not a default export — every call site should be explicit
// about what schema it's emitting.
export function jsonLdScriptProps(data: unknown) {
  return {
    type: "application/ld+json" as const,
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  }
}
