import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "古本家の歴史",
  description: "古本家の年表、家系図、家族カレンダーを残すための家族専用サイト。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "古本家の歴史",
    description: "古本家の年表、家系図、家族カレンダー。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
