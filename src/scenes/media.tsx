import { useCurrentFrame } from "remotion";
import { Scissors } from "lucide-react";
import { at, beat } from "./motion";
import { accent, palette, radius, stroke } from "./tokens";

// Звук и монтаж как предметы.
//
// Волна — это «микрофон работает»: пока идёт речь, столбики живут, в тишине
// ложатся. Таймлайн — это «монтаж»: клипы стоят на дорожке, между ними пауза,
// ножницы проходят по паузе, и клипы съезжаются. Зритель видит глагол
// «вырезать», а не слово «монтаж».

/** Детерминированный шум: один и тот же кадр всегда рисуется одинаково. */
const noise = (i: number, frame: number) =>
  0.5 +
  0.28 * Math.sin(i * 1.7 + frame * 0.43) +
  0.16 * Math.sin(i * 0.61 - frame * 0.27) +
  0.06 * Math.sin(i * 3.1 + frame * 0.9);

/**
 * Волна звука. `from`–`to` — когда звук идёт; до и после столбики лежат.
 * `tone` — цвет столбиков: по умолчанию акцент, приглушённый — `muted`.
 */
export const Waveform = ({
  bars = 22,
  width = 260,
  height = 72,
  from = 0,
  to = Infinity,
  tone = accent,
  light = false,
  muted = false,
  frozen = false,
}: {
  bars?: number;
  width?: number;
  height?: number;
  from?: number;
  to?: number;
  tone?: string;
  light?: boolean;
  muted?: boolean;
  /** Записанный звук: форма стоит на месте, а не дышит, как живой индикатор. */
  frozen?: boolean;
}) => {
  const now = useCurrentFrame();
  const frame = frozen ? 7 : now;
  const stop = Number.isFinite(to) ? at(frame, to, to + 8) : 0;
  const live = frozen ? 1 : at(frame, from, from + 8) * (1 - stop);
  const gap = width / bars;
  const color = muted ? palette(light).textMuted : tone;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {Array.from({ length: bars }, (_, i) => {
        // Края волны ниже середины — так выглядит настоящий индикатор уровня.
        const envelope = Math.sin(((i + 0.5) / bars) * Math.PI) ** 0.7;
        const h = Math.max(6, height * (0.08 + 0.92 * live * envelope * noise(i, frame)));
        return (
          <rect
            key={i}
            x={i * gap + gap * 0.22}
            y={(height - h) / 2}
            width={gap * 0.56}
            height={h}
            rx={gap * 0.28}
            fill={color}
            opacity={0.35 + 0.65 * live}
          />
        );
      })}
    </svg>
  );
};

export type Clip = { width: number; kind?: "speech" | "pause" };

/**
 * Дорожка монтажа: клипы речи и паузы между ними.
 *
 * `cutAt[k]` — кадр, на котором вырезается k-я пауза (по порядку слева).
 * Ножницы подъезжают к паузе, пауза схлопывается, правые клипы съезжают.
 * `playhead` — от какого до какого кадра через дорожку идёт курсор
 * воспроизведения; без него дорожка стоит.
 */
export const ClipTimeline = ({
  clips,
  cutAt,
  from = 0,
  playhead,
  height = 112,
  light = false,
}: {
  clips: Clip[];
  cutAt: number[];
  from?: number;
  playhead?: [number, number];
  height?: number;
  light?: boolean;
}) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  let pauseIndex = -1;
  let x = 0;
  const placed = clips.map((clip, i) => {
    const isPause = clip.kind === "pause";
    let width = clip.width;
    let cut = 0;
    let cutFrame = Infinity;
    if (isPause) {
      pauseIndex += 1;
      cutFrame = cutAt[pauseIndex] ?? Infinity;
      cut = at(frame, cutFrame + 6, cutFrame + 20);
      width = clip.width * (1 - cut);
    }
    const arrive = at(frame, from + i * 3, from + i * 3 + 14);
    const item = { i, x, width, isPause, cut, cutFrame, arrive, full: clip.width };
    x += width + (width > 0.5 ? 10 : 0);
    return item;
  });
  const total = x - 10;
  const head = playhead ? at(frame, playhead[0], playhead[1]) : 0;
  const nextCut = placed.find((p) => p.isPause && frame < p.cutFrame + 20);

  return (
    <div style={{ position: "relative", width: total, height: height + 90 }}>
      {placed.map((p) =>
        p.width < 0.5 ? null : (
          <div
            key={p.i}
            style={{
              position: "absolute",
              left: p.x,
              top: 60,
              width: p.width,
              height,
              borderRadius: radius.small,
              opacity: p.arrive * (1 - p.cut * 0.6),
              translate: `0px ${(1 - p.arrive) * 24}px`,
              ...(p.isPause
                ? {
                    // Пауза — пустое место со штриховкой: в ней нечего слушать.
                    border: `2px dashed ${c.lineStrong}`,
                    background: `repeating-linear-gradient(135deg, ${c.line} 0 10px, transparent 10px 20px)`,
                  }
                : {
                    background: `${accent}2e`,
                    border: `2px solid ${accent}88`,
                    overflow: "hidden",
                  }),
            }}
          >
            {p.isPause ? null : (
              <div style={{ position: "absolute", inset: "18px 10px" }}>
                <Waveform bars={Math.max(6, Math.round(p.width / 16))} width={p.width - 20} height={height - 36} frozen />
              </div>
            )}
          </div>
        ),
      )}
      {/* Ножницы едут к следующей паузе и щёлкают на её кадре. */}
      {nextCut ? (
        <div
          style={{
            position: "absolute",
            left: nextCut.x + nextCut.full / 2 - 34,
            top: -6,
            width: 68,
            height: 68,
            borderRadius: radius.round,
            background: palette(light).surfaceSolid,
            border: `1px solid ${c.lineStrong}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: at(frame, nextCut.cutFrame - 12, nextCut.cutFrame - 4) * (1 - nextCut.cut),
            scale: String(beat(frame, nextCut.cutFrame, 12, 0.25)),
            rotate: `${frame >= nextCut.cutFrame && frame < nextCut.cutFrame + 6 ? -18 : 0}deg`,
          }}
        >
          <Scissors size={34} color={c.text} strokeWidth={stroke} />
        </div>
      ) : null}
      {playhead ? (
        <div
          style={{
            position: "absolute",
            left: head * total,
            top: 44,
            width: 4,
            height: height + 32,
            borderRadius: 4,
            background: "#ffffff",
            boxShadow: "0 0 18px rgba(255,255,255,.5)",
            opacity: at(frame, playhead[0], playhead[0] + 6),
          }}
        />
      ) : null}
    </div>
  );
};
