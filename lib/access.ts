import { supabase } from "@/lib/supabase";

export const ACTION_LABEL: Record<string, string> = {
  open: "開門",
  close: "關門",
  stop: "停止",
};

type LogAccessParams = {
  action: string;
  status: "success" | "denied";
  displayName: string;
  source?: "line" | "web";
  lineUserId?: string | null;
  codeId?: number | null;
};

export async function logAccess(params: LogAccessParams): Promise<void> {
  await supabase.from("access_logs").insert({
    line_user_id: params.lineUserId ?? null,
    display_name: params.displayName,
    action: params.action,
    status: params.status,
    source: params.source ?? "line",
    code_id: params.codeId ?? null,
  });
}

export async function notifyBark(
  displayName: string,
  action: string
): Promise<void> {
  const key = process.env.BARK_KEY;
  if (!key) return;
  const server = process.env.BARK_SERVER ?? "https://api.day.app";
  await fetch(`${server}/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_key: key,
      title: "鐵捲門",
      body: `${displayName} ${ACTION_LABEL[action] ?? action}`,
      group: "garage",
    }),
  });
}
