import { Img, staticFile } from "remotion";
import { Confetti } from "./Confetti";
import type { Plan } from "./plan";
import { Style3Video } from "./Style3Video";

// Витрина стиля 3 без чужого материала: вместо камеры — заглушка, вместо
// графики — примеры из public/examples. Для своего ролика скопируйте этот
// файл в src/local/<имя>/, подставьте source/voice своей композиции, фразы из
// scripts/style3-words.py и свои сцены (MONTAGE_RULES.md, «Стиль автора»).

const Example = ({ file }: { file: string }) => (
  <Img
    src={staticFile(`examples/${file}`)}
    style={{ width: "100%", height: "100%", objectFit: "contain" }}
  />
);
const ProductScene = () => <Example file="product.png" />;
const DiagramScene = () => <Example file="diagram.png" />;

const w = (t: string, f: number, tone?: "win" | "pain") => ({ t, f, tone });

export const STYLE3_DEMO: Plan = {
  frames: 360,
  srcW: 1080,
  srcH: 1920,
  blocks: [
    { from: 0, to: 75, layout: "video" },
    { from: 75, to: 130, layout: "card", focus: 0.4 },
    { from: 130, to: 180, layout: "video" },
    { from: 180, to: 250, layout: "scene", scene: ProductScene },
    {
      from: 250,
      to: 310,
      layout: "split",
      scene: DiagramScene,
      cam: { focus: 0.3, zoom: 1 },
    },
    { from: 310, to: 360, layout: "video" },
  ],
  shots: [
    { from: 0, to: 75, z0: 1, z1: 1.1, ox: 540, oy: 600, open: true },
    {
      from: 130,
      to: 180,
      z0: 1,
      z1: 1.04,
      ox: 540,
      oy: 700,
      punch: [{ at: 140, by: 0.06 }],
    },
    { from: 310, to: 360, z0: 1, z1: 1.06, ox: 540, oy: 700 },
  ],
  phrases: [
    {
      from: 0,
      to: 30,
      tokens: [w("Видео", 0), w("на", 10), w("весь", 14), w("экран", 20)],
    },
    { from: 30, to: 75, tokens: [w("крупные", 32), w("слова", 44, "win")] },
    {
      from: 75,
      to: 130,
      tokens: [w("перебивка", 78), w("в", 92), w("карточке", 96)],
    },
    { from: 130, to: 180, tokens: [w("и", 132), w("акцент", 140, "pain")] },
    {
      from: 180,
      to: 250,
      tokens: [w("графика", 184), w("на", 198), w("белом", 204)],
    },
    {
      from: 250,
      to: 310,
      tokens: [w("графика", 254), w("и", 268), w("лицо", 274)],
    },
    { from: 310, to: 360, tokens: [w("готово", 312, "win")] },
  ],
};

export const Style3Demo = ({ showGuides = true }: { showGuides?: boolean }) => (
  <Style3Video plan={STYLE3_DEMO} showGuides={showGuides}>
    <Confetti from={312} to={334} y={420} />
  </Style3Video>
);
