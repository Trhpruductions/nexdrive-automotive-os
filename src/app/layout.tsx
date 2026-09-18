import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSettings, accentVars } from "@/lib/settings";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: `${s.name} · NexDrive Automotive OS`, template: `%s · ${s.name}` },
    description: "Complete automotive business management software",
    applicationName: "NexDrive",
    // installable on phones / bay tablets (see manifest.ts)
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: s.shopId ? s.name : "NexDrive" },
    icons: { apple: "/brand/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = { themeColor: "#0b0f19", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={accentVars(s.accentColor)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
