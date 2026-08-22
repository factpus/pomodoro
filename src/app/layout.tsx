import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegistration from "./components/PwaRegistration";
import DiscordActivityProvider from "./components/DiscordActivityProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pomodoro-app-five-khaki.vercel.app"),
  title: { default: "Pomodoro Together", template: "%s | Pomodoro Together" },
  description: "オンラインで友達や同僚と集中できる共有ポモドーロタイマー。作業と休憩を効率的に管理し、生産性を向上させましょう。",
  manifest: "/manifest.webmanifest",
  openGraph: { title: "Pomodoro Together", description: "仲間と同じリズムで集中できる共有ポモドーロタイマー。", type: "website", locale: "ja_JP" },
  verification: {
    google: "cYKJ41JXEUcmR_I0UyJusbqkQw65TZNhlKUPkr8HN6E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DiscordActivityProvider>{children}</DiscordActivityProvider>
        <PwaRegistration />
      </body>
    </html>
  );
}
