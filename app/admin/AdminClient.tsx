"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorCode } from "./shared";
import ControlTab from "./control/ControlTab";
import CodesTab from "./codes/CodesTab";
import CalendarTab from "./calendar/CalendarTab";
import LogsTab from "./logs/LogsTab";
import MembersTab from "./members/MembersTab";
import { isPending, type ActivationCode, type Member } from "./members/format";
import {
  CalendarIcon,
  ClockIcon,
  GarageIcon,
  KeyIcon,
  LogoutIcon,
  SlidersIcon,
  UsersIcon,
} from "@/app/components/icons";

// 手機：底部導覽 控制 / 紀錄 / 管理（管理裡再切 訪客密碼 / LINE 成員 / 日曆）
// 電腦（lg 以上）：左側選單直接列出五個頁面
type Tab = "control" | "logs" | "codes" | "members" | "calendar";
type ManageTab = "codes" | "members" | "calendar";

const GATE_NAME = "丁宅鐵捲門";

const MOBILE_TABS = [
  { key: "control", label: "控制", Icon: GarageIcon },
  { key: "logs", label: "紀錄", Icon: ClockIcon },
  { key: "manage", label: "管理", Icon: SlidersIcon },
] as const;

const SIDEBAR_TABS: { key: Tab; label: string; Icon: typeof GarageIcon }[] = [
  { key: "control", label: "控制", Icon: SlidersIcon },
  { key: "logs", label: "紀錄", Icon: ClockIcon },
  { key: "codes", label: "訪客密碼", Icon: KeyIcon },
  { key: "members", label: "LINE 成員", Icon: UsersIcon },
  { key: "calendar", label: "日曆", Icon: CalendarIcon },
];

const MANAGE_TABS: { key: ManageTab; label: string }[] = [
  { key: "codes", label: "訪客密碼" },
  { key: "members", label: "LINE 成員" },
  { key: "calendar", label: "日曆" },
];

const isManage = (t: Tab): t is ManageTab =>
  t === "codes" || t === "members" || t === "calendar";

export default function AdminClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("control");
  // 手機按「管理」時回到上次看的子分頁
  const [lastManage, setLastManage] = useState<ManageTab>("codes");
  const [codes, setCodes] = useState<DoorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [activationCodes, setActivationCodes] = useState<ActivationCode[]>([]);
  const [addFriendUrl, setAddFriendUrl] = useState("");
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersNowMs, setMembersNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/codes");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setCodes(data.codes ?? []);
    setLoading(false);
  }, [router]);

  // LINE 成員：進頁面就載入，選單上的「等待開通」數字才看得到
  const loadMembers = useCallback(async () => {
    const res = await fetch("/api/admin/members");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setMembers(data.members ?? []);
    setActivationCodes(data.codes ?? []);
    setAddFriendUrl(data.addFriendUrl ?? "");
    setMembersNowMs(Date.now());
    setMembersLoading(false);
  }, [router]);

  useEffect(() => {
    // 進頁面時載入一次密碼清單與成員（取資料後才 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadMembers();
  }, [load, loadMembers]);

  const pendingCount = members.filter(isPending).length;

  function go(t: Tab) {
    setTab(t);
    if (isManage(t)) setLastManage(t);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? "" : t)), 2000);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-ground lg:flex-row">
      {/* 通知 toast（手機在底部導覽上方） */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 lg:bottom-8">
          <div className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* 電腦版左側選單 */}
      <nav
        aria-label="後台"
        className="sticky top-0 hidden h-screen w-58 shrink-0 flex-col gap-7 border-r border-line bg-faded px-4 py-7 lg:flex"
      >
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
            <GarageIcon size={22} strokeWidth={1.8} />
          </span>
          <span className="flex flex-col">
            <span className="font-bold">{GATE_NAME}</span>
            <span className="text-[13px] text-muted">後台</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {SIDEBAR_TABS.map(({ key, label, Icon }) => {
            const on = tab === key;
            return (
              <button
                key={key}
                onClick={() => go(key)}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] transition-colors ${
                  on
                    ? "bg-surface font-bold text-ink shadow-sm"
                    : "text-subtle hover:bg-surface/60 hover:text-ink"
                }`}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                {key === "members" && pendingCount > 0 && (
                  <span
                    aria-label={`${pendingCount} 人等待開通`}
                    className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <button
          onClick={logout}
          className="flex h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-muted hover:bg-surface/60 hover:text-ink"
        >
          <LogoutIcon size={20} />
          登出
        </button>
      </nav>

      <div className="mx-auto w-full max-w-xl flex-1 px-5 pb-32 pt-5 lg:max-w-[1120px] lg:px-12 lg:pb-14 lg:pt-10">
        {tab === "control" && (
          <ControlTab
            codes={codes}
            codesLoading={loading}
            nowMs={nowMs}
            onShowLogs={() => go("logs")}
            onShowCodes={() => go("codes")}
          />
        )}

        {tab === "logs" && (
          <>
            <div className="mb-3.5 lg:mb-6">
              <h1 className="text-2xl font-bold leading-[44px] lg:text-[32px]">紀錄</h1>
              <p className="hidden text-[15px] text-muted lg:block">
                每一次開門、關門、停止，和被擋下來的嘗試
              </p>
            </div>
            <LogsTab />
          </>
        )}

        {isManage(tab) && (
          <>
            {/* 手機：管理標題＋登出＋子分頁切換；電腦版由左側選單取代 */}
            <div className="lg:hidden">
              <div className="mb-3.5 flex items-center justify-between">
                <h1 className="text-2xl font-bold leading-[44px]">管理</h1>
                <button
                  onClick={logout}
                  className="h-11 px-2 text-[15px] text-muted hover:text-ink"
                >
                  登出
                </button>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1">
                {MANAGE_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => go(t.key)}
                    aria-pressed={tab === t.key}
                    className={`h-9 rounded-[9px] text-sm transition-colors ${
                      tab === t.key
                        ? "bg-surface font-bold text-ink"
                        : "text-subtle hover:text-ink"
                    }`}
                  >
                    {t.label}
                    {t.key === "members" && pendingCount > 0 && ` (${pendingCount})`}
                  </button>
                ))}
              </div>
            </div>
            {tab === "codes" && (
              <CodesTab
                codes={codes}
                loading={loading}
                load={load}
                nowMs={nowMs}
                showToast={showToast}
              />
            )}
            {tab === "members" && (
              <MembersTab
                members={members}
                codes={activationCodes}
                addFriendUrl={addFriendUrl}
                loading={membersLoading}
                load={loadMembers}
                nowMs={membersNowMs}
                showToast={showToast}
              />
            )}
            {tab === "calendar" && (
              <>
                <h1 className="mb-6 hidden text-[32px] font-bold leading-[44px] lg:block">日曆</h1>
                <CalendarTab codes={codes} nowMs={nowMs} showToast={showToast} />
              </>
            )}
          </>
        )}
      </div>

      {/* 手機底部導覽 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),16px)] pt-1.5 lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {MOBILE_TABS.map(({ key, label, Icon }) => {
            const on = key === "manage" ? isManage(tab) : tab === key;
            return (
              <button
                key={key}
                onClick={() => go(key === "manage" ? lastManage : key)}
                aria-current={on ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 p-1.5 text-xs ${
                  on ? "font-bold text-accent" : "text-muted"
                }`}
              >
                <Icon size={24} />
                {label}
                {key === "manage" && pendingCount > 0 && (
                  <span
                    aria-label={`${pendingCount} 人等待開通`}
                    className="absolute left-[56%] top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
