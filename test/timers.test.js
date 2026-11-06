const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Records } = require("../records");
const { duration } = require("../time-log");
async function fixture(run) {
  const dir = await fs.mkdtemp(path.join(__dirname, ".timing-"));
  try {
    const r = new Records(dir);
    const plan = await r.import(
      "# Plano com espaços\n## Estudo\n- [ ] Ler | artigo\n- [ ] Implementar\n",
      "plano com espaços.md",
    );
    let date = new Date("2026-11-05T12:00:00Z");
    r.active.time.now = () => date;
    await run(r, plan, dir, (value) => {
      date = new Date(value);
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
test("timer accumulates only active intervals, pauses on task switch and completion, writes Obsidian-linked report", () =>
  fixture(async (r, p, dir, set) => {
    await r.timer("start", 0);
    await r.timer("start", 0);
    set("2026-11-05T12:01:05Z");
    await r.timer("pause");
    assert.deepEqual(r.view().timing.totals, [65000, 0]);
    set("2026-11-05T13:00:00Z");
    await r.timer("start", 0);
    set("2026-11-05T13:00:10Z");
    await r.timer("start", 1);
    assert.deepEqual(r.view().timing.totals, [75000, 0]);
    set("2026-11-05T13:00:30Z");
    await r.toggle(1);
    assert.equal(r.view().timing.running, null);
    assert.deepEqual(r.view().timing.totals, [75000, 20000]);
    assert.equal(r.active.time.state.sessions.length, 3);
    const report = await fs.readFile(r.view().timing.reportPath, "utf8");
    assert.match(report, /\.\.\/plano%20com%20espa%C3%A7os.md/);
    assert.match(report, /\[\[2026-11-05\]\]/);
    assert.match(report, /00:01:15/);
    assert.match(report, /troca de tarefa/);
    assert.match(report, /tarefa concluída/);
    assert.match(report, /Ler &#124; artigo/);
    assert.match(report, /\d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}/);
    const restored = new Records(dir);
    const reopened = await restored.open(p.path);
    assert.deepEqual(reopened.timing.totals, [75000, 20000]);
    assert.equal(duration(3601000), "01:00:01");
    await assert.rejects(r.timer("start", 1));
  }));
test("crash recovery uses last checkpoint and excludes downtime; close/abort pauses preserve history", () =>
  fixture(async (r, p, dir, set) => {
    await r.timer("start", 0);
    set("2026-11-05T12:00:10Z");
    await r.timer("checkpoint");
    const recovered = new Records(dir);
    const state = await recovered.open(p.path);
    assert.equal(state.timing.running, null);
    assert.deepEqual(state.timing.totals, [10000, 0]);
    assert.match(
      await fs.readFile(state.timing.reportPath, "utf8"),
      /sessão recuperada/,
    );
    recovered.active.time.now = () => new Date("2026-11-05T14:00:00Z");
    await recovered.timer("start", 1);
    await recovered.finish("log", "");
    assert.equal(recovered.active, null);
    await fs.access(state.timing.reportPath);
    const final = new Records(dir);
    await final.open(p.path);
    assert.equal(final.view().timing.running, null);
  }));
test("report collision preserves unrelated files; malformed timing does not invalidate checklist", () =>
  fixture(async (r, p, dir, set) => {
    const folder = path.join(dir, "tempos");
    await fs.mkdir(folder);
    const conflicting = path.join(folder, "plano com espaços.md.tempos.md");
    await fs.writeFile(conflicting, "minhas anotações");
    await r.timer("start", 0);
    set("2026-11-05T12:00:01Z");
    await r.timer("pause");
    assert.notEqual(r.view().timing.reportPath, conflicting);
    assert.equal(await fs.readFile(conflicting, "utf8"), "minhas anotações");
    const side = p.path + ".progress.json",
      data = JSON.parse(await fs.readFile(side, "utf8"));
    data.timing = {
      version: 1,
      sessions: [{ index: -1 }],
      running: { index: 999 },
    };
    await fs.writeFile(side, JSON.stringify(data));
    const restored = new Records(dir);
    await restored.open(p.path);
    assert.deepEqual(restored.view().timing.totals, [0, 0]);
    assert.equal(restored.view().tasks.length, 2);
  }));
