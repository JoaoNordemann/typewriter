const { _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const root = await fs.mkdtemp(path.resolve("test/.timer-ui-"));
  const config = path.join(root, "config"),
    records = path.join(root, "records");
  await fs.mkdir(config);
  await fs.writeFile(
    path.join(config, "config.json"),
    JSON.stringify({ recordsDirectory: records }),
  );
  let app, page;
  const errors = [];
  async function launch() {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({
      args: [".", `--user-data-dir=${config}`],
      env,
    });
    page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForFunction(() => !!window.typewriter);
    await page.waitForTimeout(200);
  }
  try {
    await launch();
    await page.evaluate(async () =>
      load(() =>
        api.importText(
          "# Cronometrar sessão\n## Estudar\n- [ ] Ler o artigo\n- [ ] Fazer os exercícios",
        ),
      ),
    );
    await page.waitForTimeout(2100);
    const first = () => page.locator('[data-timer-index="0"] .timer-toggle');
    await first().click();
    await page.waitForFunction(() => !busy && !!plan.timing.running);
    assert.equal(await first().innerText(), "Ⅱ pausar");
    await page.waitForTimeout(1200);
    assert.notEqual(
      await page.locator(".timer-elapsed").innerText(),
      "00:00:00",
    );
    await first().click();
    await page.waitForFunction(() => !busy && !plan.timing.running);
    const paused = await page.locator(".timer-elapsed").innerText();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator(".timer-elapsed").innerText(), paused);
    let state = await page.evaluate(() => plan);
    let report = await fs.readFile(state.timing.reportPath, "utf8");
    assert.match(report, /pausa manual/);
    assert.match(report, /\.\.\/cronometrar-sessao.md/);
    assert.match(report, /\[\[\d{4}-\d{2}-\d{2}\]\]/);
    await page.locator("#mode").click();
    await first().click();
    await page.waitForFunction(() => !busy && plan.timing.running?.index === 0);
    await page.locator('[data-timer-index="1"] .timer-toggle').click();
    await page.waitForFunction(() => !busy && plan.timing.running?.index === 1);
    state = await page.evaluate(() => plan);
    report = await fs.readFile(state.timing.reportPath, "utf8");
    assert.match(report, /troca de tarefa/);
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit("suspend"));
    await page.waitForFunction(() => !plan.timing.running);
    assert.match(
      await fs.readFile(state.timing.reportPath, "utf8"),
      /computador suspenso/,
    );
    await page.locator('[data-timer-index="1"] .timer-toggle').click();
    await page.waitForFunction(() => !busy && !!plan.timing.running);
    await page.waitForTimeout(1100);
    await app.close();
    await launch();
    await page.waitForTimeout(2100);
    state = await page.evaluate(() => plan);
    assert.equal(state.timing.running, null);
    assert.ok(state.timing.totals[0] >= 1000);
    assert.ok(state.timing.totals[1] >= 1000);
    assert.match(
      await fs.readFile(state.timing.reportPath, "utf8"),
      /aplicativo fechado/,
    );
    await first().click();
    await page.waitForFunction(() => !busy && !!plan.timing.running);
    await page.locator(".task").click();
    await page.waitForFunction(() => !busy);
    assert.equal(await page.evaluate(() => plan.timing.running), null);
    await page.locator("#mode").click();
    assert.equal(
      await page.locator('[data-timer-index="0"] .timer-toggle').isDisabled(),
      true,
    );
    const image = await app.evaluate(async ({ BrowserWindow }) =>
      (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
        .toPNG()
        .toString("base64"),
    );
    await fs.writeFile("test/cronometros.png", Buffer.from(image, "base64"));
    await fs.copyFile(state.timing.reportPath, "test/exemplo-tempos.md");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: iniciar/pausar, pausa excluída, troca de tarefa, suspensão, fechamento e restauração, conclusão automática e relatório Obsidian.",
    );
  } finally {
    if (app) await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
