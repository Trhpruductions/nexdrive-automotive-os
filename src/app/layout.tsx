import type { Metadata } from "next";
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
  };
}

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
