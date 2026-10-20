"use client";

// 鐵捲門插畫：門片 5 秒捲上/捲下，門開著超過 3 秒有個小偷探頭偷看，提醒大家關門。
// 沒有門位置感測器，門的狀態由呼叫端用「最後一個指令」推算後傳進來。
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type DoorPhase = "closed" | "opening" | "open" | "closing";

const TRAVEL_MS = 5000; // 開/關門動畫長度
const THIEF_DELAY_MS = 3000; // 門開好後多久小偷出現

type DoorState = { phase: DoorPhase; openedAt: number | null; instant: boolean };

/**
 * 門的動畫狀態。startOpening/startClosing 播動畫；setInstant 直接跳到某狀態
 * （例如後台剛載入、從紀錄推算出門已經開著），不播動畫。
 */
export function useDoorPhase() {
  const [state, setState] = useState<DoorState>({
    phase: "closed",
    openedAt: null,
    instant: true,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const startOpening = useCallback(() => {
    clear();
    setState({ phase: "opening", openedAt: null, instant: false });
    timer.current = setTimeout(
      () => setState({ phase: "open", openedAt: Date.now(), instant: false }),
      TRAVEL_MS
    );
  }, []);

  const startClosing = useCallback(() => {
    clear();
    setState({ phase: "closing", openedAt: null, instant: false });
    timer.current = setTimeout(
      () => setState({ phase: "closed", openedAt: null, instant: false }),
      TRAVEL_MS
    );
  }, []);

  // 按了停止：門停在半路，當作開著（還沒關好）
  const stop = useCallback(() => {
    clear();
    setState((s) => ({
      phase: "open",
      openedAt: s.openedAt ?? Date.now(),
      instant: false,
    }));
  }, []);

  const setInstant = useCallback((open: boolean, openedAt: number | null) => {
    clear();
    setState({
      phase: open ? "open" : "closed",
      openedAt: open ? openedAt : null,
      instant: true,
    });
  }, []);

  return { ...state, startOpening, startClosing, stop, setInstant };
}

/** 門開著超過 3 秒才回 true（小偷出現的時機）。 */
export function useThief(phase: DoorPhase, openedAt: number | null): boolean {
  const [readyFor, setReadyFor] = useState<number | null>(null);
  useEffect(() => {
    if (phase !== "open" || openedAt == null) return;
    const delay = Math.max(0, openedAt + THIEF_DELAY_MS - Date.now());
    const t = setTimeout(() => setReadyFor(openedAt), delay);
    return () => clearTimeout(t);
  }, [phase, openedAt]);
  return phase === "open" && openedAt != null && readyFor === openedAt;
}

export default function GarageScene({
  phase,
  instant = false,
  thief,
  className = "",
}: {
  phase: DoorPhase;
  instant?: boolean;
  thief: boolean;
  className?: string;
}) {
  // SVG 的 id 是整份文件共用的，同一頁有兩個場景時要加前綴避免撞名
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const u = (name: string) => `${prefix}-${name}`;

  // 場景剛出現時先畫成「關著」，下一個 frame 才套用真正的狀態，
  // 不然一掛上去就是 is-up，CSS transition 不會跑（訪客開門後才顯示場景就是這樣）
  const [ready, setReady] = useState(instant);
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const up = ready && (phase === "opening" || phase === "open");
  const doorCls = `garage-door${up ? " is-up" : ""}${instant ? " no-anim" : ""}`;
  const label = up
    ? thief
      ? "鐵捲門開著，一個背著麻袋的小偷拿手電筒從門邊偷看"
      : "鐵捲門開著"
    : "鐵捲門關著";

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 300 200"
      className={`block h-auto w-full max-w-[300px] ${className}`}
    >
      <defs>
          <pattern id={u("brick")} width="28" height="14" patternUnits="userSpaceOnUse">
            <rect width="28" height="14" fill="#E6E0D5"/>
            <path d="M0 0.5H28M0 7.5H28M7 0V7M21 7V14" stroke="#D2CABC" strokeWidth="1"/>
          </pattern>
          <linearGradient id={u("slatGrad")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F2F0EB"/>
            <stop offset="0.5" stopColor="#D6D1C7"/>
            <stop offset="1" stopColor="#B3ACA0"/>
          </linearGradient>
          <pattern id={u("slats")} width="300" height="12" patternUnits="userSpaceOnUse">
            <rect width="300" height="12" fill={`url(#${u("slatGrad")})`}/>
            <rect y="0" width="300" height="1" fill="#FAF9F6"/>
            <rect y="11" width="300" height="1" fill="#8F887C"/>
          </pattern>
          <linearGradient id={u("metal")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7C8189"/>
            <stop offset="0.45" stopColor="#4B4F56"/>
            <stop offset="1" stopColor="#2B2D31"/>
          </linearGradient>
          <linearGradient id={u("rail")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3A3C41"/>
            <stop offset="0.5" stopColor="#7A7E85"/>
            <stop offset="1" stopColor="#34363B"/>
          </linearGradient>
          <linearGradient id={u("inside")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#17181B"/>
            <stop offset="1" stopColor="#2C2E33"/>
          </linearGradient>
          <linearGradient id={u("floor")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2E3035"/>
            <stop offset="1" stopColor="#45474D"/>
          </linearGradient>
          <linearGradient id={u("barGrad")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A39C90"/>
            <stop offset="1" stopColor="#6F695F"/>
          </linearGradient>
          <radialGradient id={u("glow")} cx="150" cy="56" r="110" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFD58A" stopOpacity="0.42"/>
            <stop offset="1" stopColor="#FFD58A" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id={u("beam")} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#FFF1C2" stopOpacity="0.55"/>
            <stop offset="1" stopColor="#FFF1C2" stopOpacity="0"/>
          </linearGradient>
          <pattern id={u("stripes")} width="40" height="7" patternUnits="userSpaceOnUse">
            <rect width="40" height="7" fill="#F1EEE8"/>
            <rect width="40" height="3.5" fill="#202227"/>
          </pattern>
          <clipPath id={u("opening")}><rect x="48" y="46" width="204" height="144"/></clipPath>
        </defs>

        <rect width="300" height="190" fill={`url(#${u("brick")})`}/>
        <rect y="188" width="300" height="12" fill="#BDB6AA"/>
        <rect y="188" width="300" height="2" fill="#A59E92"/>

        <g clipPath={`url(#${u("opening")})`}>
          <rect x="48" y="46" width="204" height="144" fill={`url(#${u("inside")})`}/>
          <rect x="48" y="46" width="204" height="144" fill={`url(#${u("glow")})`}/>
          <rect x="48" y="160" width="204" height="30" fill={`url(#${u("floor")})`}/>
          <path d="M48 160H252" stroke="#4E5157" strokeWidth="1"/>
          <ellipse cx="160" cy="182" rx="22" ry="3" fill="#1C1D20" opacity="0.6"/>

          <rect x="58" y="92" width="52" height="68" fill="#24262A"/>
          <path d="M58 114H110M58 136H110" stroke="#4A4D53" strokeWidth="2"/>
          <rect x="62" y="100" width="20" height="13" rx="1" fill="#A47B4B"/>
          <path d="M62 105H82" stroke="#7E5C35" strokeWidth="1"/>
          <rect x="85" y="104" width="16" height="9" rx="1" fill="#8C6A42"/>
          <rect x="64" y="124" width="12" height="11" rx="2" fill="#5B7A8C"/>
          <rect x="79" y="121" width="24" height="14" rx="1" fill="#B18755"/>
          <rect x="62" y="146" width="30" height="13" rx="1" fill="#9C744A"/>

          <path d="M150 46V56" stroke="#3A3C41" strokeWidth="1.5"/>
          <path d="M142 56H158L154 62H146Z" fill="#3A3C41"/>
          <ellipse cx="150" cy="63" rx="4" ry="2.5" fill="#FFE8B0"/>

          <g>
            <circle cx="128" cy="177" r="11" fill="#151618"/>
            <circle cx="128" cy="177" r="5" fill="#6B6F76"/>
            <circle cx="186" cy="177" r="11" fill="#151618"/>
            <circle cx="186" cy="177" r="5" fill="#6B6F76"/>
            <path d="M112 172Q112 150 136 147H166Q176 147 176 160V172Z" fill="#8FB1C9"/>
            <path d="M118 158Q126 152 140 152" stroke="#C3D6E3" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <rect x="126" y="140" width="38" height="9" rx="4.5" fill="#25272B"/>
            <path d="M172 172L180 130H190L188 172Z" fill="#7FA3BC"/>
            <path d="M174 172H198" stroke="#25272B" strokeWidth="5" strokeLinecap="round"/>
            <path d="M178 126H198" stroke="#25272B" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="193" cy="133" r="4" fill="#FFF4CF"/>
            <circle cx="114" cy="160" r="2.5" fill="#E8590C"/>
          </g>
        </g>

        <g clipPath={`url(#${u("opening")})`}>
          <g className={thief ? "garage-thief is-peeking" : "garage-thief"}>
            <polygon points="176,148 108,128 108,178" fill={`url(#${u("beam")})`}/>
            <g transform="translate(190 104)">
              <ellipse cx="30" cy="85" rx="26" ry="3.5" fill="#000000" opacity="0.35"/>
              <path d="M38 30Q35 16 47 16Q58 14 60 30Q68 50 57 64Q44 70 36 59Q30 44 38 30Z" fill="#B08D5E"/>
              <path d="M41 28Q47 33 56 27" stroke="#6E5534" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              <path d="M44 16L42 10M50 15L53 9" stroke="#6E5534" strokeWidth="2" strokeLinecap="round"/>
              <rect x="44" y="42" width="9" height="8" rx="1.5" fill="#94744A" transform="rotate(-12 48 46)"/>
              <path d="M21 56L14 70L9 81" stroke="#2A2C33" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M29 58L32 71L26 81" stroke="#2A2C33" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <ellipse cx="7" cy="83" rx="6" ry="3" fill="#111214"/>
              <ellipse cx="24" cy="83" rx="6" ry="3" fill="#111214"/>
              <path d="M13 31Q10 52 19 61H35Q41 50 38 30Q27 24 13 31Z" fill={`url(#${u("stripes")})`}/>
              <path d="M13 31Q10 52 19 61H35Q41 50 38 30Q27 24 13 31Z" fill="none" stroke="#202227" strokeWidth="1"/>
              <path d="M35 34L43 25" stroke="#202227" strokeWidth="6" strokeLinecap="round"/>
              <path d="M17 35L5 45" stroke="#202227" strokeWidth="6.5" strokeLinecap="round"/>
              <rect x="-12" y="41" width="14" height="6" rx="2" fill="#A3A9B1" transform="rotate(-8 -5 44)"/>
              <rect x="-13" y="40.5" width="3" height="7" rx="1" fill="#FFF1C2" transform="rotate(-8 -5 44)"/>
              <circle cx="3" cy="45" r="4.2" fill="#3B3F46"/>
              <circle cx="24" cy="17" r="12.5" fill="#EBC7A0"/>
              <path d="M14 24Q24 32 34 22Q32 30 24 30Q17 30 14 24Z" fill="#B8956F" opacity="0.55"/>
              <circle cx="35" cy="18" r="3" fill="#E0B88E"/>
              <ellipse cx="11.5" cy="21" rx="3" ry="2.3" fill="#DDAF85"/>
              <path d="M15 26Q19 28.5 23 25.5" stroke="#7A4E33" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              <path d="M11 15Q11 1 24 0.5Q37 1 37 15Z" fill="#202227"/>
              <rect x="10" y="10" width="28" height="5.5" rx="2.5" fill="#34373D"/>
              <rect x="10.5" y="14.5" width="27" height="7.5" rx="3.7" fill="#0F1012"/>
              <ellipse cx="18" cy="18.2" rx="3.6" ry="2.7" fill="#FFFFFF"/>
              <ellipse cx="28" cy="18.2" rx="3.6" ry="2.7" fill="#FFFFFF"/>
              <g className="garage-thief-eyes">
                <circle cx="17.2" cy="18.6" r="1.6" fill="#111214"/>
                <circle cx="27.2" cy="18.6" r="1.6" fill="#111214"/>
              </g>
              <path d="M14.5 13.5L21 15.2M31.5 13.5L25.5 15.2" stroke="#0F1012" strokeWidth="1.6" strokeLinecap="round"/>
            </g>
          </g>
        </g>

        <g clipPath={`url(#${u("opening")})`}>
          <g className={doorCls}>
            <rect x="48" y="46" width="204" height="132" fill={`url(#${u("slats")})`}/>
            <g fill="#2E3035">
              <rect x="78" y="73" width="10" height="3" rx="1.5"/><rect x="98" y="73" width="10" height="3" rx="1.5"/><rect x="118" y="73" width="10" height="3" rx="1.5"/><rect x="138" y="73" width="10" height="3" rx="1.5"/><rect x="158" y="73" width="10" height="3" rx="1.5"/><rect x="178" y="73" width="10" height="3" rx="1.5"/><rect x="198" y="73" width="10" height="3" rx="1.5"/><rect x="218" y="73" width="10" height="3" rx="1.5"/>
            </g>
            <rect x="48" y="178" width="204" height="10" fill={`url(#${u("barGrad")})`}/>
            <rect x="48" y="178" width="204" height="1" fill="#C9C3B8"/>
            <rect x="138" y="181" width="24" height="4" rx="2" fill="#3A3C41"/>
            <circle cx="172" cy="183" r="2" fill="#2B2D31"/>
            <rect x="48" y="188" width="204" height="2" fill="#151618"/>
          </g>
        </g>

        <rect x="40" y="40" width="8" height="150" fill={`url(#${u("rail")})`}/>
        <rect x="252" y="40" width="8" height="150" fill={`url(#${u("rail")})`}/>
        <rect x="30" y="18" width="240" height="30" rx="5" fill={`url(#${u("metal")})`}/>
        <rect x="30" y="18" width="240" height="2" rx="1" fill="#9AA0A8"/>
        <rect x="30" y="44" width="240" height="4" fill="#1F2124"/>
        <circle cx="40" cy="33" r="2.5" fill="#2B2D31"/><circle cx="260" cy="33" r="2.5" fill="#2B2D31"/>
        <circle cx="40" cy="32.3" r="1" fill="#A3A9B1"/><circle cx="260" cy="32.3" r="1" fill="#A3A9B1"/>
        <rect x="132" y="27" width="36" height="10" rx="2" fill="#2B2D31"/>
        <circle cx="139" cy="32" r="2" fill="#E8590C"/>
    </svg>
  );
}
