import type { Metadata } from "next";
import { Nunito, Outfit } from "next/font/google";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "PlayDays",
    template: "%s | PlayDays",
  },
  description: siteConfig.description,
  applicationName: "PlayDays",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "PlayDays",
    description: siteConfig.description,
    type: "website",
    url: siteConfig.url,
    siteName: "PlayDays",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "PlayDays" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlayDays",
    description: siteConfig.description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${nunito.variable} flex min-h-screen flex-col`}>{children}</body>
    </html>
  );
}
