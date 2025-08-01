import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pomodoro Together - 集中力を高める共有ポモドーロタイマー",
  description: "オンラインで友達や同僚と集中できる共有ポモドーロタイマー。作業と休憩を効率的に管理し、生産性を向上させましょう。",
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
