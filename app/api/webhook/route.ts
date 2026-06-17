import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { publishMQTT } from "@/lib/mqtt";
import { ACTION_LABEL, logAccess, notifyBark } from "@/lib/access";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

const COMMAND_MAP: Record<string, string> = {
  開門: "open",
  開: "open",
  關門: "close",
  關: "close",
  停止: "stop",
  停: "stop",
};

const LABEL_MAP: Record<string, string> = {
  開門: "開門",
  開: "開門",
  關門: "關門",
  關: "關門",
  停止: "停止",
  停: "停止",
};

async function getLineProfile(
  lineUserId: string
): Promise<{ displayName: string }> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) return { displayName: "" };
  const data = await res.json();
  return { displayName: data.displayName ?? "" };
}

async function getOrCreateUser(lineUserId: string): Promise<{
  displayName: string;
  is_active: boolean;
  isNew: boolean;
}> {
  const { data: existing } = await supabase
    .from("users")
    .select("display_name, is_active")
    .eq("line_user_id", lineUserId)
    .single();

  if (existing) {
    return { displayName: existing.display_name ?? "", is_active: existing.is_active, isNew: false };
  }

  const { displayName } = await getLineProfile(lineUserId);
  await supabase.from("users").insert({
    line_user_id: lineUserId,
    display_name: displayName,
    is_active: false,
  });
  return { displayName, is_active: false, isNew: true };
}

function formatAccessTime(isoString: string): string {
  const now = Date.now();
  const ts = new Date(isoString).getTime();
  const diffSec = Math.floor((now - ts) / 1000);

  if (diffSec < 60) return `${diffSec} 秒前`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分鐘前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小時前`;

  const taipeiDate = new Date(ts + 8 * 60 * 60 * 1000);
  const m = String(taipeiDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(taipeiDate.getUTCDate()).padStart(2, "0");
  const h = String(taipeiDate.getUTCHours()).padStart(2, "0");
  const min = String(taipeiDate.getUTCMinutes()).padStart(2, "0");
  return `${m}/${d} ${h}:${min}`;
}

async function getLatestAccessLogs(): Promise<
  { display_name: string; action: string; created_at: string }[]
> {
  const { data } = await supabase
    .from("access_logs")
    .select("display_name, action, created_at")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

async function replyMessage(replyToken: string, text: string): Promise<void> {
  await replyMessages(replyToken, [text]);
}

async function replyMessages(replyToken: string, texts: string[]): Promise<void> {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: texts.map((text) => ({ type: "text", text })),
    }),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const { events } = JSON.parse(body);

  for (const event of events) {
    const lineUserId: string = event.source.userId;

    if (event.type === "follow") {
      const { isNew, displayName } = await getOrCreateUser(lineUserId);
      if (isNew) {
        await replyMessage(
          event.replyToken,
          `你好 ${displayName}！\n你的帳號已建立，請等待管理員開通權限後即可使用。`
        );
      }
      continue;
    }

    if (event.type !== "message" || event.message.type !== "text") continue;

    const text: string = event.message.text.trim();
    const action = COMMAND_MAP[text];

    const { displayName, is_active } = await getOrCreateUser(lineUserId);

    if (text === "誰來了") {
      if (!is_active) {
        await replyMessage(event.replyToken, "你沒有使用權限，請聯絡管理員。");
        continue;
      }
      const logs = await getLatestAccessLogs();
      if (logs.length === 0) {
        await replyMessage(event.replyToken, "目前沒有開門紀錄");
      } else {
        const [latest, ...rest] = logs;
        const toLine = (log: typeof latest) =>
          `${formatAccessTime(log.created_at)} ${log.display_name} ${ACTION_LABEL[log.action] ?? log.action}`;
        const latestLine = toLine(latest);
        if (rest.length === 0) {
          await replyMessage(event.replyToken, latestLine);
        } else {
          const moreBlock = `🌵更多紀錄🌵\n${rest.map(toLine).join("\n")}`;
          await replyMessages(event.replyToken, [latestLine, moreBlock]);
        }
      }
      continue;
    }

    if (text === "後台" || text.toLowerCase() === "admin") {
      await replyMessage(
        event.replyToken,
        "https://ding-wifi-gate.vercel.app/admin"
      );
      continue;
    }

    if (!action) {
      await replyMessage(
        event.replyToken,
        `指令不認識。\n可用指令：開門、關門、停`
      );
      continue;
    }

    if (!is_active) {
      await logAccess({ lineUserId, displayName, action, status: "denied" });
      await replyMessage(event.replyToken, "你沒有使用權限，請聯絡管理員。");
      continue;
    }

    try {
      await publishMQTT(action);
      await logAccess({ lineUserId, displayName, action, status: "success" });
      await replyMessage(event.replyToken, `${LABEL_MAP[text]}成功`);
      notifyBark(displayName, action).catch(() => {});
    } catch {
      await replyMessage(event.replyToken, "發送失敗，請稍後再試");
    }
  }

  return NextResponse.json({ status: "ok" });
}
