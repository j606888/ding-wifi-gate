import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { publishMQTT } from "@/lib/mqtt";
import { getDefaultGate } from "@/lib/gates";
import {
  ACTION_LABEL,
  formatAccessTime,
  logAccess,
  notifyBark,
  sendBark,
} from "@/lib/access";
import { getLineProfile, replyMessage, replyMessages, setBoundRichMenu } from "@/lib/line";
import {
  activateMember,
  markRequested,
  redeemActivationCode,
  redeemBlocked,
} from "@/lib/members";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;

// Rich Menu「尚未綁定」兩個按鈕送出的文字
const ENTER_CODE_TEXT = "輸入啟動碼";
const APPLY_TEXT = "申請使用";

const WELCOME_TEXT = (name: string) =>
  [
    `嗨${name ? ` ${name}` : ""}，這裡是丁宅鐵捲門。`,
    "",
    "有啟動碼：按下面「輸入啟動碼」，輸入後馬上就能開門。",
    "沒有啟動碼：按「申請使用」，屋主開通後會通知你。",
  ].join("\n");

const COMMAND_MAP: Record<string, string> = {
  開門: "open",
  開: "open",
  打開: "open",
  關門: "close",
  關: "close",
  停止: "stop",
  停: "stop",
};

const LABEL_MAP: Record<string, string> = {
  開門: "開門",
  開: "開門",
  打開: "開門",
  關門: "關門",
  關: "關門",
  停止: "停止",
  停: "停止",
};

type LineUser = {
  displayName: string;
  is_active: boolean;
  is_admin: boolean;
  requested_at: string | null;
  isNew: boolean;
};

async function getOrCreateUser(lineUserId: string): Promise<LineUser> {
  let { data: existing, error } = await supabase
    .from("users")
    .select("display_name, is_active, is_admin, requested_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error) {
    // 新欄位還沒建（scripts/schema.sql 第 4 段沒跑）→ 退回舊欄位，已開通的人照常能用
    ({ data: existing, error } = await supabase
      .from("users")
      .select("display_name, is_active")
      .eq("line_user_id", lineUserId)
      .maybeSingle());
  }

  if (existing) {
    return {
      displayName: existing.display_name ?? "",
      is_active: existing.is_active,
      is_admin: existing.is_admin ?? false,
      requested_at: existing.requested_at ?? null,
      isNew: false,
    };
  }

  const { displayName } = await getLineProfile(lineUserId);
  await supabase.from("users").insert({
    line_user_id: lineUserId,
    display_name: displayName,
    is_active: false,
  });
  return { displayName, is_active: false, is_admin: false, requested_at: null, isNew: true };
}

async function getLatestAccessLogs(gateId: string): Promise<
  { display_name: string; action: string; created_at: string }[]
> {
  const { data } = await supabase
    .from("access_logs")
    .select("display_name, action, created_at")
    .eq("gate_id", gateId)
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

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const { events } = JSON.parse(body);
  // LINE Bot 只服務預設 gate；users 表的開通狀態也是對這扇門
  const gate = await getDefaultGate();

  for (const event of events) {
    const lineUserId: string = event.source.userId;

    if (event.type === "follow") {
      const user = await getOrCreateUser(lineUserId);
      if (user.is_active) {
        // 已開通的人封鎖後又加回來：把「已綁定」選單綁回去
        await setBoundRichMenu(lineUserId, true).catch(() => {});
        await replyMessage(event.replyToken, `歡迎回來 ${user.displayName}，可以用下面的按鈕開關門。`);
      } else {
        await replyMessage(event.replyToken, WELCOME_TEXT(user.displayName));
      }
      continue;
    }

    if (event.type !== "message" || event.message.type !== "text") continue;

    const text: string = event.message.text.trim();
    const action = COMMAND_MAP[text];
    const user = await getOrCreateUser(lineUserId);
    const { displayName } = user;

    if (!user.is_active) {
      await handleInactive(event.replyToken, gate.id, lineUserId, user, text, action);
      continue;
    }

    // 「誰來了」「後台」只給管理員；其他人當成一般訊息
    if (user.is_admin && text === "誰來了") {
      await replyWhoCame(event.replyToken, gate.id);
      continue;
    }
    if (user.is_admin && (text === "後台" || text.toLowerCase() === "admin")) {
      await replyMessage(event.replyToken, "https://ding-wifi-gate.vercel.app/admin");
      continue;
    }

    // 已開通但選單還停在「尚未綁定」（例如剛建立兩種選單前就開通的人）
    if (text === ENTER_CODE_TEXT || text === APPLY_TEXT || /^\d{6}$/.test(text)) {
      await setBoundRichMenu(lineUserId, true).catch(() => {});
      await replyMessage(event.replyToken, "你已經開通了，可以用下面的按鈕開關門。");
      continue;
    }

    if (!action) {
      await replyMessage(
        event.replyToken,
        `指令不認識。\n可用指令：開門、關門、停`
      );
      continue;
    }

    try {
      await publishMQTT(gate, action);
      await logAccess({ gateId: gate.id, lineUserId, displayName, action, status: "success" });
      await replyMessage(event.replyToken, `${LABEL_MAP[text]}成功`);
      await notifyBark(displayName, action).catch(() => {});
    } catch {
      await replyMessage(event.replyToken, "發送失敗，請稍後再試");
    }
  }

  return NextResponse.json({ status: "ok" });
}

