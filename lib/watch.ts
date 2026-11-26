import { NextRequest, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { clientIp } from "@/lib/auth";
import { findWatchToken, touchWatchToken } from "@/lib/watch-tokens";
import { actedRecently, triggerDoor } from "@/lib/door";
import { ACTION_LABEL, sendBark } from "@/lib/access";
import { getDefaultGate } from "@/lib/gates";

// Apple Watch／iPhone「捷徑」直接呼叫的開門／關門（app/api/watch/{open,close}）。
// 回應是一行純文字，捷徑直接顯示、Siri 直接唸。

export type WatchAction = "open" | "close";

const COOLDOWN_MS = 10 * 1000; // 同一個動作 10 秒內任何來源做過就不再做；開、關各自算
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_FAILS = 10; // 同 IP 10 分鐘內驗證失敗 10 次就擋

const DONE_TEXT: Record<WatchAction, string> = {
  open: "已開門",
  close: "已關門",
};

function text(body: string, status: number, timing?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (timing) headers["Server-Timing"] = timing;
  return new Response(body, { status, headers });
}

export async function handleWatchAction(
  req: NextRequest,
  action: WatchAction
): Promise<Response> {
  const started = Date.now();
  const gate = await getDefaultGate();
  const token = await findWatchToken(req, gate.id);

  if (!token) {
    // token 是 32 bytes 亂數，暴力猜不可能成功；這裡只是擋掉雜訊
    const ip = `watch:${clientIp(req)}`;
    const { count } = await supabase
      .from("door_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", new Date(started - RATE_WINDOW_MS).toISOString());
    if ((count ?? 0) >= RATE_MAX_FAILS) return text("嘗試太多次", 429);
    await supabase.from("door_attempts").insert({ ip });
    return text("驗證失敗", 401);
  }

  if (action === "close" && !token.can_close) {
    return text("沒有關門權限", 403);
  }
  after(() => touchWatchToken(token.id).catch(() => {}));

  // 先驗 token 再看冷卻：陌生人亂打不會讓你自己的手錶卡在冷卻中。
  // 開、關各自冷卻：誤關時還是能馬上按開門補救。
  if (await actedRecently(gate.id, action, COOLDOWN_MS)) {
    return text("冷卻中，請稍後", 429);
  }

  const displayName = `⌚ ${token.name}`;
  const beforeMqtt = Date.now();
  try {
    await triggerDoor({ gate, action, displayName, source: "watch" });
  } catch (err) {
    console.error(`[watch/${action}] MQTT 發送失敗`, err);
    after(() =>
      sendBark(`${displayName} ${ACTION_LABEL[action]}失敗：MQTT 發送失敗`).catch(() => {})
    );
    return text("發送失敗，請再試一次", 502);
  }

  const done = Date.now();
  return text(
    DONE_TEXT[action],
    200,
    `pre;dur=${beforeMqtt - started}, mqtt;dur=${done - beforeMqtt}`
  );
}
