"use client";

import { useState } from "react";
import { formatFeetInches, parseAreaInput, parseFeet } from "@/lib/units";

const fieldBase =
  "w-full rounded-lg border bg-field px-3 py-2 text-right font-mono text-sm text-fg " +
  "placeholder:text-muted";

/** Length / breadth box. Shows 17'-3" but also accepts 17.25 or 17-3 when typing. */
export function FeetInput({
  value,
  onCommit,
  label,
}: {
  value: number;
  onCommit: (feet: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);

  const finish = () => {
    if (draft === null) return;
    const n = parseFeet(draft);
    if (n === null || n <= 0) {
      setBad(true);
    } else {
      setBad(false);
      if (Math.abs(n - value) > 1e-9) onCommit(n);
    }
    setDraft(null);
  };

  return (
    <input
      aria-label={label}
      aria-invalid={bad}
      inputMode="text"
      className={`${fieldBase} ${bad ? "border-danger" : "border-line"}`}
      value={draft ?? (value > 0 ? formatFeetInches(value) : "")}
      placeholder={`e.g. 12'-6"`}
      onFocus={() => setDraft(value > 0 ? formatFeetInches(value) : "")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      title={bad ? `Use a size like 12'-6" or 12.5` : undefined}
    />
  );
}

/**
 * Area box. Accepts a number (3887.8) or a sum of parts (214.5+891.87), the way the client's sheet does.
 * Editing it by hand marks the room as a manual override.
 */
export function AreaInput({
  value,
  expr,
  overridden,
  onCommit,
  onReset,
  label,
}: {
  value: number;
  expr?: string;
  overridden: boolean;
  onCommit: (area: number, expr?: string) => void;
  onReset: () => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);

  const finish = () => {
    if (draft === null) return;
    const parsed = parseAreaInput(draft);
    if (!parsed) {
      setBad(true);
    } else {
      setBad(false);
      if (Math.abs(parsed.value - value) > 1e-9 || parsed.expr !== expr) onCommit(parsed.value, parsed.expr);
    }
    setDraft(null);
  };

  return (
    <div className="relative">
      <input
        aria-label={label}
        aria-invalid={bad}
        inputMode="decimal"
        className={`${fieldBase} ${bad ? "border-danger" : overridden ? "border-amber" : "border-line"}`}
        value={draft ?? value.toFixed(2)}
        onFocus={() => setDraft(expr ?? String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        title={bad ? "Type a number, or parts added together like 214.5+891.87" : expr ? `= ${expr}` : undefined}
      />
      {overridden && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onReset}
          title="Set by hand. Click to recalculate from length × breadth"
          aria-label="Recalculate area from length and breadth"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded px-1 text-xs text-amber hover:bg-band"
        >
          ↺
        </button>
      )}
    </div>
  );
}
