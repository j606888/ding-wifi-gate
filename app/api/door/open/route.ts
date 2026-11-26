import { NextRequest, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { clientIp, matchShortcutToken } from "@/lib/auth";
import { openedRecently, triggerDoor } from "@/lib/door";
import { sendBark } from "@/lib/access";
import { getDefaultGate } from "@/lib/gates";

// Apple Watch／iPhone「捷徑」直接呼叫的開門 endpoint。
// 只能開門（誤關可能壓到人車），回應是一行純文字，捷徑直接顯示、Siri 直接唸。

const COOLDOWN_MS = 10 * 1000; // 10 秒內任何來源開過門就不再開
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_FAILS = 10; // 同 IP 10 分鐘內驗證失敗 10 次就擋

function text(body: string, status: number, timing?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (timing) headers["Server-Timing"] = timing;
  return new Response(body, { status, headers });
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const name = matchShortcutToken(req);

  if (!name) {
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

  const gate = await getDefaultGate();

  // 先驗 token 再看冷卻：陌生人亂打不會讓你自己的手錶卡在冷卻中
  if (await openedRecently(gate.id, COOLDOWN_MS)) {
    return text("冷卻中，請稍後", 429);
  }

  const displayName = `⌚ ${name}`;
  const beforeMqtt = Date.now();
  try {
    await triggerDoor({ gate, action: "open", displayName, source: "watch" });
  } catch (err) {
    console.error("[door/open] MQTT 發送失敗", err);
    after(() => sendBark(`${displayName} 開門失敗：MQTT 發送失敗`).catch(() => {}));
    return text("發送失敗，請再試一次", 502);
  }

  const done = Date.now();
  return text(
    "已開門",
    200,
    `pre;dur=${beforeMqtt - started}, mqtt;dur=${done - beforeMqtt}`
  );
}
