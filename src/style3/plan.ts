import type React from "react";
import { Easing, interpolate } from "remotion";
import { at } from "../scenes/motion";

// Стиль 3 (стиль автора): видео на весь экран, белые карточки на акцентах,
// крупные слова. Здесь — раскладка ролика и геометрия кадра без React: какие
// кадры идут видео на весь экран, где видео уходит в белую карточку, где
// карточка с графикой, где 45/55, и как видео «переезжает» между ними.
//
// Видео в кадре одно. На смене компоновки оно не исчезает, а меняет форму:
// за MORPH кадров сжимается в карточку, съезжает под графику 45/55 и снова
// разворачивается на весь экран. Затемнений и полупрозрачных лиц нет.
// Правила стиля — MONTAGE_RULES.md, «Стиль автора — белый фон и крупные слова».

export const SEAM = 858;
/** Длительность перехода видео ↔ карточка, кадров. */
export const MORPH = 14;
export const CARD_RADIUS = 32;

export type Rect = { x: number; y: number; w: number; h: number };
export const RECT = {
  screen: { x: 0, y: 0, w: 1080, h: 1920 },
  /** Карточка полного экрана: под ней крупные слова. */
  card: { x: 60, y: 170, w: 960, h: 1130 },
  /** Карточка 45/55 над камерой; между ней и камерой — полоса крупных слов. */
  top: { x: 60, y: 150, w: 960, h: 540 },
  cam: { x: 0, y: SEAM, w: 1080, h: 1920 - SEAM },
} as const;

type Scene = () => React.ReactElement;

/**
 * Блок компоновки (кадры по шкале монтажа, конец не включается):
 * - video — видео на весь экран (основа ролика);
 * - card — то же видео в белой карточке, слова под ней (перебивки исходника:
 *   фото, скриншоты); focus — какая доля высоты кадра в центре карточки;
 * - scene — белая карточка с графикой (сцена на холсте 888×800), слова под ней;
 * - split — 45/55: графика сверху, камера снизу от шва Y=858.
 */
export type Block =
  | { from: number; to: number; layout: "video" }
  | { from: number; to: number; layout: "card"; focus: number }
  | { from: number; to: number; layout: "scene"; scene: Scene }
  | {
      from: number;
      to: number;
      layout: "split";
      scene: Scene;
      cam: { focus: number; zoom: number };
    };

/**
 * Наезд на видео во весь экран, по планам исходника. z0→z1 — медленный наезд
 * за весь план (кадр не стоит), punch — мягкое приближение (+5–6 %) на ударном
 * слове. ox/oy — точка в кадре 1080×1920, к которой наезжаем (лицо или
 * предмет), чтобы она оставалась на месте. open — быстрый первый наезд.
 */
export type Shot = {
  from: number;
  to: number;
  z0: number;
  z1: number;
  ox: number;
  oy: number;
  open?: boolean;
  punch?: { at: number; by: number }[];
};

/** Слово крупных подписей: f — кадр появления, tone — акцент (результат/боль). */
export type Token = { t: string; f: number; tone?: "win" | "pain" };
export type Phrase = { from: number; to: number; tokens: Token[] };

export type Plan = {
  /** Длина ролика в кадрах. */
  frames: number;
  /** Размер исходника в пикселях (для кадрирования «cover»). */
  srcW: number;
  srcH: number;
  blocks: Block[];
  shots: Shot[];
  phrases: Phrase[];
};

