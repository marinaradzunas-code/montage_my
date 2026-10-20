import React from "react";
import {
  AbsoluteFill,
  Interactive,
  Sequence,
  getRemotionEnvironment,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { ProjectGuides } from "../ProjectGuides";
import { at, beat } from "../scenes/motion";
import { negative, paper, positive } from "../scenes/tokens";
import {
  type Block,
  CARD_RADIUS,
  type Plan,
  blockIndexAt,
  morphT,
  sceneCardRect,
  videoGeo,
} from "./plan";

// Стиль 3 — общий движок композиции. Слои снизу вверх:
//   1. белые карточки с графикой (сцены и 45/55);
//   2. видео — одно на весь ролик, меняет форму на переходах (plan.ts);
//   3. свои эффекты (children): конфетти, логотипы, звуки акцентов;
//   4. крупные слова — единственный вид подписей во всём ролике.
//
// Слова встают по одному на свои места: на белом — чёрные, на видео — белые
// с тенью, без подложки. Цвет зависит от того, что лежит под строкой в этом
// кадре, поэтому на переходах он меняется сам. Шрифт — captionFont из
// editing-profile.json (Coolvetica, без неё — Tahoma).

export const STYLE3_FONT = "Coolvetica, 'Coolvetica Rg', Tahoma";

const PaperTheme = React.createContext(false);

/** true внутри белых карточек стиля 3: сцена может выбрать светлую тему. */
export const useIsPaper = () => React.useContext(PaperTheme);

/**
 * Где стоит строка слов в каждой компоновке: на белом под карточкой, на видео
 * во весь экран — у нижней трети, в 45/55 — на белой полосе между карточкой и
 * камерой. size — наибольший кегль; длинная фраза уменьшается под ширину 940.
 */
const SPOT: Record<Block["layout"], { y: number; size: number }> = {
  video: { y: 1300, size: 120 },
  card: { y: 1465, size: 126 },
  scene: { y: 1465, size: 126 },
  split: { y: 774, size: 100 },
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const rgba = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

/**
 * Какая доля строки лежит на видео. По ней выбирается цвет (белый на видео,
 * чёрный на белом), а пока край видео проходит прямо через строку, она на пару
 * кадров гаснет — чтобы не было чёрных букв на тёмном видео и наоборот.
 */
const overVideo = (plan: Plan, y: number, size: number, frame: number) => {
  const g = videoGeo(plan, frame);
  const top = y - size * 0.5;
  const bottom = y + size * 0.5;
  const share =
    (clamp01((Math.min(bottom, g.y + g.h) - Math.max(top, g.y)) / size) || 0) *
    g.opacity;
  const light = clamp01((share - 0.35) / 0.3);
  const visible = clamp01(Math.abs(share - 0.5) / 0.3);
  return { light: light * light * (3 - 2 * light), visible };
};

/**
 * Крупные слова: раскладка фразы считается сразу, слова мягко встают на свои
 * места вместе со звуком. Акцентное слово крупнее в 1,35 раза, под ним
 * протягивается маркер: на белом — цветом слова, на видео — ярким зелёным
 * или красным под белыми буквами.
 */
const Words = ({
  plan,
  frame,
  y,
  maxSize,
  light,
}: {
  plan: Plan;
  frame: number;
  y: number;
  maxSize: number;
  light: number;
}) => {
  const phrase = plan.phrases.find((p) => frame >= p.from && frame < p.to);
  if (!phrase) return null;
  const width =
    phrase.tokens.reduce(
      (sum, t) => sum + t.t.length * 0.55 * (t.tone ? 1.35 : 1),
      0,
    ) +
    (phrase.tokens.length - 1) * 0.34;
  const size = Math.min(maxSize, 940 / width);
  const ink = interpolateColors(light, [0, 1], [paper.ink, paper.onVideo]);
  const shadow =
    light > 0.01
      ? `0 0 3px rgba(0,0,0,${(0.55 * light).toFixed(2)}), 0 6px 24px rgba(0,0,0,${(0.45 * light).toFixed(2)})`
      : "none";
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: 1080,
        top: y,
        translate: "0px -50%",
        display: "flex",
        justifyContent: "center",
        alignItems: "baseline",
        gap: size * 0.34,
        whiteSpace: "nowrap",
        lineHeight: 1,
        letterSpacing: "-0.01em",
      }}
    >
      {phrase.tokens.map((t, i) => {
        const p = at(frame, t.f, t.f + 6);
        const toneWhite = t.tone === "win" ? paper.win : paper.pain;
        const toneVideo = t.tone === "win" ? positive : negative;
        const marker = t.tone ? at(frame, t.f + 3, t.f + 11) : 0;
        return (
          <span
            key={i}
            style={{
              position: "relative",
              zIndex: 0,
              display: "inline-block",
              fontSize: t.tone ? size * 1.35 : size,
              color: t.tone
                ? interpolateColors(light, [0, 1], [toneWhite, paper.onVideo])
                : ink,
              textShadow: shadow,
              opacity: Math.min(1, p * 1.6),
              translate: `0px ${((1 - p) * 26).toFixed(1)}px`,
              scale: String(
                (0.9 + 0.1 * p) * (t.tone ? beat(frame, t.f + 3, 12, 0.08) : 1),
              ),
            }}
          >
            {t.tone ? (
              <span
                style={{
                  position: "absolute",
                  zIndex: -1,
                  left: "-0.03em",
                  right: "-0.03em",
                  bottom: "0.04em",
                  height: "0.36em",
                  borderRadius: "0.1em",
                  background: interpolateColors(
                    light,
                    [0, 1],
                    [rgba(toneWhite, 0.16), rgba(toneVideo, 0.92)],
                  ),
                  scale: `${marker} 1`,
                  transformOrigin: "0% 50%",
                }}
              />
            ) : null}
            {t.t}
          </span>
        );
      })}
    </div>
  );
};

