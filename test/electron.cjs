const { _electron } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const root = path.resolve("test/.runtime");
  await fs.mkdir(root, { recursive: true });
  const records = path.join(root, "records"),
    userData = path.join(root, "config");
  await fs.mkdir(userData, { recursive: true });
  await fs.writeFile(
    path.join(userData, "config.json"),
    JSON.stringify({ recordsDirectory: records }),
  );
  let e, w;
  const errors = [];
  async function launch() {
    e = await _electron.launch({
      args: process.env.TYPEWRITER_EXECUTABLE
        ? [`--user-data-dir=${userData}`]
        : [".", `--user-data-dir=${userData}`],
      ...(process.env.TYPEWRITER_EXECUTABLE
        ? { executablePath: process.env.TYPEWRITER_EXECUTABLE }
        : {}),
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([k]) => k !== "ELECTRON_RUN_AS_NODE",
        ),
      ),
    });
    w = await e.firstWindow();
    w.on("pageerror", (e) => errors.push(e.message));
    await w.waitForFunction(() => !!window.typewriter);
    await w.waitForTimeout(2200);
  }
  const text =
    "# Test Plan\n\nA paragraph to preserve.\n## First section\n- [ ] First task\n## Second section\n- [ ] Second task\n- [X] Already done\n";
  async function paste(value) {
    await w.evaluate(
      (value) =>
        document.body.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            clipboardData: (() => {
              const d = new DataTransfer();
              d.setData("text/plain", value);
              return d;
            })(),
          }),
        ),
      value,
    );
    await w.waitForTimeout(2200);
  }
  async function click(selector) {
    await w.locator(selector).click();
    await w.waitForTimeout(100);
    await w.waitForFunction(() => !busy);
  }
  try {
    await launch();
    assert.deepEqual(
      await e.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return { size: win.getSize(), zoom: win.webContents.getZoomFactor() };
      }),
      await e.evaluate(({ screen }) => ({
        size: [525, Math.min(900, screen.getPrimaryDisplay().workArea.height)],
        zoom: 1.25,
      })),
    );
    assert.equal(await w.locator(".key").count(), 37);
    await w.screenshot({ path: "test/idle.png", omitBackground: true });
    await paste("invalid");
    assert.match(await w.locator("#error").innerText(), /não foi possível ler/);
    await paste(text);
    assert.equal(await w.locator(".task").count(), 1);
    await w.screenshot({ path: "test/focused.png", omitBackground: true });
    await click(".task");
    await w.waitForTimeout(1100);
    assert.match(await w.locator(".task").innerText(), /Second task/);
    let stored = path.join(records, "test-plan.md");
    assert.match(await fs.readFile(stored, "utf8"), /\[x\] First task \(done /);
    await click("#mode");
    assert.deepEqual(
      await e.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].getSize(),
      ),
      await e.evaluate(({ screen }) => [
        525,
        Math.min(1188, screen.getPrimaryDisplay().workArea.height),
      ]),
    );
    assert.equal(await w.locator(".task").count(), 3);
    assert.equal(await w.locator(".stamp").count(), 1);
    await w.screenshot({ path: "test/list.png", omitBackground: true });
    await click('[data-index="0"]');
    assert.match(await fs.readFile(stored, "utf8"), /\[ \] First task\n/);
    await click('[data-index="0"]');
    await click("#sound");
    assert.equal(await w.locator("#sound").innerText(), "✕");
    await e.close();
    await launch();
    assert.match(await w.locator(".task").innerText(), /Second task/);
    assert.equal(await w.locator("#sound").innerText(), "✕");
    await w.keyboard.press("Control+c");
    await click("#actions button:last-child");
    assert.equal(await w.locator("#overlay").isVisible(), false);
    await w.keyboard.press("Control+c");
    await click("#actions button:first-child");
    await w.waitForTimeout(500);
    assert.equal(await w.locator("#progress").innerText(), "0/0 concluídas");
    assert.match(
      await fs.readFile(path.join(records, "aborted-plans.jsonl"), "utf8"),
      /Test|test-plan/,
    );
    await paste(text);
    assert.equal(
      (await fs.readdir(records)).filter((n) => n.endsWith(".md")).length,
      2,
    );
    await w.keyboard.press("Control+c");
    await click("#actions button:nth-child(2)");
    await w.waitForTimeout(500);
    assert.equal(
      (await fs.readdir(records)).filter((n) => n.endsWith(".md")).length,
      1,
    );
    await paste("# Finish\n## One\n- [ ] Only task");
    await click(".task");
    await w.waitForTimeout(1100);
    assert.equal(await w.locator(".all-done").innerText(), "TUDO CONCLUÍDO ✓");
    assert.equal(await w.locator(".confetti").count(), 40);
    await w.waitForTimeout(1650);
    assert.equal(await w.locator("#overlay").isVisible(), true);
    await w.screenshot({ path: "test/completion.png", omitBackground: true });
    await e.close();
    await launch();
    await w.waitForTimeout(2100);
    assert.equal(await w.locator("#overlay").isVisible(), false);
    assert.equal(await w.locator(".confetti").count(), 0);
    assert.equal(await w.locator(".all-done").innerText(), "TUDO CONCLUÍDO ✓");
    await w.keyboard.press("Control+c");
    await click("#actions button:first-child");
    await w.waitForTimeout(500);
    await paste("# Notes\n- [ ] Write");
    await click(".task");
    await w.waitForTimeout(2750);
    await w.locator("#note").fill("Learned to keep it tiny.");
    await click("#actions button:first-child");
    await w.waitForTimeout(500);
    assert.match(
      await fs.readFile(path.join(records, "notes.md"), "utf8"),
      /nota da sessão .*Learned to keep it tiny/,
    );
    await paste("# Skip\n- [ ] End");
    await click(".task");
    await w.waitForTimeout(2750);
    await click("#actions button:last-child");
    await w.waitForTimeout(500);
    assert.equal(await w.locator("#progress").innerText(), "0/0 concluídas");
    assert.equal(await w.locator("#idle").isVisible(), true);
    const external = path.join(root, "external.md");
    await fs.writeFile(external, "# Dropped plan\n- [ ] Keep original");
    await w.evaluate(() => {
      const input = document.createElement("input");
      input.type = "file";
      input.id = "test-file";
      document.body.append(input);
    });
    await w.locator("#test-file").setInputFiles(external);
    await w.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(document.querySelector("#test-file").files[0]);
      document.body.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, dataTransfer: data }),
      );
    });
    assert.equal(await w.locator(".drag-over").count(), 1);
    await w.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(document.querySelector("#test-file").files[0]);
      document.body.dispatchEvent(
        new DragEvent("drop", { bubbles: true, dataTransfer: data }),
      );
    });
    await w.waitForTimeout(2200);
    assert.match(await w.locator(".task").innerText(), /Keep original/);
    await click(".task");
    assert.equal(
      await fs.readFile(external, "utf8"),
      "# Dropped plan\n- [ ] Keep original",
    );
    await w.waitForTimeout(1700);
    await click("#actions button:last-child");
    await w.waitForTimeout(500);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: dimensions, pixel keys, invalid paste, focused/list, timestamps, stamps, mute, active restore, abort cancel/log/discard, collisions, 40 confetti, completion popup, completed restore, notes, skip.",
    );
  } finally {
    if (e) await e.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
