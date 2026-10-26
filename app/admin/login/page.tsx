"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "登入失敗");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 justify-center bg-ground">
      <main className="flex w-full max-w-md flex-col gap-6 px-6 pb-8 pt-[calc(env(safe-area-inset-top)+72px)]">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink"
        >
          <div className="flex w-9 flex-col gap-1">
            <div className="h-[5px] rounded-[1px] bg-ground" />
            <div className="h-[5px] rounded-[1px] bg-ground" />
            <div className="h-[5px] rounded-[1px] bg-ground" />
            <div className="h-[3px] rounded-[1px] bg-[#E8590C]" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-bold leading-tight">管理員登入</h1>
          <p className="leading-relaxed text-muted">
            管理訪客密碼、看開關門紀錄、遠端控制鐵捲門。
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <label htmlFor="admin-password" className="text-sm font-medium">
            管理員密碼
          </label>
          <input
            id="admin-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
            className="h-13 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[17px] outline-none focus:border-ink"
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className="h-14 w-full rounded-2xl bg-ink text-[17px] font-bold text-white disabled:opacity-45"
          >
            {loading ? "登入中…" : "登入"}
          </button>
        </div>
      </main>
    </div>
  );
}
