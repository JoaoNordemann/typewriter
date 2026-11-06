const fs = require("node:fs/promises");
const path = require("node:path");
const taskRE = /^(\s*- \[)([ xX])(\]\s*)(.*)$/;
const stampRE = /\s*\(done \d{4}-\d{2}-\d{2} \d{2}:\d{2}\)\s*$/;
function parse(markdown) {
  const lines = markdown.split(/\r?\n/);
  let title = "",
    section = "",
    tasks = [];
  for (const line of lines) {
    if (!title && /^#\s+\S/.test(line))
      title = line.replace(/^#\s+/, "").trim();
    else if (/^##\s+/.test(line)) section = line.replace(/^##\s+/, "").trim();
    const m = line.match(taskRE);
    if (m)
      tasks.push({
        text: m[4].replace(stampRE, ""),
        section,
        done: m[2] !== " ",
        at: null,
      });
  }
  if (!title || !tasks.length)
    throw Error("não foi possível ler este plano :(");
  return { title, tasks };
}
function localDate(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}
function updateMarkdown(markdown, tasks) {
  let i = 0;
  return markdown
    .split(/(\r?\n)/)
    .map((line) => {
      const m = line.match(taskRE);
      if (!m) return line;
      const task = tasks[i++];
      if (!task) return line;
      return (
        m[1] +
        (task.done ? "x" : " ") +
        m[3] +
        m[4].replace(stampRE, "") +
        (task.done && task.at ? ` (done ${localDate(new Date(task.at))})` : "")
      );
    })
    .join("");
}
async function atomic(file, value) {
  const temp = file + ".tmp";
  await fs.writeFile(temp, value, "utf8");
  await fs.rename(temp, file);
}
class Records {
  constructor(directory) {
    this.directory = path.resolve(directory);
    this.active = null;
  }
  safe(file) {
    return (
      path.dirname(path.resolve(file)) === this.directory &&
      path.extname(file).toLowerCase() === ".md"
    );
  }
  side(file) {
    return file + ".progress.json";
  }
  async open(file) {
    if (!this.safe(file))
      throw Error("O plano está fora da pasta de registros");
    const resolved = await fs.realpath(file);
    const root = await fs.realpath(this.directory);
    if (path.dirname(resolved) !== root)
      throw Error("O plano aponta para fora da pasta de registros");
    const markdown = await fs.readFile(file, "utf8");
    const plan = parse(markdown);
    try {
      const s = JSON.parse(await fs.readFile(this.side(file), "utf8"));
      if (
        s.planPath === file &&
        Array.isArray(s.tasks) &&
        s.tasks.length === plan.tasks.length &&
        s.tasks.every(
          (t, i) =>
            t.index === i &&
            typeof t.done === "boolean" &&
            (t.at === null ||
              (typeof t.at === "string" && !isNaN(Date.parse(t.at)))),
        )
      ) {
        plan.tasks.forEach((t, i) =>
          Object.assign(t, { done: s.tasks[i].done, at: s.tasks[i].at }),
        );
      }
    } catch {}
    this.active = { ...plan, path: file, markdown };
    await this.persist();
    return this.view();
  }
  view() {
    if (!this.active) return null;
    const { markdown, ...v } = this.active;
    return v;
  }
  async import(markdown, name) {
    parse(markdown);
    await fs.mkdir(this.directory, { recursive: true });
    let base = path.basename(
      name ||
        parse(markdown)
          .title.toLowerCase()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + ".md",
    );
    if (!name) {
      base = base.slice(0, -3).slice(0, 120) + ".md";
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\.md$/i.test(base))
        base = "plan-" + base;
    }
    if (base === ".md") base = `plan-${Date.now()}.md`;
    if (path.extname(base).toLowerCase() !== ".md")
      throw Error("Escolha um arquivo .md");
    let file = path.join(this.directory, base),
      n = 0;
    while (true) {
      try {
        await fs.writeFile(file, markdown, { flag: "wx" });
        break;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        file = path.join(
          this.directory,
          `${path.parse(base).name}-${Date.now()}-${++n}.md`,
        );
      }
    }
    return this.open(file);
  }
  async persist() {
    const a = this.active;
    if (!a) return;
    await atomic(
      this.side(a.path),
      JSON.stringify(
        {
          planPath: a.path,
          tasks: a.tasks.map((t, index) => ({ index, done: t.done, at: t.at })),
        },
        null,
        2,
      ),
    );
    a.markdown = updateMarkdown(a.markdown, a.tasks);
    await atomic(a.path, a.markdown);
  }
  async toggle(index) {
    if (!this.active || !Number.isInteger(index) || !this.active.tasks[index])
      throw Error("Tarefa inválida");
    const t = this.active.tasks[index];
    t.done = !t.done;
    t.at = t.done ? new Date().toISOString() : null;
    await this.persist();
    return this.view();
  }
  async finish(action, note) {
    const a = this.active;
    if (!a) return;
    if (!this.safe(a.path)) throw Error("Caminho de registros não permitido");
    if (action === "discard") {
      await fs.unlink(a.path).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      await fs.unlink(this.side(a.path)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    } else if (action === "log") {
      await fs.appendFile(
        path.join(this.directory, "aborted-plans.jsonl"),
        JSON.stringify({
          at: new Date().toISOString(),
          planPath: a.path,
          done: a.tasks.filter((t) => t.done).length,
          total: a.tasks.length,
        }) + "\n",
      );
    } else if (action === "complete" && note.trim()) {
      a.markdown += `\n\n---\n**nota da sessão (${localDate()}):** ${note.trim()}\n`;
      await this.persist();
    } else if (action !== "complete") throw Error("Ação inválida");
    this.active = null;
  }
}
module.exports = { parse, updateMarkdown, Records, atomic };
