"use client";

import { useEffect, useRef, useState } from "react";
import { codeStatus, nextWindowStartMs, type CodeStatus } from "@/lib/schedule";
import { fmt, fmtDay } from "@/lib/code-format";
import { MoreIcon, ShareIcon } from "@/app/components/icons";
import { DoorCode, Spinner, windowSummary } from "../shared";

const CHIP: Partial<Record<CodeStatus, { label: string; cls: string; dot: string }>> = {
  active: { label: "現在可用", cls: "bg-ok-bg text-ok", dot: "bg-ok-dot" },
  upcoming: { label: "尚未開始", cls: "bg-info-bg text-info-ink", dot: "bg-info-ink" },
  off_window: { label: "時段外", cls: "bg-sunken text-subtle", dot: "bg-muted" },
};

/** 狀態膠囊：現在可用 / 尚未開始 / 時段外（已失效的不顯示） */
export function StatusChip({ status }: { status: CodeStatus }) {
  const chip = CHIP[status];
  if (!chip) return null;
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${chip.cls}`}
    >
      <span className={`h-[7px] w-[7px] rounded-full ${chip.dot}`} />
      {chip.label}
    </span>
  );
}

/** 已過期 / 已停用的密碼：收在「已失效」區塊。 */
export function isDead(c: DoorCode, nowMs: number): boolean {
  const s = codeStatus(c, nowMs);
  return s === "expired" || s === "disabled";
}

function usageText(c: DoorCode): string {
  return c.usage_count > 0 ? `已開門 ${c.usage_count} 次` : "尚未使用";
}

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

  const status = codeStatus(c, nowMs);
  const dead = status === "expired" || status === "disabled";
  const next = status === "off_window" ? nextWindowStartMs(c, nowMs) : null;

  const menuItemCls =
    "flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] text-ink hover:bg-ground";

  const menu = (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={`${c.label}的更多操作`}
        aria-expanded={menuOpen}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-surface text-ink"
      >
        <MoreIcon />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-lg">
          <button
            className={menuItemCls}
            onClick={() => {
              setMenuOpen(false);
              onEdit();
            }}
          >
            編輯
          </button>
          <button className={menuItemCls} disabled={toggling} onClick={() => onToggle()}>
            {toggling ? <Spinner /> : c.is_active ? "停用" : "啟用"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] text-danger hover:bg-danger-bg"
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
  );

  if (dead) {
    const expiredAt = c.valid_until ? fmt(c.valid_until).split(" ")[0] : "";
    return (
      <article className="flex items-center justify-between gap-2 rounded-[18px] bg-faded py-3.5 pl-4 pr-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-bold text-subtle">{c.label}</span>
          <span className="text-[13px] text-muted">
            {status === "disabled" ? "已停用" : `${expiredAt} 已過期`} · {usageText(c)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={status === "disabled" ? onToggle : onEdit}
            disabled={toggling}
            className="h-11 rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink disabled:opacity-45"
          >
            {toggling ? <Spinner /> : status === "disabled" ? "啟用" : "延長"}
          </button>
          {menu}
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-4 lg:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-lg font-bold">{c.label}</h2>
          <span className="font-mono text-xl font-semibold tracking-[0.12em]">
            {c.code.slice(0, 3)} {c.code.slice(3)}
          </span>
        </div>
        <StatusChip status={status} />
      </div>
      <div className="text-sm leading-normal text-muted">
        {windowSummary(c)} · {usageText(c)}
        {next != null && <> · 下次 {fmtDay(next)}</>}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onShare}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface text-[15px] font-medium hover:bg-ground"
        >
          <ShareIcon size={16} />
          分享
        </button>
        {menu}
      </div>
    </article>
  );
}
