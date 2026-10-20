import React from "react";
import { useCurrentFrame } from "remotion";
import { at, beat, drift, enter } from "./motion";
import { card, negative, palette, positive, radius, type as typo } from "./tokens";
import { Emoji } from "./chips";

// Состояние предмета: проверено, отменено, заменено.
//
// «Проверить», «без», «вместо» — это глаголы, и у каждого своя картинка.
// Отметка появляется не вместе со строкой, а на слове, которое её означает:
// строка пришла → поработала → получила галочку. Одна строка — одно событие,
// поэтому в сцене с двумя строками всегда есть что показать каждые полсекунды.

/** Галочка в круге: пустая до checkAt, затем заливается и прорисовывается. */
export const Check = ({ at: checkAt, size = 64, light = false }: { at: number; size?: number; light?: boolean }) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const fill = at(frame, checkAt, checkAt + 8);
  const draw = at(frame, checkAt + 3, checkAt + 14);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius.round,
        border: `3px solid ${fill > 0 ? positive : c.lineStrong}`,
        background: `rgba(53,198,107,${0.95 * fill})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        scale: String(beat(frame, checkAt, 14, 0.22)),
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
        <path
          d="M4.5 12.5l5 5 10-11"
          fill="none"
          stroke="#ffffff"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={26}
          strokeDashoffset={26 * (1 - draw)}
        />
      </svg>
    </div>
  );
};

/**
 * Строка проверки: значок, название, место под «живое» содержимое и галочка.
 *
 * `from` — строка приходит (на слове-предмете), `checkAt` — галочка (на слове
 * результата). Между ними строка работает: в `children` кладут волну звука,
 * полосу загрузки — то, что показывает саму проверку.
 */
export const CheckRow = ({
  label,
  emoji,
  icon,
  from,
  checkAt,
  width = 760,
  light = false,
  children,
}: {
  label: React.ReactNode;
  emoji?: string;
  icon?: React.ReactNode;
  from: number;
  checkAt: number;
  width?: number;
  light?: boolean;
  children?: React.ReactNode;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const state = enter(frame, from, 18);
  const done = at(frame, checkAt, checkAt + 10);
  return (
    <div
      style={{
        width,
        height: 132,
        ...card(light, true),
        borderRadius: radius.panel,
        // Проверенная строка чуть светлеет по краю — «зелёным» красится только галочка.
        borderColor: done > 0 ? `rgba(53,198,107,${0.18 + 0.3 * done})` : c.line,
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: "0 30px 0 28px",
        boxSizing: "border-box",
        opacity: state.opacity,
        scale: String(state.scale),
        rotate: `${state.rotate * 0.4}deg`,
        translate: `0px ${drift(frame, 150, 3, from * 0.02)}px`,
      }}
    >
      {emoji ? <Emoji name={emoji} size={68} /> : icon}
      <div style={{ ...typo.title, fontSize: 50, color: c.text, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", minWidth: 0 }}>
        {children}
      </div>
      <Check at={checkAt} light={light} />
    </div>
  );
};

/**
 * Зачёркивание: линия протягивается через предмет, сам он гаснет и сереет.
 * Это картинка слов «без», «не», «вместо» — отрицание показываем, а не пишем.
 */
export const Strike = ({
  at: strikeAt,
  children,
  style,
}: {
  at: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const draw = at(frame, strikeAt, strikeAt + 12);
  const dim = at(frame, strikeAt + 6, strikeAt + 18);
  return (
    <div style={{ position: "relative", display: "inline-flex", ...style }}>
      <div style={{ opacity: 1 - dim * 0.55, filter: `saturate(${1 - dim})` }}>{children}</div>
      <div
        style={{
          position: "absolute",
          left: "-4%",
          top: "50%",
          height: 7,
          width: `${108 * draw}%`,
          borderRadius: 7,
          background: negative,
          rotate: "-8deg",
          transformOrigin: "left center",
          boxShadow: "0 4px 18px rgba(0,0,0,.45)",
        }}
      />
    </div>
  );
};
