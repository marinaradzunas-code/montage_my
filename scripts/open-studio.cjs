// Открывает композицию в Remotion Studio по точному адресу.
//
//   node scripts/open-studio.cjs [композиция]
//
// Без аргумента — последний импорт из src/generated/registry.json. Если студия
// уже запущена, просто открывает вкладку; иначе запускает её в этом окне и
// открывает вкладку, когда сервер ответит. Раньше после импорта печаталась
// только ссылка, и «проект не открывался», если студия не была запущена.
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn, execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.REMOTION_STUDIO_PORT || 3000);

const lastImport = () => {
  const file = path.join(root, "src", "generated", "registry.json");
  if (!fs.existsSync(file)) return "";
  const entries = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  return entries.length ? entries[entries.length - 1].id : "";
};

const id = process.argv[2] || lastImport();
const url = `http://localhost:${port}/${id}`;

const alive = () =>
  new Promise((resolve) => {
    const req = http.get({ host: "localhost", port, path: "/", timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });

const openBrowser = () => {
  console.log(`Открываю ${url}`);
  if (process.platform === "win32") execFileSync("cmd", ["/c", "start", "", url]);
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore", detached: true }).unref();
};

(async () => {
  if (await alive()) {
    openBrowser();
    return;
  }
  execFileSync(process.execPath, [path.join(root, "scripts", "ensure-generated.cjs")], { stdio: "inherit" });
  const studio = spawn(
    process.execPath,
    [path.join(root, "node_modules/@remotion/cli/remotion-cli.js"), "studio", "--no-open", "--port", String(port)],
    { cwd: root, stdio: "inherit" },
  );
  studio.on("exit", (code) => process.exit(code || 0));
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await alive()) {
      openBrowser();
      return;
    }
  }
  console.error(`Студия не ответила за 3 минуты. Откройте вручную: ${url}`);
})();