export type Box = { left: number; top: number; width: number; height: number };
export type Geo = Rect & {
  r: number;
  card: number;
  opacity: number;
  inner: Box;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const blockIndexAt = (plan: Plan, frame: number) => {
  const i = plan.blocks.findIndex((b) => frame >= b.from && frame < b.to);
  return i < 0 ? plan.blocks.length - 1 : i;
};

/** Плавный переход: медленно трогается и мягко садится. */
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const morphT = (frame: number, from: number) =>
  interpolate(frame, [from, from + MORPH], [0, 1], {
    easing: EASE_IN_OUT,
    ...clamp,
  });

const shotAt = (plan: Plan, frame: number): Shot =>
  plan.shots.find((s) => frame >= s.from && frame < s.to) ??
  [...plan.shots].reverse().find((s) => s.to <= frame) ??
  plan.shots[0] ?? { from: 0, to: plan.frames, z0: 1, z1: 1, ox: 540, oy: 960 };

const zoomAt = (plan: Plan, frame: number) => {
  const s = shotAt(plan, frame);
  const base = s.open
    ? s.z0 + (s.z1 - s.z0) * at(frame, s.from, s.from + 24)
    : interpolate(frame, [s.from, s.to], [s.z0, s.z1], clamp);
  const punch = (s.punch ?? []).reduce(
    (sum, p) => sum + p.by * at(frame, p.at, p.at + 10),
    0,
  );
  return { z: base + punch, ox: s.ox, oy: s.oy };
};

/** Видео «cover» в рамке w×h: доля высоты focus стоит на высоте anchor. */
export const coverBox = (
  plan: Plan,
  w: number,
  h: number,
  focus: number,
  zoom = 1,
  anchor = 0.5,
): Box => {
  const scale = Math.max(w / plan.srcW, h / plan.srcH) * zoom;
  const width = plan.srcW * scale;
  const height = plan.srcH * scale;
  return {
    left: (w - width) / 2,
    top: Math.min(0, Math.max(h - height, h * anchor - focus * height)),
    width,
    height,
  };
};

/** Как стоит видео в блоке, если не идёт переход. */
const steady = (plan: Plan, b: Block, frame: number): Geo => {
  if (b.layout === "video") {
    const full = coverBox(plan, 1080, 1920, 0.5);
    const { z, ox, oy } = zoomAt(plan, frame);
    return {
      ...RECT.screen,
      r: 0,
      card: 0,
      opacity: 1,
      inner: {
        left: ox * (1 - z) + full.left * z,
        top: oy * (1 - z) + full.top * z,
        width: full.width * z,
        height: full.height * z,
      },
    };
  }
  if (b.layout === "card") {
    const drift = interpolate(frame, [b.from, b.to], [1, 1.06], clamp);
    return {
      ...RECT.card,
      r: CARD_RADIUS,
      card: 1,
      opacity: 1,
      inner: coverBox(plan, RECT.card.w, RECT.card.h, b.focus, drift),
    };
  }
  if (b.layout === "scene") {
    // Видео сжимается в карточку и уже там растворяется: под ним графика.
    const fade = interpolate(
      frame,
      [b.from + MORPH - 2, b.from + MORPH + 5],
      [1, 0],
      clamp,
    );
    return {
      ...RECT.card,
      r: CARD_RADIUS,
      card: 1,
      opacity: fade,
      inner: coverBox(plan, RECT.card.w, RECT.card.h, 0.5),
    };
  }
  return {
    ...RECT.cam,
    r: 0,
    card: 0,
    opacity: 1,
    inner: coverBox(plan, RECT.cam.w, RECT.cam.h, b.cam.focus, b.cam.zoom, 0.4),
  };
};

const mixGeo = (a: Geo, b: Geo, t: number): Geo => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  w: mix(a.w, b.w, t),
  h: mix(a.h, b.h, t),
  r: mix(a.r, b.r, t),
  card: mix(a.card, b.card, t),
  opacity: mix(a.opacity, b.opacity, t),
  inner: {
    left: mix(a.inner.left, b.inner.left, t),
    top: mix(a.inner.top, b.inner.top, t),
    width: mix(a.inner.width, b.inner.width, t),
    height: mix(a.inner.height, b.inner.height, t),
  },
});

/**
 * Где видео в этом кадре. Переход начинается на склейке компоновки и идёт
 * MORPH кадров: прямоугольник и кадрирование внутри него меняются вместе,
 * поэтому картинка не прыгает, а «переезжает». Линейная смесь двух
 * «cover»-кадров сама остаётся «cover» — пустых полос по дороге нет.
 */
export const videoGeo = (plan: Plan, frame: number): Geo => {
  const i = blockIndexAt(plan, frame);
  const b = plan.blocks[i];
  const cur = steady(plan, b, frame);
  const t = morphT(frame, b.from);
  if (i === 0 || t >= 1) return cur;
  const prev = plan.blocks[i - 1];
  // После карточки с графикой видео там не было: камера поднимается снизу.
  const from =
    prev.layout === "scene"
      ? { ...cur, y: 1920, opacity: 1 }
      : steady(plan, prev, frame);
  return mixGeo(from, cur, t);
};

const sceneRect = (b: Block) =>
  b.layout === "scene"
    ? { ...RECT.card, stage: 1.3 }
    : { ...RECT.top, stage: RECT.top.h / 800 };

/** Карточка с графикой (сцены и 45/55): где она в этом кадре. */
export const sceneCardRect = (
  plan: Plan,
  b: Block,
  frame: number,
): Rect & { stage: number } => {
  const own = sceneRect(b);
  const prev = plan.blocks[plan.blocks.indexOf(b) - 1];
  if (!prev || (prev.layout !== "scene" && prev.layout !== "split")) return own;
  const before = sceneRect(prev);
  const t = morphT(frame, b.from);
  return {
    x: mix(before.x, own.x, t),
    y: mix(before.y, own.y, t),
    w: mix(before.w, own.w, t),
    h: mix(before.h, own.h, t),
    stage: mix(before.stage, own.stage, t),
  };
};
