import type { NextRequest } from "next/server";
import { handleWatchAction } from "@/lib/watch";

// Apple Watch 捷徑關門（Bearer token，見 lib/watch.ts）
export function POST(req: NextRequest) {
  return handleWatchAction(req, "close");
}
