import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "云境远征",
  description: "东方奇幻四人组队放置冒险：自动推图、离线挂机、伙伴召唤、装备背包与跨设备云存档。",
  applicationName: "云境远征",
  manifest: "/manifest.webmanifest",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#07191d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
