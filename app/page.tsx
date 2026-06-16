"use client";

import { useState } from "react";

type Stage = "input" | "opened" | "closed";

export default function DoorPage() {
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/door/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "開門失敗");
        return;
      }
      setToken(data.token ?? "");
      setStage("opened");
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/door/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "關門失敗");
        return;
      }
      setStage("closed");
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCode("");
    setToken("");
    setError("");
    setStage("input");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-6 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl shadow-zinc-200/60 dark:bg-zinc-900 dark:shadow-black/40">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🚪</div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            鐵捲門
          </h1>
        </div>

        {stage === "input" && (
          <div className="flex flex-col gap-5">
            <p className="text-center text-zinc-600 dark:text-zinc-400">
              請輸入密碼開門
            </p>
            <input
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6) handleOpen();
              }}
              placeholder="6 位數字密碼"
              className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-4 text-center text-2xl tracking-[0.5em] text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300"
            />
            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}
            <button
              onClick={handleOpen}
              disabled={loading || code.length !== 6}
              className="w-full rounded-2xl bg-zinc-900 py-4 text-lg font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "開門中…" : "開門"}
            </button>
          </div>
        )}

        {stage === "opened" && (
          <div className="flex flex-col gap-5 text-center">
            <div className="text-4xl">✅</div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              已開門！
            </p>
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              進來後記得幫我關門 🙏
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleClose}
              disabled={loading}
              className="w-full rounded-2xl bg-zinc-900 py-4 text-lg font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "關門中…" : "關門"}
            </button>
          </div>
        )}

        {stage === "closed" && (
          <div className="flex flex-col gap-5 text-center">
            <div className="text-4xl">🔒</div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              已關門，謝謝！
            </p>
            <button
              onClick={reset}
              className="w-full rounded-2xl border border-zinc-300 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              回首頁
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