/** Строка слов едет вместе с компоновкой: с видео под карточку, на полосу 45/55. */
const CaptionLayer = ({ plan, frame }: { plan: Plan; frame: number }) => {
  const i = blockIndexAt(plan, frame);
  const b = plan.blocks[i];
  const prev = plan.blocks[i - 1];
  let { y, size } = SPOT[b.layout];
  const t = morphT(frame, b.from);
  if (prev && t < 1) {
    const from = SPOT[prev.layout];
    y = mix(from.y, y, t);
    size = mix(from.size, size, t);
  }
  const look = overVideo(plan, y, size, frame);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: look.visible }}>
      <Words
        plan={plan}
        frame={frame}
        y={y}
        maxSize={size}
        light={look.light}
      />
    </div>
  );
};

/** Пока видео нет — заглушка того же размера, что и кадр исходника. */
const Placeholder = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "linear-gradient(160deg,#2b3340,#171c24)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter",
      fontSize: 44,
      lineHeight: 1.4,
      color: "#8ea0b8",
      textAlign: "center",
    }}
  >
    Здесь ваше видео
  </div>
);

const VideoLayer = ({
  plan,
  frame,
  source,
}: {
  plan: Plan;
  frame: number;
  source?: string;
}) => {
  const g = videoGeo(plan, frame);
  return (
    <div
      style={{
        position: "absolute",
        left: g.x,
        top: g.y,
        width: g.w,
        height: g.h,
        borderRadius: g.r,
        overflow: "hidden",
        opacity: g.opacity,
        boxShadow:
          g.card > 0
            ? `0 18px 50px rgba(16,22,32,${(0.1 * g.card).toFixed(3)}), 0 2px 6px rgba(16,22,32,${(0.05 * g.card).toFixed(3)})`
            : "none",
      }}
    >
      <div style={{ position: "absolute", ...g.inner }}>
        {source ? (
          <Video
            src={source}
            muted
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Placeholder />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: g.r,
          boxShadow: `inset 0 0 0 1px ${paper.cardLine}`,
          opacity: g.card,
        }}
      />
    </div>
  );
};

/** Карточка с графикой: холст сцены 888×800 по центру, масштаб по высоте карточки. */
const SceneCard = ({
  plan,
  block,
}: {
  plan: Plan;
  block: Extract<Block, { scene: unknown }>;
}) => {
  const frame = useCurrentFrame() + block.from;
  const r = sceneCardRect(plan, block, frame);
  const Scene = block.scene;
  return (
    <div
      style={{
        position: "absolute",
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: CARD_RADIUS,
        overflow: "hidden",
        background: paper.card,
        border: `1px solid ${paper.cardLine}`,
        boxShadow: paper.cardShadow,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: (r.w - 888) / 2,
          top: (r.h - 800) / 2,
          width: 888,
          height: 800,
          scale: String(r.stage),
        }}
      >
        <Scene />
      </div>
    </div>
  );
};

/**
 * Композиция стиля 3. source — видео (staticFile), voice — звук голоса после
 * обработки; без source показывается заглушка. children — свои эффекты поверх
 * видео (конфетти, логотипы, звуки акцентов), кадры в них — по шкале монтажа.
 */
export const Style3Video = ({
  plan,
  source,
  voice,
  showGuides = true,
  children,
}: {
  plan: Plan;
  source?: string;
  voice?: string;
  showGuides?: boolean;
  children?: React.ReactNode;
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: paper.ground,
        fontFamily: STYLE3_FONT,
        fontSynthesis: "none",
      }}
    >
      <PaperTheme.Provider value>
        {plan.blocks.map((b, i) =>
          b.layout === "scene" || b.layout === "split" ? (
            <Sequence
              key={i}
              name={`${b.layout === "split" ? "45/55" : "Карточка"} ${i + 1}`}
              from={b.from}
              durationInFrames={b.to - b.from}
              style={{ zIndex: 1 }}
            >
              <SceneCard plan={plan} block={b} />
            </Sequence>
          ) : null,
        )}
      </PaperTheme.Provider>

      <Interactive.Div
        name="Видео • одно на весь ролик"
        durationInFrames={plan.frames}
        style={{ position: "absolute", inset: 0, zIndex: 3 }}
      >
        <VideoLayer plan={plan} frame={frame} source={source} />
      </Interactive.Div>

      <Sequence
        name="Эффекты"
        durationInFrames={plan.frames}
        style={{ zIndex: 4 }}
      >
        {children}
      </Sequence>

      <Sequence
        name="Крупные слова"
        durationInFrames={plan.frames}
        style={{ zIndex: 5 }}
      >
        <CaptionLayer plan={plan} frame={frame} />
      </Sequence>

      {voice ? <Audio name="Голос" src={voice} volume={1} /> : null}

      <Sequence
        name="Направляющие • НЕ ЭКСПОРТ"
        durationInFrames={plan.frames}
        style={{ zIndex: 20, pointerEvents: "none" }}
      >
        {showGuides && !getRemotionEnvironment().isRendering ? (
          <ProjectGuides opacity={0.4} />
        ) : null}
      </Sequence>
    </AbsoluteFill>
  );
};
