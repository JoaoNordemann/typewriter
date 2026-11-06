const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { parse, updateMarkdown, Records } = require("../records");
const md =
  "# My Plan\n\nIntro\n- [ ] Unsectioned\n## Build\n- [X] Existing (done 2026-01-01 12:30)\n- [ ] Next\n";
test("parser validates and strips completion annotations", () => {
  const p = parse(md);
  assert.equal(p.title, "My Plan");
  assert.equal(p.tasks.length, 3);
  assert.equal(p.tasks[0].section, "");
  assert.equal(p.tasks[1].text, "Existing");
  assert.equal(p.tasks[1].done, true);
  assert.throws(() => parse("- [ ] no title"));
  assert.throws(() => parse("# no tasks"));
});
test("markdown updates preserve unrelated content and CRLF", () => {
  const original = md.replaceAll("\n", "\r\n");
  const tasks = parse(md).tasks;
  tasks[0].done = true;
  tasks[0].at = "2026-11-05T12:00:00Z";
  tasks[1].done = false;
  const result = updateMarkdown(original, tasks);
  assert.match(result, /Intro\r\n- \[x\] Unsectioned \(done /);
  assert.match(result, /- \[ \] Existing\r\n/);
  assert.ok(result.endsWith("\r\n"));
});
test("records isolate copies, collisions, restore authoritative sidecars, notes and aborts", async () => {
  const dir = await fs.mkdtemp(path.join(__dirname, "typewriter-"));
  try {
    const r = new Records(dir);
    const first = await r.import(md, "original.md");
    await r.toggle(0);
    const restored = new Records(dir);
    const state = await restored.open(first.path);
    assert.equal(state.tasks[0].done, true);
    assert.ok(state.tasks[0].at);
    await restored.finish("complete", "Learned something");
    assert.match(
      await fs.readFile(first.path, "utf8"),
      /nota da sessão .*Learned something/,
    );
    const second = await r.import(md, "original.md");
    assert.notEqual(second.path, first.path);
    await r.finish("log", "");
    assert.match(
      await fs.readFile(path.join(dir, "aborted-plans.jsonl"), "utf8"),
      /original-/,
    );
    await r.open(second.path);
    await r.finish("discard", "");
    await assert.rejects(fs.access(second.path));
    await fs.access(first.path);
    await assert.rejects(r.open(path.join(dir, "..", "external.md")));
    await fs.writeFile(first.path + ".progress.json", "malformed");
    await r.open(first.path);
    assert.equal(r.view().tasks.length, 3);
    const side = JSON.parse(
      await fs.readFile(first.path + ".progress.json", "utf8"),
    );
    side.tasks.pop();
    await fs.writeFile(first.path + ".progress.json", JSON.stringify(side));
    await r.open(first.path);
    assert.equal(r.view().tasks.length, 3);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
