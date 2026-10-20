// 依密碼 id 取固定色票。Tailwind 不能動態組 class，所以整串靜態列出。
const PALETTE = [
  {
    block: "bg-sky-100 text-sky-900 dark:bg-sky-500/25 dark:text-sky-100",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  {
    block: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-100",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    block: "bg-violet-100 text-violet-900 dark:bg-violet-500/25 dark:text-violet-100",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  {
    block: "bg-amber-100 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    block: "bg-rose-100 text-rose-900 dark:bg-rose-500/25 dark:text-rose-100",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  {
    block: "bg-cyan-100 text-cyan-900 dark:bg-cyan-500/25 dark:text-cyan-100",
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
];

export type CodeColor = (typeof PALETTE)[number];

export function colorFor(id: number): CodeColor {
  return PALETTE[((id % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
