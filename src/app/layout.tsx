import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SessionAutoLogout from "@/components/SessionAutoLogout";
import ActivityTracker from "@/components/ActivityTracker";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Curriculum Dashboard | Drones | Experiential Learning | Design Technology",
  description:
    "Launch drone, experiential learning, and design technology programs with Supabase-powered dashboards for schools and educators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="green">
      <body
        className={`${inter.variable} antialiased bg-surface text-slate-900 dynamic-bg`}
      >
        <Suspense fallback={null}>
          <ActivityTracker />
        </Suspense>
        <Suspense fallback={null}>
          <SessionAutoLogout />
        </Suspense>
        <Analytics />
        {children}
      </body>
    </html>
  );
}
