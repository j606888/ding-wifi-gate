import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { publishMQTT } from "@/lib/mqtt";
import { logAccess, notifyBark } from "@/lib/access";
import { signToken } from "@/lib/auth";
import { evaluateCode } from "@/lib/schedule";

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 分鐘
const RATE_MAX_FAILS = 10; // 同 IP 10 分鐘內最多 10 次失敗
const CLOSE_TOKEN_TTL_MS = 30 * 60 * 1000; // 關門 token 最長 30 分鐘

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const now = Date.now();
  const ip = clientIp(req);

  const { code } = await req.json().catch(() => ({ code: "" }));
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "密碼格式錯誤" }, { status: 400 });
  }

  // 速率限制：數同 IP 最近 10 分鐘的失敗次數
  const { count: failCount } = await supabase
    .from("door_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", new Date(now - RATE_WINDOW_MS).toISOString());

  if ((failCount ?? 0) >= RATE_MAX_FAILS) {
    return NextResponse.json(
      { error: "嘗試次數過多，請稍後再試" },
      { status: 429 }
    );
  }

  // 驗證密碼：正確、啟用中、現在落在可用時段內（單次或每週，於 JS 判斷）
  const { data: rows } = await supabase
    .from("door_codes")
    .select(
      "id, label, recurrence, weekdays, start_minute, end_minute, valid_from, valid_until"
    )
    .eq("code", code)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  let codeRow: { id: number; label: string } | null = null;
  let windowEndMs = 0;
  for (const row of rows ?? []) {
    const { valid, windowEndMs: end } = evaluateCode(row, now);
    if (valid) {
      codeRow = { id: row.id, label: row.label };
      windowEndMs = end ?? now;
      break;
    }
  }

  if (!codeRow) {
    await supabase.from("door_attempts").insert({ ip });
    return NextResponse.json(
      { error: "密碼錯誤或不在可用時間內" },
      { status: 401 }
    );
  }

  // 開門
  try {
    await publishMQTT("open");
  } catch {
    return NextResponse.json({ error: "發送失敗，請稍後再試" }, { status: 502 });
  }

  await logAccess({
    action: "open",
    status: "success",
    displayName: `🔑 ${codeRow.label}`,
    source: "web",
    codeId: codeRow.id,
  });
  await notifyBark(`🔑 ${codeRow.label}`, "open").catch(() => {});

  // 關門 token：min(30 分, 本次時段結束時間)
  const ttl = Math.max(0, Math.min(CLOSE_TOKEN_TTL_MS, windowEndMs - now));
  const token = signToken({ codeId: codeRow.id, label: codeRow.label }, ttl, now);

  return NextResponse.json({ status: "ok", label: codeRow.label, token });
}
