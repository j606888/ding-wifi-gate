import { supabase } from "@/lib/supabase";

export type Gate = {
  id: string;
  slug: string;
  name: string;
  mqtt_topic: string;
};

// 自家的門（scripts/schema.sql 第 5 段建立）。LINE Bot、公開密碼頁、後台目前都只服務它。
const DEFAULT_GATE_SLUG = "home";

let defaultGate: Promise<Gate> | null = null;

/** 預設 gate，同一個 instance 只查一次。 */
export function getDefaultGate(): Promise<Gate> {
  defaultGate ??= getGateBySlug(DEFAULT_GATE_SLUG).then((gate) => {
    if (!gate) throw new Error(`找不到預設 gate「${DEFAULT_GATE_SLUG}」，先跑 scripts/schema.sql`);
    return gate;
  });
  // 查失敗不要把錯誤快取起來
  defaultGate.catch(() => (defaultGate = null));
  return defaultGate;
}

export async function getGateById(id: string): Promise<Gate | null> {
  const { data } = await supabase
    .from("gates")
    .select("id, slug, name, mqtt_topic")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function getGateBySlug(slug: string): Promise<Gate | null> {
  const { data } = await supabase
    .from("gates")
    .select("id, slug, name, mqtt_topic")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}
