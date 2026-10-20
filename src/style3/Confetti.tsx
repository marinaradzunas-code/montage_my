import {
  Interactive,
  Sequence,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio } from "@remotion/media";
import { paper } from "../scenes/tokens";

// Конфетти — праздничный момент стиля 3 вместо эмодзи: частицы вылетают из
// точки (x, y), кружатся и падают. Ставить только на настоящий повод
// (продажа, запуск, мастер-класс), не чаще раза за ролик.

const Particles = ({
  frame,
  from,
  to,
  x,
  y,
}: {
  frame: number;
  from: number;
  to: number;
  x: number;
  y: number;
}) => {
  const life = frame - from;
  if (life < 0) return null;
  const fade = interpolate(frame, [to - 5, to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <>
      {Array.from({ length: 44 }, (_, i) => {
        const angle =
          -Math.PI / 2 + (random(`cf-a-${i}`) - 0.5) * Math.PI * 1.2;
        const v = 26 + random(`cf-v-${i}`) * 22;
        const spin = life * (10 + random(`cf-s-${i}`) * 14);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(angle) * v * life,
              top: y + Math.sin(angle) * v * life + 1.6 * life * life,
              width: 16,
              height: 28,
              borderRadius: 4,
              background: paper.confetti[i % paper.confetti.length],
              rotate: `${spin}deg`,
              scale: `1 ${Math.cos(spin / 25).toFixed(2)}`,
              opacity: fade,
            }}
          />
        );
      })}
    </>
  );
};

/**
 * Кадры from/to — по шкале монтажа: ставить среди children у Style3Video.
 * Тихий звук акцента в начале.
 */
export const Confetti = ({
  from,
  to,
  x = 540,
  y = 330,
  name = "Эффект • конфетти",
}: {
  from: number;
  to: number;
  x?: number;
  y?: number;
  name?: string;
}) => {
  // Кадр берём здесь: внутри Interactive.Div со сдвигом from он локальный.
  const frame = useCurrentFrame();
  return (
    <>
      <Sequence from={from} durationInFrames={20} name="Звук • конфетти">
        <Audio src={staticFile("soft-tick.wav")} volume={0.26} />
      </Sequence>
      <Interactive.Div
        name={name}
        from={from}
        durationInFrames={to - from}
        style={{ position: "absolute", inset: 0 }}
      >
        <Particles frame={frame} from={from} to={to} x={x} y={y} />
      </Interactive.Div>
    </>
  );
};
