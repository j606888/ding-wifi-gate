// 手錶 token 分頁用的型別與分享訊息（client-safe）

export type WatchToken = {
  id: number;
  name: string;
  token_hint: string;
  can_close: boolean;
  last_used_at: string | null;
  created_at: string;
};

export type WatchTemplates = { open: string; close: string };

/** 給新的人的分享訊息。有捷徑範本連結就請對方匯入，沒有就附手動設定方式。 */
export function watchShareText(
  t: Pick<WatchToken, "can_close">,
  secret: string,
  templates: WatchTemplates,
  origin: string
): string {
  const head = `⌚ 丁宅鐵捲門 Apple Watch ${t.can_close ? "開關門" : "開門"}`;
  const footer = "這組 token 只給你用，請不要轉傳。";

  const links = [
    templates.open && `開門：${templates.open}`,
    t.can_close && templates.close && `關門：${templates.close}`,
  ].filter(Boolean);

  if (links.length > 0) {
    return [
      head,
      "1. 點連結加入捷徑：",
      ...links,
      "2. 加入時會問 token，貼上這串：",
      secret,
      "3. 在捷徑的詳細資訊打開「在 Apple Watch 上顯示」，之後跟 Siri 說捷徑名稱就能用。",
      "",
      footer,
    ].join("\n");
  }

  return [
    head,
    "在「捷徑」App 新增捷徑，加入「取得 URL 的內容」：",
    `網址：${origin}/api/watch/open${t.can_close ? `（關門用 ${origin}/api/watch/close）` : ""}`,
    "方法：POST",
    "標頭：Authorization，值填下面這行（Bearer 後面有空格）",
    `Bearer ${secret}`,
    "再加「顯示結果」，並在詳細資訊打開「在 Apple Watch 上顯示」。",
    "",
    footer,
  ].join("\n");
}
