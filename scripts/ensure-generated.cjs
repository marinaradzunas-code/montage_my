// src/generated и src/local не хранятся в git: там лежат импортированные ролики
// и личный материал. После свежего клона этих файлов нет, и сборка упала бы на
// импорте, поэтому перед стартом студии создаём пустые заглушки.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const stubs = [
  {
    file: path.join(root, "src", "generated", "Registry.tsx"),
    body:
      "// Заглушка: сюда scripts/import-video.py допишет импортированные ролики.\n" +
      "export const ImportedCompositions = () => <></>;\n",
  },
  {
    file: path.join(root, "src", "generated", "emoji.ts"),
    body:
      "// Заглушка: список личных эмодзи пишет scripts/emoji-from-font.py.\n" +
      "export const LOCAL_EMOJI: string[] = [];\n",
  },
  {
    file: path.join(root, "src", "local", "Local.tsx"),
    body:
      "// Заглушка для личных композиций. Эта папка не попадает в git.\n" +
      "export const LocalCompositions = () => <></>;\n",
  },
];

for (const { file, body } of stubs) {
  if (fs.existsSync(file)) continue;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
  console.log(`created ${path.relative(root, file)}`);
}

// Реестр импортированных роликов. Одна битая композиция — удалённый файл или
// импорт сцены, которой больше нет, — роняет сборку всей студии, и проект
// «не открывается». Такие записи не подключаем и пишем, какие и почему.
const registryJson = path.join(root, "src", "generated", "registry.json");
if (fs.existsSync(registryJson)) {
  const dir = path.dirname(registryJson);
  const entries = JSON.parse(fs.readFileSync(registryJson, "utf8").replace(/^﻿/, ""));
  const resolves = (from, spec) =>
    ["", ".tsx", ".ts", ".js", ".json", "/index.tsx", "/index.ts"].some((ext) =>
      fs.existsSync(path.resolve(path.dirname(from), spec + ext)),
    );
  const broken = (entry) => {
    const file = path.join(dir, `${entry.id}.tsx`);
    if (!fs.existsSync(file)) return "нет файла композиции";
    const source = fs.readFileSync(file, "utf8");
    const missing = [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)]
      .map((m) => m[1])
      .filter((spec) => !resolves(file, spec));
    return missing.length ? `не найдено: ${missing.join(", ")}` : null;
  };
  const good = [];
  for (const entry of entries) {
    const why = broken(entry);
    if (why) console.warn(`Композиция ${entry.id} не подключена: ${why}`);
    else good.push(entry);
  }
  const flags = ["fullScreenExplanation", "lightTheme"];
  const lines = ["import {Composition} from 'remotion';"];
  good.forEach((e, i) => lines.push(`import {ImportedVideo as Video${i}} from './${e.id}';`));
  lines.push("export const ImportedCompositions=()=> <>");
  good.forEach((e, i) => {
    const props = flags.map((k) => `${k}:${Boolean((e.props || {})[k])}`).join(",");
    lines.push(
      `<Composition id="${e.id}" component={Video${i}} durationInFrames={${e.duration}} fps={${e.fps}} width={1080} height={1920} defaultProps={{showGuides:true,${props}}}/>`,
    );
  });
  lines.push("</>;");
  const body = lines.join("\n");
  // Registry.tsx всегда собирается из registry.json (как и в scripts/registry.py),
  // руками его не правят.
  fs.writeFileSync(path.join(dir, "Registry.tsx"), body, "utf8");
}
