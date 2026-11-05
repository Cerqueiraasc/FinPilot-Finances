export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
      <svg aria-hidden viewBox="0 0 64 64" className="size-7">
        <rect width="64" height="64" rx="14" fill="var(--primary)" />
        <path
          d="M16 44 28 30l8 7 12-17"
          fill="none"
          stroke="var(--on-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      FinPilot
    </span>
  );
}
