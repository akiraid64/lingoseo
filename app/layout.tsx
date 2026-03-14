import type { Metadata } from "next";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LingoSEO — Multilingual SEO Intelligence",
  description:
    "Scan your GitHub repo, fix multilingual SEO issues with lingo.dev, and push optimized translations via PR.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${spaceMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
