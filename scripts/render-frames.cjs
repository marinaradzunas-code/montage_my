// Отрисовывает отдельные кадры композиции в PNG — для проверки раскладки
// без полного рендера. Сборка делается один раз на все кадры.
//
//   node scripts/render-frames.cjs <композиция> <папка> <кадр> [кадр ...]
//
// Обычно его зовёт scripts/check-frames.py, а не человек.
const path = require("node:path");
const fs = require("node:fs");
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderStill } = require("@remotion/renderer");

const [id, outDir, ...frames] = process.argv.slice(2);
if (!id || !outDir || !frames.length) {
  console.error("usage: render-frames.cjs <composition> <outDir> <frame...>");
  process.exit(2);
}

(async () => {
  const root = path.resolve(__dirname, "..");
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
  // Направляющие в рендер не попадают сами (isRendering), поэтому showGuides не трогаем.
  const composition = await selectComposition({ serveUrl, id, inputProps: {} });
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of frames.map(Number)) {
    const frame = Math.max(0, Math.min(composition.durationInFrames - 1, f));
    const output = path.join(outDir, `frame-${String(frame).padStart(5, "0")}.png`);
    await renderStill({ serveUrl, composition, frame, output, inputProps: {} });
    console.log(output);
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
