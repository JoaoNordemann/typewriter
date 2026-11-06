const { _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const root = await fs.mkdtemp(path.resolve("test/.open-"));
  const config = path.join(root, "config"),
    records = path.join(root, "records");
  await fs.mkdir(config);
  await fs.writeFile(
    path.join(config, "config.json"),
    JSON.stringify({ recordsDirectory: records }),
  );
  const external = path.join(root, "existente.md"),
    markdown = "# Plano existente\n## Seção\n- [ ] Primeira\n- [ ] Segunda\n";
  await fs.writeFile(external, markdown);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    args: [".", `--user-data-dir=${config}`],
    env,
  });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForFunction(() => !!window.typewriter);
    async function select(file) {
      await app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async (_win, options) => {
          globalThis.pickerOptions = options;
          return { canceled: !file, filePaths: file ? [file] : [] };
        };
      }, file);
    }
    await select(null);
    await page.locator("#add").click();
    await page.waitForFunction(() => !busy);
    assert.equal(await page.locator("#error").innerText(), "");
    assert.equal(await page.locator("#progress").innerText(), "0/0 concluídas");
    const options = await app.evaluate(() => globalThis.pickerOptions);
    assert.equal(options.defaultPath, records);
    assert.deepEqual(options.filters, [
      { name: "Planos Markdown", extensions: ["md"] },
    ]);
    await select(external);
    await page.keyboard.press("Control+o");
    await page.waitForFunction(() => !!plan && !busy);
    await page.waitForTimeout(2100);
    assert.equal(await page.locator("#progress").innerText(), "0/2 concluídas");
    const stored = path.join(records, "existente.md");
    await fs.access(stored);
    assert.equal(await fs.readFile(external, "utf8"), markdown);
    await page.locator(".task").click();
    await page.waitForFunction(() => !busy);
    assert.match(await fs.readFile(stored, "utf8"), /\[x\] Primeira/);
    assert.equal(await fs.readFile(external, "utf8"), markdown);
    await page.evaluate(() => api.finish("log"));
    await page.evaluate(() => reset());
    await page.waitForFunction(() => !plan);
    const count = (await fs.readdir(records)).length;
    await select(stored);
    await page.locator("#add").click();
    await page.waitForFunction(() => !!plan && !busy);
    await page.waitForTimeout(2100);
    assert.equal(await page.locator("#progress").innerText(), "1/2 concluídas");
    assert.match(await page.locator(".task").innerText(), /Segunda/);
    assert.equal((await fs.readdir(records)).length, count);
    assert.equal(await page.evaluate(() => plan.path), stored);
    await page.locator("#add").click();
    assert.match(
      await page.locator("#error").innerText(),
      /Conclua ou interrompa/,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: file picker, cancellation, Markdown filter, Ctrl+O, external original preserved, stored plan resumed with sidecar and no duplicate, active plan protected.",
    );
  } finally {
    await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
