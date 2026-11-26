"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAccessTime } from "@/lib/access-format";
import { PlusIcon, ShareIcon } from "@/app/components/icons";
import { inputCls, Sheet, Spinner } from "../shared";
import { watchShareText, type WatchTemplates, type WatchToken } from "./format";

// 後台「手錶」：Apple Watch 捷徑的 token。明文只在建立／刷新時顯示一次。

type Issued = { token: WatchToken; secret: string; rotated: boolean };

export default function WatchTab({ showToast }: { showToast: (msg: string) => void }) {
  const router = useRouter();
  const [tokens, setTokens] = useState<WatchToken[]>([]);
  const [templates, setTemplates] = useState<WatchTemplates>({ open: "", close: "" });
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<number | null>(null);
  // 刷新／刪除要按第二次才執行
  const [confirm, setConfirm] = useState<{ id: number; kind: "rotate" | "delete" } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/watch-tokens");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setTokens(data.tokens ?? []);
    setTemplates(data.templates ?? { open: "", close: "" });
    setNowMs(Date.now());
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // 進分頁時載入（取資料後才 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function patch(t: WatchToken, body: Record<string, unknown>) {
    setBusyId(t.id);
    setConfirm(null);
    try {
      const res = await fetch(`/api/admin/watch-tokens/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("更新失敗，請再試一次");
        return null;
      }
      await load();
      return data as { token: WatchToken; secret?: string };
    } finally {
      setBusyId(null);
    }
  }

  async function toggleClose(t: WatchToken) {
    const data = await patch(t, { canClose: !t.can_close });
    if (data) showToast(t.can_close ? `${t.name} 不能再關門了` : `${t.name} 可以關門了`);
  }

  async function rotate(t: WatchToken) {
    const data = await patch(t, { rotate: true });
    if (data?.secret) setIssued({ token: data.token, secret: data.secret, rotated: true });
  }

  async function remove(t: WatchToken) {
    setBusyId(t.id);
    setConfirm(null);
    try {
      const res = await fetch(`/api/admin/watch-tokens/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("刪除失敗，請再試一次");
        return;
      }
      await load();
      showToast(`已刪除 ${t.name}，這組 token 立刻失效`);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[18px] bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 hidden lg:block">
        <h1 className="text-[32px] font-bold leading-[44px]">手錶</h1>
        <p className="text-[15px] text-muted">
          用 Apple Watch／iPhone 捷徑直接開關門。每個人一組 token，手錶掉了就刷新或刪除。
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:max-w-[720px]">
        {tokens.length === 0 && (
          <p className="rounded-[18px] border border-line bg-surface p-5 text-center text-[15px] text-muted">
            還沒有人有手錶權限
          </p>
        )}

        {tokens.map((t) => {
          const busy = busyId === t.id;
          const pending = confirm?.id === t.id ? confirm.kind : null;
          const last = t.last_used_at ? formatAccessTime(t.last_used_at, nowMs) : "還沒用過";
          return (
            <article
              key={t.id}
              className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 lg:px-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-bold">{t.name}</span>
                  <span className="truncate text-[13px] text-muted">
                    <span className="font-mono">…{t.token_hint}</span> · 上次 {last}
                  </span>
                </div>
                <span className="text-[13px] text-muted">可以關門</span>
                <button
                  role="switch"
                  aria-checked={t.can_close}
                  aria-label={`${t.name}可以用手錶關門`}
                  disabled={busy}
                  onClick={() => toggleClose(t)}
                  className={`flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-60 ${
                    t.can_close ? "justify-end bg-ok" : "justify-start bg-line-strong"
                  }`}
                >
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white text-muted shadow-sm">
                    {busy && <Spinner />}
                  </span>
                </button>
              </div>

              {pending ? (
                <div className="flex flex-col gap-2 rounded-2xl bg-warn-bg p-3">
                  <p className="text-[13px] text-warn-ink">
                    {pending === "rotate"
                      ? `舊的 token 會立刻失效，${t.name} 要把新的貼進捷徑才能再用。`
                      : `${t.name} 的手錶會立刻不能開關門。`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (pending === "rotate" ? rotate(t) : remove(t))}
                      disabled={busy}
                      className="h-11 flex-1 rounded-xl bg-danger px-4 text-[15px] font-bold text-white disabled:opacity-45"
                    >
                      {pending === "rotate" ? "確定刷新" : "確定刪除"}
                    </button>
                    <button
                      onClick={() => setConfirm(null)}
                      className="h-11 rounded-xl border border-line-strong bg-surface px-4 text-[15px]"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirm({ id: t.id, kind: "rotate" })}
                    disabled={busy}
                    className="h-11 flex-1 rounded-xl border border-line-strong bg-surface text-[15px] font-medium hover:bg-ground disabled:opacity-45"
                  >
                    刷新 token
                  </button>
                  <button
                    onClick={() => setConfirm({ id: t.id, kind: "delete" })}
                    disabled={busy}
                    className="h-11 rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-danger hover:bg-danger-bg disabled:opacity-45"
                  >
                    刪除
                  </button>
                </div>
              )}
            </article>
          );
        })}

        <button
          onClick={() => setShowCreate(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-white transition-colors hover:bg-accent-hover"
        >
          <PlusIcon size={18} />
          新增手錶權限
        </button>

        {!templates.open && (
          <p className="text-[13px] leading-relaxed text-muted">
            還沒設定捷徑範本連結（<code>WATCH_SHORTCUT_OPEN_URL</code>／<code>WATCH_SHORTCUT_CLOSE_URL</code>），
            分享訊息會改附手動設定步驟。
          </p>
        )}
      </div>

      {showCreate && (
        <Sheet title="新增手錶權限" onClose={() => setShowCreate(false)}>
          <CreateForm
            onCreated={async (token, secret) => {
              setShowCreate(false);
              await load();
              setIssued({ token, secret, rotated: false });
            }}
          />
        </Sheet>
      )}

      {issued && (
        <Sheet title={issued.rotated ? "新的 token" : "已建立"} onClose={() => setIssued(null)}>
          <IssuedView issued={issued} templates={templates} showToast={showToast} />
        </Sheet>
      )}
    </>
  );
}

function CreateForm({ onCreated }: { onCreated: (t: WatchToken, secret: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [canClose, setCanClose] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/watch-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, canClose }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "建立失敗");
        return;
      }
      await onCreated(data.token, data.secret);
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[22px] px-5 pb-4 pt-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="wt-name" className="text-sm font-bold">
            給誰用
          </label>
          <input
            id="wt-name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 老婆"
            className={inputCls}
          />
          <span className="text-[13px] text-muted">紀錄和推播會顯示成「⌚ 名字」</span>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">可以關門</span>
            <span className="text-[13px] text-muted">關門時看不到門下，確定對方懂再打開</span>
          </div>
          <button
            role="switch"
            aria-checked={canClose}
            aria-label="可以用手錶關門"
            onClick={() => setCanClose((v) => !v)}
            className={`flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition-colors ${
              canClose ? "justify-end bg-ok" : "justify-start bg-line-strong"
            }`}
          >
            <span className="h-[26px] w-[26px] rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-ground px-5 pb-[max(env(safe-area-inset-bottom),32px)] pt-3">
        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-45"
        >
          {saving ? "建立中…" : "建立"}
        </button>
      </div>
    </div>
  );
}

