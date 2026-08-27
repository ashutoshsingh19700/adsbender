import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/app/providers/auth-provider";
import { SiteHeader } from "@/components/app/site-header";
import { SiteFooter } from "@/components/app/site-footer";
import { Toaster } from "@/components/ui/sonner";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_URL,
  jsonLdScriptProps,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every route inherits this unless it exports its own `metadata` /
// `generateMetadata`. `metadataBase` is what lets every page below only
// specify relative OG/Twitter image paths and canonical `alternates.canonical`
// values — Next resolves them against this origin.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    // TODO: set to the real handle once one exists — omitting `site`/
    // `creator` is safer than a placeholder that resolves to nobody.
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Site-wide entity graph. Organization + WebSite are the two
            schema.org types Google uses to understand "who runs this site"
            and to power the sitelinks search box — page-level JSON-LD
            (Service, FAQPage, BreadcrumbList) is added per-route on top of
            this, never instead of it. */}
        <script {...jsonLdScriptProps(organizationJsonLd())} />
        <script {...jsonLdScriptProps(websiteJsonLd())} />
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1 pt-6">{children}</main>
          <SiteFooter />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
