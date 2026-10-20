import React from "react";
import { useCurrentFrame } from "remotion";
import { at, beat } from "./motion";
import { accent, palette, radius, type as typo } from "./tokens";

// Числа и длительности.
//
// Число в кадре не ставится готовым: оно набегает от нуля до сказанного
// значения ровно тогда, когда его произносят (motion-direction.json →
// progression.numbers). Диапазон «20–30 секунд» — это отрезок на шкале,
// который сначала встаёт в 20, а на «30» дотягивается до конца.

/** Число, которое набегает от `a` до `b` между кадрами `from` и `to`. */
export const CountUp = ({
  from,
  to,
  a = 0,
  b,
  format = (n: number) => String(n),
  style,
}: {
  from: number;
  to: number;
  a?: number;
  b: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const value = Math.round(a + (b - a) * at(frame, from, to));
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", display: "inline-block", scale: String(beat(frame, to, 12, 0.08)), ...style }}>
      {format(value)}
    </span>
  );
};

/** Секунды как 0:20. */
export const clock = (seconds: number) => `0:${String(seconds).padStart(2, "0")}`;

/**
 * Шкала времени с отрезком. Отрезок появляется в `lo` на кадре `startAt` и
 * дотягивается до `hi` к кадру `extendAt`. Подписи — только у делений.
 */
export const RangeTrack = ({
  max = 60,
  step = 10,
  lo,
  hi,
  startAt,
  extendAt,
  from = 0,
  width = 760,
  light = false,
  unit = "с",
}: {
  max?: number;
  step?: number;
  lo: number;
  hi: number;
  startAt: number;
  extendAt: number;
  from?: number;
  width?: number;
  light?: boolean;
  unit?: string;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const show = at(frame, from, from + 14);
  const grow = at(frame, startAt, startAt + 12);
  const extend = at(frame, extendAt, extendAt + 14);
  const x = (v: number) => (v / max) * width;
  const left = x(lo);
  const right = x(lo + (hi - lo) * extend);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return (
    <div style={{ position: "relative", width, height: 120, opacity: show, translate: `0px ${(1 - show) * 18}px` }}>
      <div style={{ position: "absolute", left: 0, top: 30, width, height: 14, borderRadius: radius.round, background: c.surface, border: `1px solid ${c.line}` }} />
      <div
        style={{
          position: "absolute",
          left: left - 12 * grow,
          top: 22,
          width: Math.max(0, right - left) + 24 * grow,
          height: 30,
          borderRadius: radius.round,
          background: accent,
          opacity: grow,
          scale: String(beat(frame, extendAt, 12, 0.06)),
          boxShadow: `0 0 34px ${accent}66`,
        }}
      />
      {ticks.map((t) => (
        <div key={t} style={{ position: "absolute", left: x(t), top: 64, translate: "-50% 0", ...typo.caption, fontSize: 28, color: t >= lo && t <= hi && grow > 0.5 ? c.text : c.textMuted }}>
          {t}
          {t === max ? ` ${unit}` : ""}
        </div>
      ))}
    </div>
  );
};
