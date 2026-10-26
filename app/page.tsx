"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadShortcuts,
  saveShortcut,
  removeShortcut,
  relativeTime,
  type Shortcut,
} from "@/lib/shortcuts";
import {
  cleanGuestName,
  GUEST_NAME_MAX,
  loadGuestName,
  saveGuestName,
} from "@/lib/guest-name";
import GarageScene, { useDoorPhase, useThief } from "@/app/components/GarageScene";
import {
  AlertCircleIcon,
  ArrowDownIcon,
  CloseIcon,
  KeyIcon,
  StopIcon,
  WarningIcon,
} from "@/app/components/icons";

type Stage = "input" | "opened" | "closed";

const GATE_NAME = "丁宅鐵捲門";
const CODE_LENGTH = 6;

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DoorPage() {
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [staleCode, setStaleCode] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // 訪客名字：填過就鎖住只顯示一行，按「改名字」才再打開輸入框
  const [name, setName] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  // 沒填名字就按開門：每按一次 +1，換 key 讓抖動動畫重跑
  const [nameNudge, setNameNudge] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const door = useDoorPhase();
  const thief = useThief(door.phase, door.openedAt);

  // 掛載後才讀 localStorage，避免 SSR hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShortcuts(loadShortcuts());
    const saved = loadGuestName();
    if (saved) {
      setName(saved);
      setNameLocked(true);
      codeRef.current?.focus();
    } else {
      nameRef.current?.focus();
    }
  }, []);

  // 開門後每秒更新倒數（關門 token 到期時間）
  useEffect(() => {
    if (stage !== "opened") return;
    const tick = () => setNowMs(Date.now());
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, [stage]);

  const remainingMs = expiresAt - nowMs;
  const tokenExpired = stage === "opened" && nowMs > 0 && remainingMs <= 0;

  async function handleOpen(codeToUse: string = code) {
    setError("");
    setStaleCode(null);
    const guestName = cleanGuestName(name);
    if (!guestName) {
      setNameLocked(false);
      setNameNudge((n) => n + 1);
      navigator.vibrate?.(120);
      requestAnimationFrame(() => {
        nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        nameRef.current?.focus();
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/door/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToUse, name: guestName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.reason === "out_of_window" && data.window
            ? `目前不在可用時段（${data.window}）`
            : (data.error ?? "開門失敗")
        );
        // 密碼已停用/刪除，且它是一組快捷 → 提示移除
        if (
          data.reason === "invalid" &&
          shortcuts.some((s) => s.code === codeToUse)
        ) {
          setStaleCode(codeToUse);
        }
        return;
      }
      setShortcuts(saveShortcut(codeToUse, data.label ?? ""));
      saveGuestName(guestName);
      setName(guestName);
      setNameLocked(true);
      setToken(data.token ?? "");
      setLabel(data.label ?? "");
      setExpiresAt(data.expiresAt ?? 0);
      setNotice("");
      setStage("opened");
      door.startOpening();
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveShortcut(codeToRemove: string) {
    setShortcuts(removeShortcut(codeToRemove));
    if (staleCode === codeToRemove) {
      setStaleCode(null);
      setError("");
    }
  }

  async function sendAction(action: "close" | "stop") {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/door/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (action === "stop" ? "停止失敗" : "關門失敗"));
        return;
      }
      if (action === "stop") {
        door.stop();
        setNotice("已停止，門停在目前的位置");
      } else {
        door.startClosing();
        setStage("closed");
      }
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCode("");
    setToken("");
    setLabel("");
    setError("");
    setNotice("");
    setStaleCode(null);
    setStage("input");
    door.setInstant(false, null);
  }

  return (
    <div className="flex min-h-full flex-1 justify-center bg-ground lg:items-center lg:px-6 lg:py-12">
      {/* 手機一欄；電腦版左右兩欄：左邊標題＋鐵捲門，右邊操作 */}
      <main className="flex w-full max-w-md flex-col gap-6 px-5 pb-[max(env(safe-area-inset-bottom),32px)] pt-[calc(env(safe-area-inset-top)+28px)] lg:max-w-[1040px] lg:flex-row lg:gap-0 lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-line lg:bg-surface lg:p-0 lg:shadow-[0_12px_40px_rgba(26,27,30,0.06)]">
        <div className="flex flex-col gap-6 lg:w-1/2 lg:justify-between lg:gap-8 lg:bg-faded lg:p-10">
          <header className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted lg:text-sm">
              訪客開門{label && stage !== "input" ? ` · ${label}` : ""}
            </span>
            <h1 className="text-[26px] font-bold lg:text-4xl">{GATE_NAME}</h1>
          </header>

          {/* 輸入密碼時手機不顯示場景，電腦版左欄放關著的門 */}
          <section
            className={`${stage === "input" ? "hidden lg:flex" : "flex"} flex-col items-center gap-4 rounded-[20px] border border-line bg-surface px-5 py-7 text-center lg:items-stretch lg:gap-8 lg:border-0 lg:bg-transparent lg:p-0 lg:text-left`}
          >
            <GarageScene
              phase={door.phase}
              instant={door.instant}
              thief={thief}
              className="mx-auto lg:max-w-[440px]"
            />
            <div aria-live="polite" className="flex flex-col gap-1.5">
              {stage === "closed" ? (
                <>
                  <h2 className="text-2xl font-bold">
                    {door.phase === "closing" ? "門正在關上…" : "已關門，謝謝！"}
                  </h2>
                  <p className="text-[15px] text-muted">屋主已收到通知</p>
                </>
              ) : door.phase === "opening" ? (
                <>
                  <h2 className="text-2xl font-bold">門正在打開…</h2>
                  <p className="text-[15px] text-muted">屋主已收到通知</p>
                </>
              ) : thief ? (
                <>
                  <h2 className="text-2xl font-bold text-accent-hover">
                    門開著，有人在偷看
                  </h2>
                  <p className="text-[15px] text-muted">進來後就把門關上吧</p>
                </>
              ) : stage === "input" ? (
                <p className="text-sm leading-relaxed text-muted">
                  密碼由屋主提供，只在指定時段有效。開門後屋主會收到通知。
                </p>
              ) : (
                <>
                  <h2 className="text-2xl font-bold">門開好了</h2>
                  <p className="text-[15px] text-muted">屋主已收到通知</p>
                </>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-1 flex-col gap-6 lg:w-1/2 lg:px-11 lg:py-10">

          {stage === "input" && (
            <>
              {nameLocked ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface py-2 pl-4 pr-2">
                  <span className="min-w-0 truncate text-[15px] text-muted">
                    開門身分　<strong className="text-ink">{name}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setNameLocked(false);
                      requestAnimationFrame(() => nameRef.current?.select());
                    }}
                    className="h-11 shrink-0 rounded-xl px-3 text-[15px] font-medium text-accent-hover hover:bg-ground"
                  >
                    改名字
                  </button>
                </div>
              ) : (
                <section
                  key={nameNudge}
                  className={`flex flex-col gap-2 ${nameNudge > 0 ? "field-shake" : ""}`}
                >
                  <label
                    htmlFor="guest-name"
                    className={`text-[15px] font-bold ${nameNudge > 0 ? "text-danger" : ""}`}
                  >
                    你的名字{nameNudge > 0 && "（開門前請先填）"}
                  </label>
                  <input
                    ref={nameRef}
                    id="guest-name"
                    type="text"
                    autoComplete="nickname"
                    enterKeyHint="next"
                    maxLength={GUEST_NAME_MAX}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameNudge > 0) setNameNudge(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") codeRef.current?.focus();
                    }}
                    placeholder="例如 小明"
                    aria-invalid={nameNudge > 0}
                    className={`h-13 rounded-2xl bg-surface px-4 text-[17px] outline-none ${
                      nameNudge > 0
                        ? "border-2 border-danger bg-danger-bg"
                        : "border border-line-strong focus:border-accent"
                    }`}
                  />
                  <p className="text-sm text-muted">
                    只需要輸入一次，
                    <span className="lg:hidden">這支手機</span>
                    <span className="hidden lg:inline">這台電腦</span>
                    會記住。屋主會在紀錄裡看到是誰開的門。
                  </p>
                </section>
              )}

              {shortcuts.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <h2 className="text-[15px] font-bold">常用密碼</h2>
                  {shortcuts.map((s) => (
                    <div
                      key={s.code}
                      className="flex items-center rounded-2xl border border-line bg-surface"
                    >
                      <button
                        onClick={() => handleOpen(s.code)}
                        disabled={loading}
                        className="flex min-h-15 flex-1 items-center justify-between gap-2 p-4 text-left disabled:opacity-40"
                      >
                        <span className="flex items-center gap-2.5 text-[17px] font-bold">
                          <KeyIcon size={18} className="text-accent" />
                          {s.label || `••••${s.code.slice(-2)}`}
                        </span>
                        <span className="text-[13px] text-muted">
                          上次 {relativeTime(s.lastUsed)} · 一鍵開門
                        </span>
                      </button>
                      <button
                        onClick={() => handleRemoveShortcut(s.code)}
                        aria-label={`移除常用密碼「${s.label || "未命名"}」`}
                        className="mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-ground"
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  ))}
                </section>
              )}

              <section className="flex flex-col gap-3">
                <label htmlFor="code" className="text-[15px] font-bold">
                  輸入 6 位數密碼
                </label>
                {/* 真的 input 蓋在格子上：點格子就叫出數字鍵盤，iOS 也能自動填入 */}
                <div className="relative">
                  <div className="grid grid-cols-6 gap-2" aria-hidden="true">
                    {Array.from({ length: CODE_LENGTH }, (_, i) => {
                      const digit = code[i];
                      const isCaret =
                        focused && i === Math.min(code.length, CODE_LENGTH - 1);
                      return (
                        <div
                          key={i}
                          className={`flex h-15 items-center justify-center rounded-xl bg-surface font-mono text-[28px] font-semibold ${
                            isCaret
                              ? "border-2 border-accent"
                              : digit
                                ? "border-2 border-ink"
                                : "border border-line-strong"
                          }`}
                        >
                          {digit ??
                            (isCaret ? (
                              <span className="h-7 w-0.5 animate-pulse bg-accent" />
                            ) : null)}
                        </div>
                      );
                    })}
                  </div>
                  <input
                    ref={codeRef}
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_LENGTH}
                    value={code}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && code.length === CODE_LENGTH)
                        handleOpen();
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
                  />
                </div>
                <p className="text-sm text-muted lg:hidden">
                  密碼由屋主提供，只在指定時段有效。
                </p>
                <p className="hidden text-sm text-muted lg:block">
                  直接用鍵盤打數字，打完按 Enter 開門。
                </p>
              </section>

              <div className="flex-1" />

              <div className="flex flex-col gap-3">
                {error && (
                  <div
                    role="alert"
                    className="flex flex-col gap-2 rounded-2xl bg-danger-bg px-3.5 py-3 text-sm leading-relaxed text-danger"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircleIcon size={18} className="mt-px shrink-0" />
                      <span>{error}</span>
                    </div>
                    {staleCode && (
                      <button
                        onClick={() => handleRemoveShortcut(staleCode)}
                        className="self-start rounded-xl border border-danger/30 bg-surface px-3 py-2 font-medium"
                      >
                        移除這組常用密碼
                      </button>
                    )}
                  </div>
                )}
                <button
                  onClick={() => handleOpen()}
                  disabled={loading || code.length !== CODE_LENGTH}
                  className="h-16 rounded-[18px] bg-accent text-xl font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-45"
                >
                  {loading ? "開門中…" : "開門"}
                </button>
              </div>
            </>
          )}


          {stage === "opened" && (
            <>
              <div className="flex items-start gap-3 rounded-2xl bg-warn-bg p-4 leading-relaxed text-warn-ink">
                <WarningIcon size={22} className="mt-px shrink-0" />
                <span>
                  <strong>進來後記得幫忙關門。</strong>
                  按關門前，先確認門下沒有人、車或寵物。
                </span>
              </div>

              <div className="flex-1" />

              <div className="flex flex-col gap-3">
                {error && (
                  <p role="alert" className="text-center text-sm text-danger">
                    {error}
                  </p>
                )}
                {notice && !error && (
                  <p aria-live="polite" className="text-center text-sm text-muted">
                    {notice}
                  </p>
                )}
                {tokenExpired ? (
                  <>
                    <p className="text-center text-[15px] text-muted">
                      按鈕已失效，要關門請重新輸入密碼
                    </p>
                    <button
                      onClick={reset}
                      className="h-14 rounded-2xl border-2 border-ink bg-surface text-[17px] font-bold"
                    >
                      重新輸入密碼
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => sendAction("close")}
                      disabled={loading}
                      className="flex h-18 items-center justify-center gap-2.5 rounded-[18px] bg-ink text-[22px] font-bold text-white disabled:opacity-45"
                    >
                      <ArrowDownIcon size={24} />
                      {loading ? "傳送中…" : "關門"}
                    </button>
                    <button
                      onClick={() => sendAction("stop")}
                      disabled={loading}
                      className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-surface text-[17px] font-bold disabled:opacity-45"
                    >
                      <StopIcon size={18} />
                      緊急停止
                    </button>
                    {expiresAt > 0 && nowMs > 0 && (
                      <p className="text-center text-sm text-muted">
                        這兩個按鈕{" "}
                        <span className="font-mono font-semibold text-ink">
                          {formatCountdown(remainingMs)}
                        </span>{" "}
                        後失效，之後要重新輸入密碼
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {stage === "closed" && (
            <>
              <div className="flex-1" />
              <button
                onClick={reset}
                className="h-14 rounded-2xl border-2 border-ink bg-surface text-[17px] font-bold"
              >
                回首頁
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
