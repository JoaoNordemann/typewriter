const { _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const root = await fs.mkdtemp(path.resolve("test/.regions-"));
  const config = path.join(root, "config");
  await fs.mkdir(config);
  await fs.writeFile(
    path.join(config, "config.json"),
    JSON.stringify({ recordsDirectory: path.join(root, "records") }),
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    args: [".", `--user-data-dir=${config}`],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(
      () => typeof scheduleInputRegions === "function",
    );
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const original = win.setShape.bind(win);
      win.setShape = (regions) => {
        win.regionsForTest = regions;
        return original(regions);
      };
    });
    async function shape() {
      await page.evaluate(() => {
        previousRegions = "";
        scheduleInputRegions();
      });
      await page.waitForTimeout(80);
      return app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].regionsForTest,
      );
    }
    let regions = await shape();
    const inside = (x, y) =>
      regions.some(
        (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height,
      );
    assert.equal(inside(262, 30), false, "transparent top passes through");
    assert.equal(inside(5, 600), false, "transparent margin passes through");
    const machine = await page.locator("#machine").boundingBox();
    assert.equal(
      inside((machine.x + 20) * 1.25, (machine.y + 20) * 1.25),
      true,
    );
    assert.equal(
      await page
        .locator("#app")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("-webkit-app-region"),
        ),
      "no-drag",
    );
    assert.equal(
      await page
        .locator("#machine")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("-webkit-app-region"),
        ),
      "drag",
    );
    await page.evaluate(async () => {
      await load(() =>
        api.importText("# Região\n## Seção\n- [ ] Primeira\n- [ ] Segunda"),
      );
    });
    await page.waitForTimeout(2100);
    regions = await shape();
    assert.equal(inside(262, 30), false);
    const paper = await page.locator("#paper").boundingBox();
    assert.equal(
      inside((paper.x + 10) * 1.25, (paper.y + 10) * 1.25),
      true,
      "paper remains interactive",
    );
    await page.keyboard.press("Control+c");
    regions = await shape();
    assert.equal(inside(262, 30), true, "visible modal backdrop retained");
    await page.locator("#actions button:last-child").click();
    regions = await shape();
    assert.equal(
      inside(262, 30),
      false,
      "transparent hit region restored after cancel",
    );
    const screenshot = await app.evaluate(async ({ BrowserWindow }) =>
      (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
        .toPNG()
        .toString("base64"),
    );
    await fs.writeFile(
      "test/regiao-corrigida.png",
      Buffer.from(screenshot, "base64"),
    );
    console.log(
      "PASS: native setShape excludes transparent top/margins; machine/paper interactive; drag limited to machine; modal opens and restores shape.",
    );
  } finally {
    await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
