"use client";

import { useState } from "react";
import { DoorCode, shareText, Sheet } from "../shared";
import CodeForm, { codeToForm, EMPTY_FORM } from "../CodeForm";
import CodeCard, { isDead } from "./CodeCard";
import { PlusIcon } from "@/app/components/icons";

export default function CodesTab({
  codes,
  loading,
  load,
  nowMs,
  showToast,
}: {
  codes: DoorCode[];
  loading: boolean;
  load: () => Promise<void>;
  nowMs: number;
  showToast: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<DoorCode | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<DoorCode | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  async function handleCreate(
    body: Record<string, unknown>
  ): Promise<{ error: string | null; created?: DoorCode }> {
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "建立失敗" };
    await load();
    return { error: null, created: { ...data.code, usage_count: 0 } };
  }

  async function handleUpdate(
    id: number,
    body: Record<string, unknown>
  ): Promise<string | null> {
    const res = await fetch(`/api/admin/codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "更新失敗";
    await load();
    return null;
  }

  async function toggleActive(c: DoorCode) {
    setTogglingId(c.id);
    try {
      await fetch(`/api/admin/codes/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(c: DoorCode) {
    await fetch(`/api/admin/codes/${c.id}`, { method: "DELETE" });
    setConfirmTarget(null);
    await load();
  }

  async function share(c: DoorCode, created = false) {
    try {
      await navigator.clipboard.writeText(shareText(c));
      showToast(created ? "已建立，分享訊息已複製" : "已複製分享訊息");
    } catch {
      // 建立後才複製時，iOS 可能因為不是在點擊當下而拒絕
      showToast(created ? "已建立，按「分享」複製訊息" : "複製失敗，請手動複製");
    }
  }

  const live = codes.filter((c) => !isDead(c, nowMs));
  const dead = codes.filter((c) => isDead(c, nowMs));

  const card = (c: DoorCode) => (
    <CodeCard
      key={c.id}
      c={c}
      nowMs={nowMs}
      toggling={togglingId === c.id}
      onShare={() => share(c)}
      onEdit={() => setEditTarget(c)}
      onToggle={() => toggleActive(c)}
      onDelete={() => setConfirmTarget(c)}
    />
  );

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] lg:gap-4">
      {/* 電腦版：標題列右邊放新增；手機：整條按鈕 */}
      <header className="col-span-full mb-2 hidden items-end justify-between gap-3 lg:flex">
        <div>
          <h1 className="text-[32px] font-bold leading-[44px]">訪客密碼</h1>
          {!loading && (
            <p className="text-[15px] text-muted">
              {live.length} 組可用{dead.length > 0 && ` · ${dead.length} 組已失效`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex h-12 items-center gap-2 rounded-[14px] bg-accent px-5 text-base font-bold text-white transition-colors hover:bg-accent-hover"
        >
          <PlusIcon size={18} />
          新增密碼
        </button>
      </header>
      <button
        onClick={() => setShowCreate(true)}
        className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-accent text-base font-bold text-white transition-colors hover:bg-accent-hover lg:hidden"
      >
        <PlusIcon size={16} />
        新增密碼
      </button>

      {loading ? (
        [0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-4">
            <div className="h-6 w-28 animate-pulse rounded bg-ground" />
            <div className="h-6 w-36 animate-pulse rounded bg-ground" />
            <div className="h-4 w-52 animate-pulse rounded bg-ground" />
            <div className="h-11 animate-pulse rounded-xl bg-ground" />
          </div>
        ))
      ) : codes.length === 0 ? (
        <p className="col-span-full py-8 text-center text-muted">還沒有訪客密碼</p>
      ) : (
        <>
          {live.map(card)}
          {dead.length > 0 && (
            <>
              <h3 className="col-span-full mt-2 text-sm font-bold text-muted lg:mt-6 lg:text-[15px]">
                已失效（{dead.length}）
              </h3>
              {dead.map(card)}
            </>
          )}
        </>
      )}

      {/* 新增密碼 */}
      {showCreate && (
        <Sheet title="新增訪客密碼" onClose={() => setShowCreate(false)}>
          <CodeForm
            initial={EMPTY_FORM}
            submitLabel="建立並分享"
            savingLabel="建立中…"
            onSubmit={async (body) => {
              const { error, created } = await handleCreate(body);
              if (error) return error;
              setShowCreate(false);
              if (created) await share(created, true);
              return null;
            }}
          />
        </Sheet>
      )}

      {/* 編輯密碼 */}
      {editTarget && (
        <Sheet title="編輯訪客密碼" onClose={() => setEditTarget(null)}>
          <CodeForm
            initial={codeToForm(editTarget)}
            submitLabel="儲存"
            savingLabel="儲存中…"
            onSubmit={async (body) => {
              const e = await handleUpdate(editTarget.id, body);
              if (!e) setEditTarget(null);
              return e;
            }}
          />
        </Sheet>
      )}

      {/* 刪除確認 */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-sm rounded-[20px] bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-title" className="text-lg font-bold">
              刪除「{confirmTarget.label}」？
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              密碼 <span className="font-mono font-semibold text-ink">{confirmTarget.code}</span>{" "}
              會永久刪除，無法復原。只是暫時不用的話，可以改成停用。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="h-12 rounded-xl border border-line-strong text-[15px]"
              >
                取消
              </button>
              <button
                onClick={() => remove(confirmTarget)}
                className="h-12 rounded-xl bg-danger text-[15px] font-bold text-white"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
