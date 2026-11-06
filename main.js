const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { Records, atomic } = require("./records");
const configArgument = process.argv.find((a) =>
  a.startsWith("--user-data-dir="),
);
if (configArgument) {
  const directory = configArgument.slice("--user-data-dir=".length);
  if (path.isAbsolute(directory)) app.setPath("userData", directory);
}
const UI_SCALE = 1.25;
function windowSize(list, display) {
  return {
    width: Math.round(420 * UI_SCALE),
    height: Math.min(
      Math.round((list ? 950 : 720) * UI_SCALE),
      display.workArea.height,
    ),
  };
}
function resizeWindow(list) {
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const size = windowSize(list, display);
  const area = display.workArea;
  win.setBounds({
    ...size,
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - size.width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - size.height)),
  });
}
let win,
  records,
  config = {},
  configPath;
let queue = Promise.resolve();
async function save() {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await atomic(configPath, JSON.stringify(config, null, 2));
}
function handle(name, fn) {
  ipcMain.handle(name, (_e, ...args) => {
    const result = queue.then(() => fn(...args));
    queue = result.catch(() => {});
    return result;
  });
}
app.whenReady().then(async () => {
  configPath = path.join(app.getPath("userData"), "config.json");
  try {
    config = JSON.parse(await fs.readFile(configPath, "utf8")) || {};
  } catch {}
  if (!config || typeof config !== "object" || Array.isArray(config))
    config = {};
  if (typeof config.recordsDirectory !== "string")
    config.recordsDirectory = path.resolve("C:/Typewriter");
  records = new Records(config.recordsDirectory);
  win = new BrowserWindow({
    ...windowSize(false, screen.getPrimaryDisplay()),
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      zoomFactor: UI_SCALE,
    },
  });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  handle("initial", async () => {
    let plan = null,
      error = null;
    try {
      await fs.mkdir(records.directory, { recursive: true });
      await save();
      if (config.activePlan) plan = await records.open(config.activePlan);
    } catch (e) {
      error = e.message;
      config.activePlan = null;
      await save().catch(() => {});
    }
    return { plan, muted: !!config.muted, error, directory: records.directory };
  });
  handle("import", async (input) => {
    if (!input || typeof input !== "object") throw Error("Importação inválida");
    let text = input.text,
      name;
    if (typeof input.path === "string") {
      if (path.extname(input.path).toLowerCase() !== ".md")
        throw Error("Escolha um arquivo .md");
      text = await fs.readFile(input.path, "utf8");
      name = path.basename(input.path);
    }
    if (typeof text !== "string" || text.length > 5e6)
      throw Error("Plano inválido");
    if (records.active)
      throw Error("Conclua ou interrompa o plano atual primeiro");
    const plan = await records.import(text, name);
    config.activePlan = plan.path;
    await save();
    return plan;
  });
  handle("toggle", (i) => records.toggle(i));
  handle("mode", (list) => resizeWindow(list === true));
  handle("mute", async (muted) => {
    config.muted = !!muted;
    await save();
  });
  handle("finish", async (action, note = "") => {
    if (typeof note !== "string") throw Error("Nota inválida");
    await records.finish(action, note);
    config.activePlan = null;
    await save();
    resizeWindow(false);
  });
  await win.loadFile("index.html");
});
app.on("window-all-closed", () => app.quit());
