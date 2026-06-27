"use client";

import { useEffect, useRef, useState } from "react";
import { DoorCode, Spinner, windowSummary } from "../shared";

export default function CodeCard({
  c,
  nowMs,
  toggling,
  onShare,
  onEdit,
  onToggle,
  onDelete,
}: {
  c: DoorCode;
  nowMs: number;
  toggling: boolean;
  onShare: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasToggling = useRef(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // 停用/啟用是慢 API：保持選單開著顯示 Spinner，完成後自動關閉
  useEffect(() => {
    if (wasToggling.current && !toggling) setMenuOpen(false);
    wasToggling.current = toggling;
  }, [toggling]);

  const expired =
    c.recurrence === "once" &&
    !!c.valid_until &&
    new Date(c.valid_until).getTime() < nowMs;

  const menuItemCls =
    "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-2xl font-semibold tracking-wider text-zinc-900 dark:text-zinc-50">
          {c.code}
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">{c.label}</span>
        {!c.is_active && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            已停用
          </span>
        )}
        {c.is_active && expired && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            已過期
          </span>
        )}
      </div>

      <div className="mt-1 text-sm text-zinc-500">{windowSummary(c)}</div>
      <div className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
        已開門 {c.usage_count} 次
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onShare}
          className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          分享
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="更多操作"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
              <button
                className={menuItemCls}
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                編輯
              </button>
              <button
                className={menuItemCls}
                disabled={toggling}
                onClick={() => onToggle()}
              >
                {toggling ? <Spinner /> : c.is_active ? "停用" : "啟用"}
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                刪除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