function IssuedView({
  issued,
  templates,
  showToast,
}: {
  issued: Issued;
  templates: WatchTemplates;
  showToast: (msg: string) => void;
}) {
  const { token, secret } = issued;

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(done);
    } catch {
      showToast("複製失敗，請長按手動複製");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-[22px] px-5 pb-[max(env(safe-area-inset-bottom),32px)] pt-3">
      <p className="rounded-2xl bg-warn-bg px-4 py-3 text-[15px] text-warn-ink">
        這組 token 只會顯示這一次，關掉這個畫面就看不到了。忘記的話按「刷新 token」重發一組。
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">{token.name} 的 token</span>
        <code className="select-all break-all rounded-2xl border border-line bg-surface px-4 py-3.5 font-mono text-[15px]">
          {secret}
        </code>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() =>
            copy(
              watchShareText(token, secret, templates, window.location.origin),
              "已複製分享訊息，貼到 LINE 給對方"
            )
          }
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-bold text-white transition-colors hover:bg-accent-hover"
        >
          <ShareIcon size={18} />
          複製分享訊息
        </button>
        <button
          onClick={() => copy(secret, "已複製 token")}
          className="h-12 rounded-2xl border border-line-strong bg-surface text-[15px] font-medium hover:bg-ground"
        >
          只複製 token
        </button>
      </div>
    </div>
  );
}
