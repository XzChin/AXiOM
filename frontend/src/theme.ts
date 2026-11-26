/**
 * Multiverse of Monsoon - Mid-Tone Twilight Design System
 *
 * - Primary: Steel Blue (#3B6D8A)
 * - Secondary: Slate Blue-Gray (#344650)
 * - Accent: Vivid Teal (#39BDAE)
 *
 * Avoids both bright white/light surfaces and very dark/black surfaces.
 */

export const palette = {
  // Brand foundations
  primary: "#3B6D8A",
  primaryHover: "#4F85A5",
  primaryDark: "#27495E",
  primaryLight: "#DCE7F0",

  secondaryBg: "#344650",
  secondarySurface: "#3A4E5A",
  secondaryRaised: "#415764",
  secondaryHover: "#48606F",
  secondaryBorder: "#4D6675",
  secondaryBorderSubtle: "#425866",

  accent: "#39BDAE",
  accentHover: "#4CD4C5",
  accentDark: "#19665E",
  accentLight: "#C7F3EE",

  // Text colors
  textBright: "#F4F7F9",
  textMain: "#E3EBF0",
  textMuted: "#A9BDC8",
  textSubtle: "#829AA7",

  // Scientific visualization palette
  divergingPositive: "#DC2626", // Crimson red excess/warm anomaly
  divergingNegative: "#2563EB", // Deep blue deficit/cool anomaly
  mapLandBoundary: "#20303A",   // Contrast coastlines
  indiaBoundary: "#F5A623",     // Contrast gold boundary overlay
  selectionHighlight: "#F5A623",// Contrast gold marker
} as const;

export const ui = {
  // Cards & surfaces
  card: "rounded-2xl border border-twilight-border bg-twilight-surface p-5 shadow-sm transition-all",
  cardRaised: "rounded-2xl border border-twilight-border bg-twilight-raised p-5 shadow-md",
  cardSubtle: "rounded-2xl border border-twilight-subtle bg-twilight-base/70 p-4",
  cardHeader: "mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-twilight-border pb-3",

  // Typography
  titleLg: "text-lg font-bold tracking-tight text-text-bright",
  titleMd: "text-base font-bold tracking-tight text-text-bright",
  titleSm: "text-xs font-bold uppercase tracking-wider text-teal-300",
  muted: "text-xs text-text-muted leading-relaxed",
  label: "block text-xs font-semibold text-text-main mb-1",

  // Buttons
  btnPrimary:
    "inline-flex items-center justify-center rounded-xl bg-steel-500 px-4 py-2 text-xs font-bold text-text-bright shadow-sm hover:bg-steel-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:cursor-not-allowed disabled:opacity-45 transition active:scale-[0.98]",
  btnAccent:
    "inline-flex items-center justify-center rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-steel-900 shadow-sm hover:bg-teal-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:cursor-not-allowed disabled:opacity-45 transition active:scale-[0.98]",
  btnSecondary:
    "inline-flex items-center justify-center rounded-xl border border-twilight-border bg-twilight-raised px-3.5 py-2 text-xs font-semibold text-text-bright shadow-2xs hover:bg-twilight-hover hover:border-steel-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:cursor-not-allowed disabled:opacity-45 transition",

  // Inputs & forms
  input:
    "w-full rounded-xl border border-twilight-border bg-twilight-base px-3 py-2 text-xs text-text-bright placeholder:text-text-subtle shadow-inner focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50",
  selectInline:
    "rounded-xl border border-twilight-border bg-twilight-base px-3 py-1.5 text-xs font-semibold text-text-bright shadow-2xs focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20",

  // Badges & pills
  badgePrimary:
    "inline-flex items-center rounded-full bg-steel-600/60 border border-steel-400/40 px-2.5 py-0.5 text-[11px] font-bold text-steel-100",
  badgeAccent:
    "inline-flex items-center rounded-full bg-teal-500/20 border border-teal-400/50 px-2.5 py-0.5 text-[11px] font-bold text-teal-300",
  badgeNeutral:
    "inline-flex items-center rounded-full bg-twilight-raised border border-twilight-border px-2.5 py-0.5 text-[11px] font-medium text-text-muted",
  badgeWarning:
    "inline-flex items-center rounded-full bg-amber-500/20 border border-amber-400/50 px-2.5 py-0.5 text-[11px] font-bold text-amber-300",

  // Tables
  tableWrap: "overflow-x-auto rounded-xl border border-twilight-border bg-twilight-base/50",
  table: "w-full text-left text-xs text-text-main tabular-nums",
  thead: "bg-twilight-raised text-[11px] font-bold uppercase tracking-wider text-text-muted border-b border-twilight-border",
  tbody: "divide-y divide-twilight-border/60 bg-twilight-surface/60",
} as const;
