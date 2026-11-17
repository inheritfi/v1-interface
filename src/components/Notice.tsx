import type { ReactNode } from "react";

type Tone = "notice" | "error" | "info";

interface NoticeProps {
  tone: Tone;
  title: string;
  children?: ReactNode;
}

const ICONS: Record<Tone, ReactNode> = {
  notice: (
    <>
      <path d="M12 3 2 21h20L12 3Z" fill="none" strokeWidth="2" />
      <path d="M12 10v5M12 18v.5" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
      <path d="M12 7v6M12 16v.5" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
      <path d="M12 11v6M12 7.5v.5" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};

/** Amber for warnings, orange-red for errors, sky for information. */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div className={`ui-notice ui-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <svg className="ui-notice__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        {ICONS[tone]}
      </svg>
      <div>
        <strong>{title}</strong> {children}
      </div>
    </div>
  );
}
