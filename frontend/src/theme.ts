/**
 * Multiverse of Monsoon — Warm Earth Design System
 * Application palette: Warm Chalk, Paper White, Deep Navy, Terracotta.
 * Scientific map ramps remain independently defined in GridMap.tsx.
 */

export const palette = {
  primary: "#1D2A3E",
  primaryHover: "#2B3A52",
  primaryDark: "#142136",
  primaryLight: "#E8E3D9",

  secondaryBg: "#F7F5EF",
  secondarySurface: "#FFFEFA",
  secondaryRaised: "#F0E9DD",
  secondaryHover: "#E9DFC9",
  secondaryBorder: "#DED6C9",
  secondaryBorderSubtle: "#EBE5DA",

  accent: "#A66A45",
  accentHover: "#905535",
  accentDark: "#75472F",
  accentLight: "#F2E2D7",

  textBright: "#1D2A3E",
  textMain: "#29364A",
  textMuted: "#5C6676",
  textSubtle: "#7A8491",

  // Preserve scientific anomaly colours.
  divergingPositive: "#DC2626",
  divergingNegative: "#2563EB",
  mapLandBoundary: "#1D2A3E",
  indiaBoundary: "#1D2A3E",
  selectionHighlight: "#A66A45",
} as const;

export const ui = {
  // Surfaces
  card: "rounded-2xl border border-twilight-border bg-twilight-surface p-4 shadow-none transition-colors",
  cardRaised: "rounded-2xl border border-twilight-border bg-twilight-surface p-4 shadow-none",
  cardSubtle: "rounded-xl border border-twilight-border-subtle bg-twilight-base/70 p-3.5",
  cardHeader: "mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-twilight-border pb-3",

  // Typography
  titleLg: "text-lg font-bold tracking-tight text-text-bright",
  titleMd: "text-base font-bold tracking-tight text-text-bright",
  titleSm: "text-xs font-bold uppercase tracking-wider text-teal-700",
  muted: "text-xs text-text-muted leading-relaxed",
  label: "mb-1 block text-xs font-semibold text-text-main",

  // Buttons
  btnPrimary:
    "inline-flex items-center justify-center rounded-xl bg-steel-500 px-4 py-2.5 text-xs font-bold text-white shadow-none hover:bg-steel-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-45 transition active:scale-[0.98]",
  btnAccent:
    "inline-flex items-center justify-center rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white shadow-none hover:bg-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-45 transition active:scale-[0.98]",
  btnSecondary:
    "inline-flex items-center justify-center rounded-xl border border-twilight-border bg-twilight-surface px-3.5 py-2 text-xs font-semibold text-text-main shadow-none hover:bg-twilight-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-45 transition",

  // Inputs
  input:
    "w-full rounded-xl border border-twilight-border bg-twilight-surface px-3 py-2.5 text-xs text-text-main placeholder:text-text-subtle shadow-none focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/15 disabled:opacity-50",
  selectInline:
    "rounded-xl border border-twilight-border bg-twilight-surface px-3 py-1.5 text-xs font-semibold text-text-main shadow-none focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/15",

  // Badges
  badgePrimary:
    "inline-flex items-center rounded-full border border-steel-200 bg-steel-100 px-2.5 py-0.5 text-[11px] font-bold text-steel-800",
  badgeAccent:
    "inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700",
  badgeNeutral:
    "inline-flex items-center rounded-full border border-twilight-border bg-twilight-raised px-2.5 py-0.5 text-[11px] font-medium text-text-muted",
  badgeWarning:
    "inline-flex items-center rounded-full border border-amber-400/50 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800",

  // Tables
  tableWrap: "overflow-x-auto rounded-xl border border-twilight-border bg-twilight-surface",
  table: "w-full text-left text-xs text-text-main tabular-nums",
  thead: "border-b border-twilight-border bg-twilight-raised text-[11px] font-bold uppercase tracking-wider text-text-muted",
  tbody: "divide-y divide-twilight-border/60 bg-twilight-surface",
} as const;