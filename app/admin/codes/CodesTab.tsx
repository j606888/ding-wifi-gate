"use client";

import { useState } from "react";
import { DoorCode, shareText } from "../shared";
import CodeForm, { codeToForm, EMPTY_FORM } from "../CodeForm";
import CodeCard from "./CodeCard";

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
  ): Promise<string | null> {
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "建立失敗";
    await load();
    return null;
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

  async function share(c: DoorCode) {
    try {
      await navigator.clipboard.writeText(shareText(c));
      showToast("已複製分享訊息");
    } catch {
      showToast("複製失敗，請手動複製");
    }
  }

  return (
    <div>
      <button
        onClick={() => setShowCreate(true)}
        className="mb-4 w-full rounded-2xl border border-dashed border-zinc-300 py-3 font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        ＋ 新增密碼
      </button>

      {/* 密碼清單 */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"
            >
              <div className="h-7 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-4 w-52 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : codes.length === 0 ? (
        <p className="text-center text-zinc-500">尚無密碼</p>
      ) : (
        <div className="flex flex-col gap-3">
          {codes.map((c) => (
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
          ))}
        </div>
      )}

      {/* 新增密碼 */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                新增密碼
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                取消
              </button>
            </div>
            <CodeForm
              initial={EMPTY_FORM}
              submitLabel="建立"
              savingLabel="建立中…"
              onSubmit={async (body) => {
                const e = await handleCreate(body);
                if (!e) setShowCreate(false);
                return e;
              }}
            />
          </div>
        </div>
      )}

      {/* 編輯密碼 */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                編輯密碼
              </h3>
              <button
                onClick={() => setEditTarget(null)}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                取消
              </button>
            </div>
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
          </div>
        </div>
      )}

      {/* 刪除確認 */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              確定刪除這組密碼？
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-mono">{confirmTarget.code}</span>
              {confirmTarget.label ? `（${confirmTarget.label}）` : ""}
              將被永久刪除，無法復原。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                onClick={() => remove(confirmTarget)}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
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
