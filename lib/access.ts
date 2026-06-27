import { supabase } from "@/lib/supabase";
import { ACTION_LABEL } from "@/lib/access-format";

// 為了相容既有 server 端 import（webhook 等），從 client-safe 模組 re-export。
export { ACTION_LABEL, formatAccessTime } from "@/lib/access-format";

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
  const keys = (process.env.BARK_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) return;
  const server = process.env.BARK_SERVER ?? "https://api.day.app";
  const payload = {
    title: "鐵捲門",
    body: `${displayName} ${ACTION_LABEL[action] ?? action}`,
    group: "garage",
  };
  await Promise.all(
    keys.map((key) =>
      fetch(`${server}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, device_key: key }),
      })
    )
  );
}
