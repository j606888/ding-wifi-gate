"use client";

import { useState } from "react";
import { formatAccessTime } from "@/lib/access-format";
import { PlusIcon, ShareIcon } from "@/app/components/icons";
import { inputCls, Sheet, Spinner } from "../shared";
import {
  activationShareText,
  avatarBg,
  codeMeta,
  codeState,
  isPending,
  joinedVia,
  requestMeta,
  splitCode,
  type ActivationCode,
  type Member,
} from "./format";

export default function MembersTab({
  members,
  codes,
  addFriendUrl,
  loading,
  load,
  nowMs,
  showToast,
}: {
  members: Member[];
  codes: ActivationCode[];
  addFriendUrl: string;
  loading: boolean;
  load: () => Promise<void>;
  nowMs: number;
  showToast: (msg: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const pending = members.filter(isPending);
  // 開通的在前，其餘（停用、只加了好友）在後
  const listed = members
    .filter((m) => !isPending(m))
    .sort((a, b) => Number(b.is_active) - Number(a.is_active));
  const liveCodes = codes.filter((c) => codeState(c, nowMs) === "active");
  const deadCodes = codes.filter((c) => codeState(c, nowMs) !== "active").slice(0, 3);

  async function patchMember(m: Member, body: Record<string, unknown>, done: string) {
    setBusyId(m.line_user_id);
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(m.line_user_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showToast("更新失敗，請再試一次");
        return;
      }
      await load();
      showToast(done);
    } finally {
      setBusyId(null);
    }
  }

  const name = (m: Member) => m.display_name || "（沒有名字）";
  const activate = (m: Member) =>
    patchMember(m, { is_active: true }, `已開通${name(m)}，LINE 會通知對方`);
  const deactivate = (m: Member) => patchMember(m, { is_active: false }, `已停用${name(m)}`);
  const dismiss = (m: Member) => patchMember(m, { dismiss: true }, "已從等待開通移除");

  async function share(c: ActivationCode, created = false) {
    try {
      await navigator.clipboard.writeText(activationShareText(c, addFriendUrl));
      showToast(created ? "已產生，分享訊息已複製" : "已複製分享訊息");
    } catch {
      showToast(created ? "已產生，按「分享」複製訊息" : "複製失敗，請手動複製");
    }
  }

  async function revoke(c: ActivationCode) {
    const res = await fetch(`/api/admin/activation-codes/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("作廢失敗，請再試一次");
      return;
    }
    await load();
    showToast(`已作廢 ${splitCode(c.code)}`);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[18px] bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 hidden lg:block">
        <h1 className="text-[32px] font-bold leading-[44px]">LINE 成員</h1>
        <p className="text-[15px] text-muted">
          加了「丁宅鐵捲門」好友的人。開通後就能用 LINE 開關門。
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        {pending.length > 0 && (
          <section
            aria-labelledby="pending-title"
            className="flex flex-col gap-2.5 lg:col-start-1 lg:rounded-3xl lg:bg-warn-bg lg:p-5"
          >
            <h2 id="pending-title" className="mt-1 flex items-center gap-2 text-[15px] font-bold lg:mt-0 lg:text-[17px] lg:text-warn-ink">
              等待開通
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent px-1.5 text-[13px] text-white">
                {pending.length}
              </span>
            </h2>
            {pending.map((m) => {
              const busy = busyId === m.line_user_id;
              return (
                <article
                  key={m.line_user_id}
                  className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 lg:flex-row lg:items-center lg:border-0 lg:py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar m={m} size="lg" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-bold">{name(m)}</span>
                      <span className="text-[13px] text-muted">
                        {requestMeta(m, `${formatAccessTime(m.requested_at!, nowMs)} `)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr] gap-2 lg:flex lg:flex-row-reverse">
                    <button
                      onClick={() => activate(m)}
                      disabled={busy}
                      className="h-11 rounded-xl bg-accent px-5 text-[15px] font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-45"
                    >
                      {busy ? <Spinner /> : "開通"}
                    </button>
                    <button
                      onClick={() => dismiss(m)}
                      disabled={busy}
                      className="h-11 rounded-xl border border-line-strong bg-surface px-4 text-[15px] disabled:opacity-45"
                    >
                      忽略
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* 啟動碼：手機在等待開通和名單中間，電腦版放右欄 */}
        <section
          aria-labelledby="codes-title"
          className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:gap-4 lg:rounded-3xl lg:p-6"
        >
          <div className="flex flex-col gap-0.5">
            <h2 id="codes-title" className="text-[15px] font-bold lg:text-[17px]">啟動碼</h2>
            <p className="text-[13px] leading-relaxed text-muted lg:text-sm">
              朋友加好友後在 LINE 輸入，不用等你開通就能開門。
            </p>
          </div>

          {liveCodes.length === 0 && (
            <p className="rounded-2xl bg-ground px-4 py-3 text-sm text-muted">目前沒有有效的啟動碼</p>
          )}
          {liveCodes.map((c) => (
            <div key={c.id} className="flex flex-col gap-2.5 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[28px] font-semibold tracking-[0.14em]">
                  {splitCode(c.code)}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-1 text-[13px] font-medium text-ok">
                  <span className="h-[7px] w-[7px] rounded-full bg-ok-dot" />
                  有效
                </span>
              </div>
              <span className="text-[13px] text-muted">{codeMeta(c, nowMs)}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => share(c)}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface text-[15px] font-medium hover:bg-ground"
                >
                  <ShareIcon size={16} />
                  分享
                </button>
                <button
                  onClick={() => revoke(c)}
                  className="h-11 rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-danger hover:bg-danger-bg"
                >
                  作廢
                </button>
              </div>
            </div>
          ))}
          {deadCodes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-faded px-4 py-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[17px] font-semibold tracking-[0.12em] text-subtle">
                  {splitCode(c.code)}
                </span>
                <span className="truncate text-[13px] text-muted">{codeMeta(c, nowMs)}</span>
              </span>
            </div>
          ))}

          <button
            onClick={() => setShowCreate(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-white transition-colors hover:bg-accent-hover"
          >
            <PlusIcon size={18} />
            產生啟動碼
          </button>
        </section>

        <section aria-labelledby="members-title" className="flex flex-col gap-2.5 lg:col-start-1 lg:gap-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-line lg:bg-surface">
          <h2 id="members-title" className="mt-1 text-[15px] font-bold lg:mt-0 lg:px-6 lg:pb-2 lg:pt-5 lg:text-[17px]">
            成員（{listed.filter((m) => m.is_active).length}）
          </h2>
          <div className="rounded-[18px] border border-line bg-surface lg:rounded-none lg:border-0">
            <div className="hidden items-center gap-3 border-b border-line-soft px-6 py-2.5 text-[13px] text-muted lg:flex">
              <span className="flex-1">名字</span>
              <span className="w-44">怎麼加入的</span>
              <span className="w-32">上次開門</span>
              <span className="w-[52px] text-right">開門</span>
            </div>
            {listed.length === 0 ? (
              <p className="p-5 text-center text-[15px] text-muted">還沒有人加好友</p>
            ) : (
              listed.map((m, i) => {
                const last = m.last_used_at ? formatAccessTime(m.last_used_at, nowMs) : "還沒用過";
                const busy = busyId === m.line_user_id;
                return (
                  <div
                    key={m.line_user_id}
                    className={`flex items-center gap-3 py-3 pl-4 pr-3.5 lg:px-6 ${
                      i > 0 ? "border-t border-line-soft" : ""
                    }`}
                  >
                    <Avatar m={m} dim={!m.is_active} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`flex items-center gap-2 truncate font-bold ${m.is_active ? "" : "text-muted"}`}>
                        {name(m)}
                        {m.is_admin && (
                          <span className="rounded-md bg-sunken px-1.5 py-0.5 text-xs font-medium text-subtle">管理員</span>
                        )}
                      </span>
                      <span className="truncate text-[13px] text-muted lg:hidden">
                        {joinedVia(m)} · 上次 {last}
                      </span>
                    </div>
                    <span className="hidden w-44 truncate text-[15px] text-muted lg:block">{joinedVia(m)}</span>
                    <span className="hidden w-32 truncate text-[15px] text-muted lg:block">{last}</span>
                    <button
                      role="switch"
                      aria-checked={m.is_active}
                      aria-label={`${name(m)}可以用 LINE 開門`}
                      disabled={busy}
                      onClick={() => (m.is_active ? deactivate(m) : activate(m))}
                      className={`flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-60 ${
                        m.is_active ? "justify-end bg-ok" : "justify-start bg-line-strong"
                      }`}
                    >
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white text-muted shadow-sm">
                        {busy && <Spinner />}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[13px] text-muted lg:border-t lg:border-line-soft lg:px-6 lg:py-3">
            關掉就不能用 LINE 開門，但還留在名單裡，隨時可以再打開。
          </p>
        </section>
      </div>

      {showCreate && (
        <Sheet title="產生啟動碼" onClose={() => setShowCreate(false)}>
          <ActivationForm
            addFriendUrl={addFriendUrl}
            onCreated={async (c) => {
              setShowCreate(false);
              await load();
              await share(c, true);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

function Avatar({ m, size = "md", dim = false }: { m: Member; size?: "md" | "lg"; dim?: boolean }) {
  const initial = Array.from(m.display_name || "?")[0];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-ink ${avatarBg(
        m.line_user_id
      )} ${size === "lg" ? "h-11 w-11 text-lg" : "h-10 w-10 text-base"} ${dim ? "opacity-55" : ""}`}
    >
      {initial}
    </span>
  );
}

const USE_OPTIONS: { label: string; value: number | null; text: string }[] = [
  { label: "1 次", value: 1, text: "限 1 人使用" },
  { label: "5 次", value: 5, text: "限 5 人使用" },
  { label: "不限", value: null, text: "人數不限" },
];
const TTL_OPTIONS = [
  { label: "1 小時", hours: 1 },
  { label: "1 天", hours: 24 },
  { label: "7 天", hours: 168 },
];

const segmentCls = (on: boolean) =>
  `h-10 rounded-[9px] text-[15px] transition-colors ${
    on ? "bg-surface font-bold text-ink" : "text-subtle hover:text-ink"
  }`;

function ActivationForm({
  addFriendUrl,
  onCreated,
}: {
  addFriendUrl: string;
  onCreated: (c: ActivationCode) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [uses, setUses] = useState(0);
  const [ttl, setTtl] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/activation-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          maxUses: USE_OPTIONS[uses].value,
          ttlHours: TTL_OPTIONS[ttl].hours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "產生失敗");
        return;
      }
      await onCreated(data.code);
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
          <label htmlFor="ac-label" className="text-sm font-bold">
            給誰用（選填）
          </label>
          <input
            id="ac-label"
            value={label}
            maxLength={30}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如 Bachata 同學"
            className={inputCls}
          />
          <span className="text-[13px] text-muted">只給你自己看，方便記得這組是發給誰的</span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">可以用幾次</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1">
            {USE_OPTIONS.map((o, i) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={uses === i}
                onClick={() => setUses(i)}
                className={segmentCls(uses === i)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-muted">一次 = 給一個人；多次 = 丟到群組讓大家各自輸入</span>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">多久內要輸入</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1">
            {TTL_OPTIONS.map((o, i) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={ttl === i}
                onClick={() => setTtl(i)}
                className={segmentCls(ttl === i)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-muted">過期只是不能再拿來開通，已經開通的人不受影響</span>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">分享出去的訊息</span>
          <div
            aria-live="polite"
            className="whitespace-pre-line rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] leading-relaxed"
          >
            {addFriendUrl ? `加「丁宅鐵捲門」LINE 好友：${addFriendUrl}` : "加「丁宅鐵捲門」LINE 好友"}
            {"\n"}加好友後按選單的「輸入啟動碼」，輸入<span className="text-muted">（產生後的 6 位數）</span>就能用 LINE 開門。
            {"\n"}
            <span className="text-muted">
              （{TTL_OPTIONS[ttl].label}內有效，{USE_OPTIONS[uses].text}）
            </span>
          </div>
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
          disabled={saving}
          className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-45"
        >
          {saving ? "產生中…" : "產生並分享"}
        </button>
      </div>
    </div>
  );
}
