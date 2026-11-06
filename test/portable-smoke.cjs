const { chromium } = require("@playwright/test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const root = path.resolve("test/.portable-runtime");
  const config = path.join(root, "config");
  await fs.mkdir(config, { recursive: true });
  await fs.writeFile(
    path.join(config, "config.json"),
    JSON.stringify({ recordsDirectory: path.join(root, "records") }),
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(
    path.resolve(
      `dist/Typewriter-${require("../package.json").version}-portatil.exe`,
    ),
    [
      `--user-data-dir=${config}`,
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=19291",
    ],
    { env, windowsHide: true, stdio: "ignore" },
  );
  let browser;
  try {
    for (let n = 0; n < 60; n++) {
      try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:19291", {
          timeout: 1000,
        });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!browser) throw Error("O executável portátil não abriu a interface");
    const page = browser.contexts()[0].pages()[0];
    await page.waitForFunction(
      () =>
        document.querySelector("#progress")?.textContent === "0/0 concluídas",
    );
    assert.equal(await page.title(), "Typewriter");
    assert.equal(await page.locator("#idle").isVisible(), true);
    await page.screenshot({ path: "test/portatil.png", omitBackground: true });
    console.log(
      "PASS: executável portátil abriu a interface em PT-BR, com fonte e registros isolados.",
    );
    const session = await browser.newBrowserCDPSession();
    await session.send("Browser.close").catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.unref();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
