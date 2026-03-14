import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

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
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
