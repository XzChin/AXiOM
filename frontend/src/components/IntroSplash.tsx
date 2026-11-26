import { useEffect, useRef } from "react";

interface Props {
  onDone: () => void;
}

export function IntroSplash({ onDone }: Props) {
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    skipRef.current?.focus();
    const timer = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="intro-splash"
      role="dialog"
      aria-label="Multiverse of Monsoon introduction"
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") onDone();
        if (event.key === "Tab") {
          event.preventDefault();
          skipRef.current?.focus();
        }
      }}
    >
      <div className="intro-content" aria-hidden="true">
        <div className="intro-mark">
          <svg viewBox="0 0 100 88" className="intro-logo" fill="none">
            <path className="intro-rain intro-rain-one" d="M18 18v8M34 8v9M50 18v8M66 8v9M82 18v8" />
            <path className="intro-m" d="M13 70V35l18 20 19-26 19 26 18-20v35" />
            <path className="intro-wave" d="M18 79c10-5 18-5 28 0s18 5 28 0" />
          </svg>
        </div>
        <p className="intro-kicker">INDIA · EARTH SYSTEM · DIGITAL TWIN</p>
        <h1 className="intro-title">MULTIVERSE <span>OF MONSOON</span></h1>
        <p className="intro-subtitle">A new way to explore the atmosphere.</p>
      </div>
      <button ref={skipRef} className="intro-skip" onClick={onDone} type="button">Skip intro <span aria-hidden="true">↗</span></button>
      <div className="intro-progress" role="progressbar" aria-label="Opening animation" aria-valuemin={0} aria-valuemax={100} />
    </div>
  );
}