// 還沒開通的人：輸入啟動碼 / 申請使用 / 按開門（記成申請）/ 其他訊息（再講一次怎麼用）
async function handleInactive(
  replyToken: string,
  gateId: string,
  lineUserId: string,
  user: LineUser,
  text: string,
  action: string | undefined
): Promise<void> {
  const { displayName } = user;

  if (text === ENTER_CODE_TEXT) {
    await replyMessage(replyToken, "請直接傳 6 位數啟動碼給我。");
    return;
  }

  if (/^\d{6}$/.test(text)) {
    if (await redeemBlocked(lineUserId)) {
      await replyMessage(replyToken, "輸入錯誤太多次，請 10 分鐘後再試。");
      return;
    }
    const code = await redeemActivationCode(gateId, lineUserId, text);
    if (!code) {
      await replyMessage(replyToken, "啟動碼不正確或已經過期，請跟屋主確認。");
      return;
    }
    await activateMember(lineUserId, "code", code.id);
    await replyMessages(replyToken, [
      `開通成功！${displayName}，現在可以用下面的按鈕開關門了。\n關門前記得確認門下沒有人、車或寵物。`,
    ]);
    const via = code.label ? `（${code.label}）` : "";
    await sendBark(`${displayName || "有人"} 用啟動碼開通了${via}`).catch(() => {});
    return;
  }

  if (text === APPLY_TEXT || action) {
    if (action) {
      await logAccess({ gateId, lineUserId, displayName, action, status: "denied" });
    }
    const fresh = await markRequested(
      lineUserId,
      action ? (action as "open" | "close" | "stop") : "apply",
      user.requested_at
    );
    if (fresh) {
      await sendBark(`${displayName || "有人"} 申請使用鐵捲門，到後台開通`).catch(() => {});
    }
    await replyMessage(
      replyToken,
      action
        ? "你還沒開通，已經通知屋主了。有啟動碼的話直接傳給我，馬上就能用。"
        : "已經通知屋主了。開通後我會傳訊息給你，到時候下面的選單就會換成開門按鈕。"
    );
    return;
  }

  await replyMessage(replyToken, WELCOME_TEXT(displayName));
}

async function replyWhoCame(replyToken: string, gateId: string): Promise<void> {
  const logs = await getLatestAccessLogs(gateId);
  if (logs.length === 0) {
    await replyMessage(replyToken, "目前沒有開門紀錄");
    return;
  }
  const [latest, ...rest] = logs;
  const toLine = (log: typeof latest) =>
    `${formatAccessTime(log.created_at)} ${log.display_name} ${ACTION_LABEL[log.action] ?? log.action}`;
  const latestLine = toLine(latest);
  if (rest.length === 0) {
    await replyMessage(replyToken, latestLine);
  } else {
    const moreBlock = `🌵更多紀錄🌵\n${rest.map(toLine).join("\n")}`;
    await replyMessages(replyToken, [latestLine, moreBlock]);
  }
}
