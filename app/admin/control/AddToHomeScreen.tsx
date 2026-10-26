"use client";

import { useEffect, useState } from "react";
import { AddSquareIcon, CloseIcon, MoreIcon, ShareIcon } from "@/app/components/icons";

// 「加到主畫面」提示：只在 iPhone/iPad 的瀏覽器裡顯示，已經從主畫面打開或按過 × 就不再出現。
// 不上 App Store，靠 Safari「加入主畫面」當 App 用（manifest、圖示見 app/layout.tsx）。
const DISMISS_KEY = "admin-a2hs-dismissed";

function shouldShow(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone =
    nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  // iPadOS 的 Safari 會假裝自己是 Mac，用觸控點數分辨
  const ios =
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  if (standalone || !ios) return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // 掛載後才看裝置與 localStorage，避免 SSR hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(shouldShow());
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage 不可用（隱私模式）→ 這次先藏起來，下次再出現
    }
  }

  if (!show) return null;

  return (
    <>
      <section
        aria-labelledby="a2hs-title"
        className="flex items-start gap-3.5 rounded-[18px] border border-[#fed7aa] bg-accent-soft py-4 pl-4 pr-3 lg:hidden"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
          <AddSquareIcon size={22} strokeWidth={1.8} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="a2hs-title" className="text-base font-bold leading-snug">
            加到主畫面，下次一點就開
          </h2>
          <p className="text-sm leading-relaxed text-warn-ink">
            不用再開 Safari 找網址，像 App 一樣從主畫面打開。
          </p>
          <button
            onClick={() => setGuideOpen(true)}
            className="-ml-2.5 mt-1.5 h-11 self-start px-2.5 text-[15px] font-bold text-accent-hover"
          >
            看怎麼加 →
          </button>
        </div>
        <button
          onClick={dismiss}
          aria-label="不再顯示"
          className="-mr-1.5 -mt-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-warn-ink"
        >
          <CloseIcon size={18} />
        </button>
      </section>

      {guideOpen && <Guide onClose={() => setGuideOpen(false)} />}
    </>
  );
}

const STEPS = [
  {
    body: (
      <>
        點網址列的 <strong>分享</strong> 按鈕
        <span className="block text-[13px] text-muted">
          看不到的話，先點旁邊的「
          <MoreIcon size={14} className="inline align-[-2px]" />
          」
        </span>
      </>
    ),
    icon: <ShareIcon size={22} strokeWidth={1.8} className="text-[#1d4ed8]" />,
  },
  {
    body: (
      <>
        往下滑，選 <strong>加入主畫面</strong>
      </>
    ),
    icon: <AddSquareIcon size={24} strokeWidth={1.8} />,
  },
  {
    body: (
      <>
        確認「以網頁 App 打開」是開的，再按右上角 <strong>新增</strong>
      </>
    ),
    icon: <span className="text-[15px] font-bold text-[#1d4ed8]">新增</span>,
  },
];

function Guide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40">
      {/* 點旁邊關閉；給螢幕閱讀器的關閉鈕在面板裡 */}
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="a2hs-guide-title"
        className="relative mx-auto flex w-full max-w-xl flex-col gap-[18px] rounded-t-3xl bg-surface px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-2.5 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
      >
        <div aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line-strong" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="a2hs-guide-title" className="text-[22px] font-bold leading-snug">
              加到主畫面
            </h2>
            <p className="text-sm text-muted">用 iPhone 的 Safari，三步就好</p>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="-mr-2.5 -mt-1.5 flex h-11 w-11 items-center justify-center text-muted"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <ol className="rounded-[18px] border border-line">
          {STEPS.map((s, i) => (
            <li
              key={i}
              className={`grid grid-cols-[28px_1fr_48px] items-center gap-3 py-3.5 pl-4 pr-3.5 ${
                i > 0 ? "border-t border-line-soft" : ""
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                {i + 1}
              </span>
              <span className="text-[15px] leading-normal">{s.body}</span>
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-ground"
              >
                {s.icon}
              </span>
            </li>
          ))}
        </ol>

        <p className="rounded-[14px] bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info-ink">
          從主畫面打開時要再登入一次管理員密碼，之後 30 天內不用再輸入。
        </p>

        <button
          onClick={onClose}
          className="h-[54px] rounded-2xl bg-ink text-[17px] font-bold text-white"
        >
          知道了
        </button>
      </section>
    </div>
  );
}
