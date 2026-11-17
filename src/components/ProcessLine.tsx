import type { CSSProperties } from "react";
import type { ProcessLine as Line, ProcessStep } from "../lib/processLine";
import { formatDateTime, formatPeriod } from "../lib/time";
import { t } from "../i18n";

interface ProcessLineProps {
  line: Line;
  locale: string;
  /** Color of the stages of the process: magenta (inheritance) or sky (recovery). The first stage is always cyan. */
  tone: "heir" | "contact";
  /** Stages with another color (e.g. "Heirs can take over" in magenta inside the contact's line). */
  toneOf?: (key: string) => "heir" | "contact" | undefined;
}

function whenText(step: ProcessStep, locale: string): string {
  if (step.when.kind === "at") return formatDateTime(step.when.at, locale);
  const period = formatPeriod(step.when.period);
  return step.when.notBefore === null ? t("process.afterStart", { period }) : t("process.afterStartNotBefore", { period, date: formatDateTime(step.when.notBefore, locale) });
}

/**
 * Timeline of the process (heir or contact), with the language of the plan's succession line: dotted rail,
 * cyan origin, traveled segment colored and "now" dot. The stages reached are shown in normal text; the next ones,
 * dimmed.
 */
export function ProcessLine({ line, locale, tone, toneOf }: ProcessLineProps) {
  return (
    <ol className="ui-process" aria-label={t("process.timeline")}>
      {line.steps.map((step, i) => {
        const done = i <= line.reached;
        const current = i === line.reached && i < line.steps.length - 1;
        const stepTone = i === 0 ? "origin" : (toneOf?.(step.key) ?? tone);
        const style = current ? ({ "--ui-process-f": String(line.fraction) } as CSSProperties) : undefined;
        return (
          <li
            key={step.key}
            className="ui-process__step"
            data-done={done}
            data-current={current}
            data-tone={stepTone}
            data-last={i === line.steps.length - 1}
            style={style}
            aria-current={current ? "step" : undefined}
          >
            <span className="ui-process__marker" aria-hidden="true" />
            <span className="ui-process__text">
              <b>{step.title}</b>
              <span>{whenText(step, locale)}</span>
            </span>
            {/* The "now" dot only inside the segment: stuck to a stage it would be confused with its mark. */}
            {current && line.fraction > 0.05 && line.fraction < 0.95 && <span className="ui-process__now" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
