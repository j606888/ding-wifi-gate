import { NextRequest, NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { publishMQTT } from "@/lib/mqtt";
import { logAccess, notifyBark } from "@/lib/access";
import { signToken } from "@/lib/auth";

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
  const nowIso = new Date(now).toISOString();
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

  // 驗證密碼：正確、啟用中、現在落在區間內
  const { data: codeRow } = await supabase
    .from("door_codes")
    .select("id, label, valid_until")
    .eq("code", code)
    .eq("is_active", true)
    .lte("valid_from", nowIso)
    .gte("valid_until", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  after(() => notifyBark(`🔑 ${codeRow.label}`, "open").catch(() => {}));

  // 關門 token：min(30 分, 密碼到期時間)
  const validUntilMs = new Date(codeRow.valid_until).getTime();
  const ttl = Math.max(0, Math.min(CLOSE_TOKEN_TTL_MS, validUntilMs - now));
  const token = signToken({ codeId: codeRow.id, label: codeRow.label }, ttl, now);

  return NextResponse.json({ status: "ok", label: codeRow.label, token });
}
