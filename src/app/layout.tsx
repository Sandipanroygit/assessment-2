import type { Metadata } from "next";
import localFont from "next/font/local";
import SessionAutoLogout from "@/components/SessionAutoLogout";
import ActivityTracker from "@/components/ActivityTracker";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-surface text-slate-900 dynamic-bg`}
      >
        <ActivityTracker />
        <SessionAutoLogout />
        {children}
      </body>
    </html>
  );
}
