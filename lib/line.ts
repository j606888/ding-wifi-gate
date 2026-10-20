// LINE Messaging API 共用：回覆 / 推播訊息、個人資料、個人 Rich Menu 切換。
// Rich Menu：預設（user/all）是「尚未綁定」選單；開通的人另外綁「已綁定」選單
// （LINE_RICH_MENU_BOUND_ID，由 scripts/setup_rich_menu.sh 建立）。停用就解除綁定，回到預設。

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const API = "https://api.line.me/v2/bot";

function headers(json = true): HeadersInit {
  return json
    ? { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` }
    : { Authorization: `Bearer ${ACCESS_TOKEN}` };
}

export async function replyMessages(replyToken: string, texts: string[]): Promise<void> {
  await fetch(`${API}/message/reply`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      replyToken,
      messages: texts.map((text) => ({ type: "text", text })),
    }),
  });
}

export async function replyMessage(replyToken: string, text: string): Promise<void> {
  await replyMessages(replyToken, [text]);
}

/** 主動推播（會用到免費額度，只在管理員開通時用）。 */
export async function pushMessage(lineUserId: string, text: string): Promise<void> {
  await fetch(`${API}/message/push`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
  });
}

export async function getLineProfile(lineUserId: string): Promise<{ displayName: string }> {
  const res = await fetch(`${API}/profile/${lineUserId}`, { headers: headers(false) });
  if (!res.ok) return { displayName: "" };
  const data = await res.json();
  return { displayName: data.displayName ?? "" };
}

/** 開通 → 綁「已綁定」選單；停用 → 解除，回到預設的「尚未綁定」選單。 */
export async function setBoundRichMenu(lineUserId: string, bound: boolean): Promise<void> {
  const menuId = process.env.LINE_RICH_MENU_BOUND_ID;
  if (bound) {
    if (!menuId) return; // 還沒建立兩種選單時，維持原本的單一選單
    await fetch(`${API}/user/${lineUserId}/richmenu/${menuId}`, {
      method: "POST",
      headers: headers(false),
    });
  } else {
    await fetch(`${API}/user/${lineUserId}/richmenu`, {
      method: "DELETE",
      headers: headers(false),
    });
  }
}
