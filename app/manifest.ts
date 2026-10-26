import type { MetadataRoute } from "next";

// 不設 start_url：從哪一頁加入主畫面就從哪一頁打開（訪客 `/`、管理員 `/admin`）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "丁宅鐵捲門",
    short_name: "鐵捲門",
    display: "standalone",
    background_color: "#f3f1ec",
    theme_color: "#f3f1ec",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
