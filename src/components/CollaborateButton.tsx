"use client";

import Link from "next/link";

type CollaborateButtonProps = {
  href: string;
  label?: string;
  className?: string;
  compact?: boolean;
};

const baseClassName =
  "group inline-flex items-center gap-2 rounded-xl border border-accent/25 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 font-semibold text-accent-strong shadow-[0_6px_18px_rgba(0,98,65,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-100 hover:to-cyan-100 hover:shadow-[0_10px_22px_rgba(0,98,65,0.2)]";

export default function CollaborateButton({
  href,
  label = "Collaborate",
  className = "",
  compact = false,
}: CollaborateButtonProps) {
  const sizeClassName = compact ? "px-3 py-2 text-sm" : "px-4 py-2 text-sm";
  const iconSizeClassName = compact ? "h-7 w-7" : "h-8 w-8";

  return (
    <Link href={href} className={`${baseClassName} ${sizeClassName} ${className}`.trim()}>
      <span
        className={`relative inline-flex ${iconSizeClassName} shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent text-true-white shadow-[0_4px_12px_rgba(0,98,65,0.35)]`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.8">
          <path d="M12 5v14" strokeLinecap="round" />
          <path d="M5 12h14" strokeLinecap="round" />
        </svg>
      </span>
      <span>{label}</span>
    </Link>
  );
}
