const { _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const root = path.resolve("test/.scale-runtime");
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(
    path.join(root, "config.json"),
    JSON.stringify({ recordsDirectory: path.join(root, "records") }),
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const e = await _electron.launch({
    args: [".", `--user-data-dir=${root}`],
    env,
  });
  try {
    const w = await e.firstWindow();
    await w.waitForTimeout(1000);
    console.log(
      await w.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        machine: document
          .querySelector("#machine")
          .getBoundingClientRect()
          .toJSON(),
      })),
    );
    const shot = await e.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return {
        size: win.getSize(),
        zoom: win.webContents.getZoomFactor(),
        image: (await win.webContents.capturePage()).toPNG().toString("base64"),
      };
    });
    await fs.writeFile(
      "test/escala-125.png",
      Buffer.from(shot.image, "base64"),
    );
    console.log({ size: shot.size, zoom: shot.zoom });
  } finally {
    await e.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
