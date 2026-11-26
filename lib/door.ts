import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { publishMQTT, type GarageAction } from "@/lib/mqtt";
import { logAccess, notifyBark, type AccessSource } from "@/lib/access";
import type { Gate } from "@/lib/gates";

type TriggerDoorParams = {
  gate: Gate;
  action: GarageAction;
  displayName: string;
  source: AccessSource;
  lineUserId?: string | null;
  codeId?: number | null;
};

/**
 * 開/關/停的共用流程（LINE、密碼頁、後台、手錶捷徑都走這裡）。
 *
 * 只等 MQTT 送出（失敗就丟錯，讓呼叫端回「發送失敗」）；
 * 寫紀錄和 Bark 推播放在 after()，回應先送出去，不讓使用者多等。
 */
export async function triggerDoor(params: TriggerDoorParams): Promise<void> {
  await publishMQTT(params.gate, params.action);

  after(async () => {
    await logAccess({
      gateId: params.gate.id,
      action: params.action,
      status: "success",
      displayName: params.displayName,
      source: params.source,
      lineUserId: params.lineUserId,
      codeId: params.codeId,
    }).catch((err) => console.error("[door] 寫紀錄失敗", err));
    await notifyBark(params.displayName, params.action).catch(() => {});
  });
}

/** 這扇門在最近 windowMs 內有沒有成功開過（任何來源都算）。 */
export async function openedRecently(gateId: string, windowMs: number): Promise<boolean> {
  const { count } = await supabase
    .from("access_logs")
    .select("id", { count: "exact", head: true })
    .eq("gate_id", gateId)
    .eq("action", "open")
    .eq("status", "success")
    .gte("created_at", new Date(Date.now() - windowMs).toISOString());
  return (count ?? 0) > 0;
}
