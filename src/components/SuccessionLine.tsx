import { computeSuccession, formatDate, linePosition, type SuccessionInput } from "../lib/succession";
import { formatPeriod } from "../lib/time";
import { t } from "../i18n";

interface SuccessionLineProps extends SuccessionInput {
  locale: string;
}

const TOP = 12;
const BOTTOM = 228;

const LABEL_GAP = 52;

function y(position: number): number {
  return TOP + (BOTTOM - TOP) * position;
}

/** The middle label is separated from the ends so that they never overlap; the mark stays at its real place. */
function labelTop(markerY: number): number {
  return Math.min(Math.max(markerY, TOP + LABEL_GAP), BOTTOM - LABEL_GAP);
}

/**
 * The succession line of the logo: cyan origin (last proof of life), time running,
 * mark of the recovery period and magenta destination (the heirs can start the inheritance).
 */
export function SuccessionLine({ locale, ...input }: SuccessionLineProps) {
  const s = computeSuccession(input);
  const nowY = y(linePosition(input.now, input.lastActivity, input.inheritancePeriod));
  const recoveryY = y(linePosition(s.recoveryOpensAt, input.lastActivity, input.inheritancePeriod));
  const recoveryOpen = s.phase !== "active";
  const inheritanceOpen = s.phase === "inheritance-open";

  return (
    <div className="ui-succession">
      <svg className="ui-succession__rail" width="28" height="240" viewBox="0 0 28 240" aria-hidden="true">
        <line x1="14" y1={TOP} x2="14" y2={BOTTOM} className="ui-succession__track" />
        <line x1="14" y1={TOP} x2="14" y2={nowY} className="ui-succession__elapsed" />
        <circle cx="14" cy={TOP} r="7" className="ui-succession__origin" />
        <rect x="5" y={recoveryY - 2} width="18" height="4" rx="2" className="ui-succession__recovery" />
        <circle cx="14" cy={nowY} r="4" className="ui-succession__now" />
        <circle cx="14" cy={BOTTOM} r="7" className="ui-succession__destination" />
      </svg>
      <ol className="ui-succession__steps">
        <li style={{ top: TOP }}>
          <b>{t("succession.lastActive", { date: formatDate(input.lastActivity, locale) })}</b>
          <span>{t("succession.lastActiveNote")}</span>
        </li>
        <li style={{ top: labelTop(recoveryY) }} data-open={recoveryOpen}>
          <b>{t("succession.after", { period: formatPeriod(input.recoveryPeriod), date: formatDate(s.recoveryOpensAt, locale) })}</b>
          <span>{recoveryOpen ? t("succession.recoveryNow") : t("succession.recovery")}</span>
        </li>
        <li style={{ top: BOTTOM }} data-open={inheritanceOpen}>
          <b>{t("succession.after", { period: formatPeriod(input.inheritancePeriod), date: formatDate(s.inheritanceOpensAt, locale) })}</b>
          <span>{inheritanceOpen ? t("succession.inheritanceNow") : t("succession.inheritance")}</span>
        </li>
      </ol>
    </div>
  );
}
