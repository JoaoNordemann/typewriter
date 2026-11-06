const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
function duration(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000),
    pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}
function localTime(date) {
  const pad = (n) => String(n).padStart(2, "0"),
    offset = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}
const validDate = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const cell = (value) =>
  String(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/\|/g, "&#124;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
class TimeLog {
  constructor(directory, file, title, tasks, data, now = () => new Date()) {
    this.directory = path.join(directory, "tempos");
    this.file = file;
    this.title = title;
    this.tasks = tasks;
    this.now = now;
    this.state = { version: 1, sessions: [], running: null, reportName: null };
    const validIndex = (i) => Number.isInteger(i) && i >= 0 && i < tasks.length;
    const validSession = (s) =>
      s &&
      validIndex(s.index) &&
      validDate(s.startedAt) &&
      validDate(s.endedAt) &&
      Date.parse(s.endedAt) >= Date.parse(s.startedAt) &&
      typeof s.localStart === "string" &&
      typeof s.localEnd === "string" &&
      typeof s.reason === "string";
    if (
      data?.version === 1 &&
      Array.isArray(data.sessions) &&
      data.sessions.every(validSession)
    ) {
      this.state.sessions = structuredClone(data.sessions);
      if (
        typeof data.reportName === "string" &&
        path.basename(data.reportName) === data.reportName &&
        data.reportName.endsWith(".md")
      )
        this.state.reportName = data.reportName;
      const r = data.running;
      if (
        r &&
        validIndex(r.index) &&
        validDate(r.startedAt) &&
        validDate(r.lastSeenAt) &&
        Date.parse(r.lastSeenAt) >= Date.parse(r.startedAt) &&
        typeof r.localStart === "string"
      ) {
        this.state.running = structuredClone(r);
        // A crash never counts the time while the app was closed.
        this.stop("sessão recuperada após interrupção", new Date(r.lastSeenAt));
      }
    }
  }
  totals() {
    const totals = this.tasks.map(() => 0);
    for (const s of this.state.sessions)
      totals[s.index] += Date.parse(s.endedAt) - Date.parse(s.startedAt);
    return totals;
  }
  view() {
    return {
      totals: this.totals(),
      running: this.state.running,
      reportPath: this.state.reportName
        ? path.join(this.directory, this.state.reportName)
        : null,
    };
  }
  start(index) {
    if (
      !Number.isInteger(index) ||
      !this.tasks[index] ||
      this.tasks[index].done
    )
      throw Error("Escolha uma tarefa pendente para iniciar o cronômetro");
    if (this.state.running?.index === index) return;
    const now = this.now();
    this.stop("troca de tarefa", now);
    this.state.running = {
      index,
      startedAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      localStart: localTime(now),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  stop(reason = "pausa manual", date = this.now()) {
    const running = this.state.running;
    if (!running) return;
    const end = new Date(
      Math.max(Date.parse(running.startedAt), date.getTime()),
    );
    this.state.sessions.push({
      ...running,
      id: randomUUID(),
      endedAt: end.toISOString(),
      localEnd: localTime(end),
      reason,
    });
    this.state.running = null;
  }
  checkpoint() {
    if (this.state.running)
      this.state.running.lastSeenAt = new Date(
        Math.max(
          Date.parse(this.state.running.startedAt),
          this.now().getTime(),
        ),
      ).toISOString();
  }
  marker() {
    return `<!-- typewriter-tempos:v1 ${Buffer.from(path.basename(this.file)).toString("base64")} -->`;
  }
  async reportFile() {
    await fs.mkdir(this.directory, { recursive: true });
    // Reject symlinked report directories to keep writes in the records folder.
    const parent = await fs.realpath(path.dirname(this.directory));
    if (path.dirname(await fs.realpath(this.directory)) !== parent)
      throw Error("A pasta de tempos aponta para fora dos registros");
    let name = this.state.reportName || `${path.basename(this.file)}.tempos.md`;
    while (true) {
      const file = path.join(this.directory, name);
      try {
        const stat = await fs.lstat(file);
        if (
          !stat.isSymbolicLink() &&
          (await fs.readFile(file, "utf8")).startsWith(this.marker() + "\n")
        ) {
          this.state.reportName = name;
          return file;
        }
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
        try {
          await fs.writeFile(file, this.marker() + "\n", { flag: "wx" });
          this.state.reportName = name;
          return file;
        } catch (writeError) {
          if (writeError.code !== "EEXIST") throw writeError;
        }
      }
      name = `${path.basename(this.file)}.${randomUUID()}.tempos.md`;
    }
  }
  markdown() {
    const link = `[${cell(this.title)}](../${encodeURIComponent(path.basename(this.file))})`;
    const lines = [
      this.marker(),
      `# Tempos — ${cell(this.title)}`,
      "",
      `Plano: ${link}`,
      "",
      "Horários locais com segundos e deslocamento UTC. Cada início e pausa forma um intervalo. As pausas não contam no total.",
      "",
      "## Resumo por tarefa",
      "",
      "| Nº | Seção | Tarefa | Tempo acumulado |",
      "| --- | --- | --- | --- |",
    ];
    const totals = this.totals();
    this.tasks.forEach((t, i) =>
      lines.push(
        `| ${i + 1} | ${cell(t.section || "Sem seção")} | ${cell(t.text)} | ${duration(totals[i])} |`,
      ),
    );
    lines.push(
      "",
      "## Intervalos de trabalho",
      "",
      "| Tarefa | Dia | Início | Fim | Duração | Encerramento |",
      "| --- | --- | --- | --- | --- | --- |",
    );
    for (const s of this.state.sessions)
      lines.push(
        `| ${s.index + 1}: ${cell(this.tasks[s.index].text)} | [[${s.localStart.slice(0, 10)}]] | ${cell(s.localStart)} | ${cell(s.localEnd)} | ${duration(Date.parse(s.endedAt) - Date.parse(s.startedAt))} | ${cell(s.reason)} |`,
      );
    const running = this.state.running;
    if (running)
      lines.push(
        `| ${running.index + 1}: ${cell(this.tasks[running.index].text)} | [[${running.localStart.slice(0, 10)}]] | ${cell(running.localStart)} | em andamento | — | aguardando pausa |`,
      );
    lines.push(
      "",
      "O resumo contém somente intervalos encerrados. O intervalo em andamento é somado ao pausar. Este relatório é gerado pelo Typewriter; anotações pessoais devem ficar em outra nota.",
      "",
    );
    return lines.join("\n");
  }
  async writeReport() {
    if (!this.state.sessions.length && !this.state.running) return;
    const file = await this.reportFile();
    const temp = file + ".tmp";
    await fs.writeFile(temp, this.markdown(), "utf8");
    await fs.rename(temp, file);
  }
}
module.exports = { TimeLog, duration, localTime };
