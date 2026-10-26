import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

// 中文字型檔很大，不 preload，靠 font-display swap 先用系統字
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  weight: ["400", "500", "700"],
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "鐵捲門",
  description: "用手機開關鐵捲門",
  // Safari「加入主畫面」：全螢幕打開、主畫面上叫「鐵捲門」
  appleWebApp: { capable: true, title: "鐵捲門", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

// viewport-fit=cover 才拿得到 env(safe-area-inset-*)（瀏海、底部 Home 條）
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#f3f1ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTC.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
