const $ = (s) => document.querySelector(s),
  api = window.typewriter;
let plan = null,
  list = false,
  muted = false,
  audio = null,
  busy = false,
  celebrated = false,
  generation = 0,
  completionTimer = null,
  printTimers = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const keys of ["1234567890", "QWERTYUIOP", "ASDGHJKL", "ZXCVBNM!?"]) {
  const row = document.createElement("div");
  row.className = "key-row";
  for (const key of keys) {
    const el = document.createElement("span");
    el.className = "key";
    el.textContent = key;
    row.append(el);
  }
  $("#keyboard").append(row);
}
function tone(frequency, delay = 0) {
  if (muted) return;
  try {
    audio ||= new AudioContext();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain(),
      at = audio.currentTime + delay;
    o.type = "square";
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0.025, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.065);
    o.connect(g);
    g.connect(audio.destination);
    o.start(at);
    o.stop(at + 0.07);
  } catch {}
}
function sound(kind) {
  if (kind === "check") {
    tone(880);
    tone(1100, 0.09);
  } else if (kind === "complete")
    [880, 1100, 1320, 1760].forEach((f, i) => tone(f, i * 0.12));
  else tone(kind === "print" ? 600 + Math.random() * 200 : 440);
}
function error(e) {
  const raw = e?.message || "não foi possível ler este plano :(";
  let message = raw.replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    "",
  );
  if (/ENOENT|not found/i.test(message))
    message = "Arquivo ou pasta não encontrado.";
  else if (/EACCES|EPERM|denied|not allowed/i.test(message))
    message =
      "Sem permissão para acessar o arquivo ou a área de transferência.";
  else if (/ENOSPC/i.test(message))
    message = "Não há espaço disponível para salvar os registros.";
  else if (/EBUSY/i.test(message))
    message = "O arquivo está em uso. Tente novamente.";
  else if (
    /\bE[A-Z]{2,}\b/.test(message) ||
    /clipboard|failed|error|invalid|couldn't/i.test(message)
  )
    message =
      "Não foi possível concluir a operação. Verifique a pasta de registros e tente novamente.";
  $("#error").textContent = message;
  $("#app").classList.remove("shake");
  void $("#app").offsetWidth;
  $("#app").classList.add("shake");
}
function sectionLabel(section) {
  const el = document.createElement("div");
  el.className = "section";
  const name = document.createElement("span");
  name.textContent = section;
  el.append(name);
  if (plan.tasks.filter((t) => t.section === section).every((t) => t.done)) {
    const stamp = document.createElement("span");
    stamp.className = "stamp";
    stamp.textContent = "feito!";
    el.append(stamp);
  }
  return el;
}
function taskRow(task, index) {
  const row = document.createElement("button");
  row.className = "task" + (task.done ? " done" : "");
  row.dataset.index = index;
  row.setAttribute("role", "checkbox");
  row.setAttribute("aria-checked", String(task.done));
  const box = document.createElement("span");
  box.className = "box";
  box.innerHTML =
    '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5L4 8L9 1" fill="none" stroke="#F5EDE0" stroke-width="2"/></svg>';
  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;
  row.append(box, text);
  row.onclick = () => toggle(index, row);
  const entry = document.createElement("div");
  entry.className = "task-entry";
  const bar = document.createElement("div");
  bar.className = "timer-bar";
  bar.dataset.timerIndex = index;
  const elapsed = document.createElement("span");
  elapsed.className = "timer-elapsed";
  elapsed.setAttribute("aria-label", "Tempo acumulado nesta tarefa");
  const button = document.createElement("button");
  button.className = "timer-toggle";
  button.type = "button";
  button.onclick = () => controlTimer(index);
  bar.append(elapsed, button);
  entry.append(row, bar);
  updateTimerBar(bar, index);
  return entry;
}
function elapsedLabel(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000),
    pad = (n) => String(n).padStart(2, "0");
  return (
    pad(Math.floor(seconds / 3600)) +
    ":" +
    pad(Math.floor(seconds / 60) % 60) +
    ":" +
    pad(seconds % 60)
  );
}
function updateTimerBar(bar, index) {
  const timing = plan?.timing,
    running = timing?.running;
  const active = running?.index === index;
  const elapsed =
    (timing?.totals[index] || 0) +
    (active ? Math.max(0, Date.now() - Date.parse(running.startedAt)) : 0);
  const label = elapsedLabel(elapsed),
    output = bar.querySelector(".timer-elapsed");
  if (output.textContent !== label) output.textContent = label;
  const button = bar.querySelector("button");
  button.textContent = active ? "Ⅱ pausar" : "▶ iniciar";
  button.title = active
    ? "Pausar o cronômetro desta tarefa"
    : "Iniciar ou continuar o cronômetro desta tarefa";
  button.setAttribute(
    "aria-label",
    (active ? "Pausar" : "Iniciar") + " cronômetro da tarefa " + (index + 1),
  );
  button.disabled = !!plan.tasks[index].done;
  bar.classList.toggle("running", active);
}
setInterval(() => {
  if (plan)
    document
      .querySelectorAll("[data-timer-index]")
      .forEach((bar) => updateTimerBar(bar, Number(bar.dataset.timerIndex)));
}, 250);
async function controlTimer(index) {
  if (busy || !$("#overlay").hidden) return;
  busy = true;
  const scroll = $("#paper").scrollTop;
  try {
    plan = await api.timer(
      plan.timing?.running?.index === index ? "pause" : "start",
      index,
    );
    render();
    $("#paper").scrollTop = scroll;
    document
      .querySelector(`[data-timer-index="${index}"] button`)
      ?.focus({ preventScroll: true });
    $("#error").textContent = "";
  } catch (e) {
    try {
      plan = await api.timer("snapshot");
      render();
    } catch {}
    error(e);
  } finally {
    busy = false;
  }
}
api.onTimerState((state) => {
  if (!plan || state.plan?.path !== plan.path) return;
  plan.timing = state.plan.timing;
  document
    .querySelectorAll("[data-timer-index]")
    .forEach((bar) => updateTimerBar(bar, Number(bar.dataset.timerIndex)));
  if (state.error) error(Error(state.error));
});
function render(focusIndex) {
  $("#progress").textContent = plan
    ? `${plan.tasks.filter((t) => t.done).length}/${plan.tasks.length} concluídas`
    : "0/0 concluídas";
  $("#idle").hidden = !!plan;
  $("#mode").textContent = list ? "●" : "≡";
  $("#mode").title = list ? "Modo foco" : "Mostrar lista completa";
  $("#paper").classList.toggle("list", list);
  const content = $("#paper-content");
  content.replaceChildren();
  if (!plan) {
    $("#paper").classList.remove("visible");
    return;
  }
  $("#paper").classList.add("visible");
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = `··· ${plan.title} ···`;
  title.title = plan.title;
  content.append(title);
  const divider = document.createElement("div");
  divider.className = "divider";
  content.append(divider);
  if (list) {
    let previous = null;
    plan.tasks.forEach((t, i) => {
      if (t.section !== previous) {
        if (t.section) content.append(sectionLabel(t.section));
        previous = t.section;
      }
      content.append(taskRow(t, i));
    });
    if (plan.tasks.every((t) => t.done)) {
      const banner = document.createElement("div");
      banner.className = "all-done";
      banner.textContent = "TUDO CONCLUÍDO ✓";
      content.append(banner);
    }
  } else {
    const i = focusIndex ?? plan.tasks.findIndex((t) => !t.done);
    if (i >= 0) {
      const task = plan.tasks[i];
      if (task.section) content.append(sectionLabel(task.section));
      content.append(taskRow(task, i));
    } else {
      const el = document.createElement("div");
      el.className = "all-done";
      el.textContent = "TUDO CONCLUÍDO ✓";
      content.append(el);
    }
  }
}
async function toggle(index, row) {
  if (busy || !$("#overlay").hidden) return;
  busy = true;
  const current = generation;
  try {
    plan = await api.toggle(index);
    $("#error").textContent = "";
    const checked = plan.tasks[index].done;
    render(list ? undefined : index);
    row = document.querySelector(`[data-index="${index}"]`);
    if (row && checked) {
      row.classList.add("checking");
      for (let i = 0; i < 6; i++) {
        const spark = document.createElement("i");
        spark.className = "spark";
        spark.style.setProperty("--x", `${Math.cos((i * Math.PI) / 3) * 28}px`);
        spark.style.setProperty("--y", `${Math.sin((i * Math.PI) / 3) * 25}px`);
        row.append(spark);
        setTimeout(() => spark.remove(), 550);
      }
    }
    sound(checked ? "check" : "uncheck");
    if (checked && !list) {
      await sleep(750);
      if (current !== generation) return;
      row?.classList.add("leaving");
      await sleep(200);
      if (current !== generation) return;
      const next = plan.tasks.findIndex((t, i) => i > index && !t.done);
      render(next >= 0 ? next : undefined);
      $(".task")?.classList.add("arriving");
      sound("print");
    }
    if (plan.tasks.every((t) => t.done) && !celebrated) complete();
  } catch (e) {
    error(e);
  } finally {
    busy = false;
  }
}
function print() {
  const current = generation;
  $("#paper").classList.add("printing");
  const elements = [...$("#paper-content").children];
  elements.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.animationDelay = `${800 + i * 90}ms`;
    printTimers.push(
      setTimeout(
        () => {
          if (generation === current) sound("print");
        },
        800 + i * 90,
      ),
    );
  });
  printTimers.push(
    setTimeout(() => $("#paper").classList.remove("printing"), 2000),
  );
}
async function load(source) {
  if (busy) return;
  busy = true;
  try {
    const loaded = await source();
    if (!loaded) return;
    plan = loaded;
    generation++;
    celebrated = plan.tasks.every((t) => t.done);
    list = false;
    await api.mode(false);
    $("#error").textContent = "";
    render();
    print();
  } catch (e) {
    error(e);
  } finally {
    busy = false;
  }
}
function complete() {
  celebrated = true;
  render();
  sound("complete");
  const palette = ["#C1443C", "#F5EDE0", "#FF8080", "#FFD700"];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("i");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 420}px`;
    piece.style.background = palette[i % 4];
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    piece.style.setProperty("--drift", `${Math.random() * 120 - 60}px`);
    $("#confetti").append(piece);
  }
  completionTimer = setTimeout(() => {
    if (plan) {
      $("#confetti").replaceChildren();
      dialog("complete");
    }
  }, 1600);
}
let previousFocus = null;
function closeDialog() {
  $("#overlay").hidden = true;
  previousFocus?.focus();
}
function dialog(kind) {
  if (!plan) return;
  previousFocus = document.activeElement;
  $("#overlay").hidden = false;
  $("#dialog-title").textContent =
    kind === "complete" ? "✓ plano concluído" : "✕ interromper plano?";
  $("#dialog-text").textContent =
    kind === "complete"
      ? "adicionar uma nota da sessão?"
      : "registrar o progresso ou excluir este plano?";
  $("#note").hidden = kind !== "complete";
  $("#note").value = "";
  $("#actions").replaceChildren();
  const actions =
    kind === "complete"
      ? [
          ["salvar + novo plano", "complete"],
          ["pular", "skip"],
        ]
      : [
          ["registrar", "log"],
          ["descartar", "discard"],
          ["cancelar", "cancel"],
        ];
  for (const [label, action] of actions) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = async () => {
      if (action === "cancel") {
        closeDialog();
        return;
      }
      const buttons = [...$("#actions").children];
      buttons.forEach((b) => (b.disabled = true));
      try {
        await api.finish(
          action === "skip" ? "complete" : action,
          action === "complete" ? $("#note").value : "",
        );
        closeDialog();
        await reset();
      } catch (e) {
        error(e);
        buttons.forEach((b) => (b.disabled = false));
      }
    };
    $("#actions").append(b);
  }
  setTimeout(
    () =>
      kind === "complete" ? $("#note").focus() : $("#actions button").focus(),
    0,
  );
}
async function reset() {
  generation++;
  clearTimeout(completionTimer);
  printTimers.forEach(clearTimeout);
  printTimers = [];
  $("#paper").classList.remove("printing");
  $("#paper").classList.add("retract");
  await sleep(400);
  plan = null;
  list = false;
  celebrated = false;
  $("#confetti").replaceChildren();
  $("#paper").classList.remove("retract");
  await api.mode(false);
  render();
}
$("#mode").onclick = async () => {
  if (!plan || busy) return;
  try {
    list = !list;
    await api.mode(list);
    render();
  } catch (e) {
    error(e);
  }
};
$("#sound").onclick = async () => {
  muted = !muted;
  $("#sound").textContent = muted ? "✕" : "♪";
  $("#sound").title = muted ? "Ativar som" : "Silenciar som";
  try {
    await api.mute(muted);
  } catch (e) {
    error(e);
  }
};
$("#paste").onclick = async () => {
  if (plan) {
    error(Error("Conclua ou interrompa o plano atual primeiro"));
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    await load(() => api.importText(text));
  } catch (e) {
    error(e);
  }
};
$("#add").onclick = () => {
  if (plan) {
    error(Error("Conclua ou interrompa o plano atual primeiro"));
    return;
  }
  load(() => api.openFile());
};
document.addEventListener("keydown", (event) => {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "o" &&
    !event.target.matches("input,textarea") &&
    $("#overlay").hidden
  ) {
    event.preventDefault();
    $("#add").click();
  }
});
document.addEventListener("paste", (e) => {
  if (e.target.matches("textarea,input")) return;
  e.preventDefault();
  if (plan) {
    error(Error("Conclua ou interrompa o plano atual primeiro"));
    return;
  }
  const text = e.clipboardData.getData("text/plain");
  load(() => api.importText(text));
});
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  $("#app").classList.add("drag-over");
});
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget) $("#app").classList.remove("drag-over");
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  $("#app").classList.remove("drag-over");
  if (plan) {
    error(Error("Conclua ou interrompa o plano atual primeiro"));
    return;
  }
  const file = e.dataTransfer.files[0];
  if (!file || !file.name.toLowerCase().endsWith(".md")) {
    error();
    return;
  }
  load(() => api.importFile(file));
});
document.addEventListener("keydown", (e) => {
  if (
    e.ctrlKey &&
    !e.metaKey &&
    e.key.toLowerCase() === "c" &&
    !e.target.matches("input,textarea") &&
    plan &&
    $("#overlay").hidden &&
    !busy
  ) {
    e.preventDefault();
    clearTimeout(completionTimer);
    dialog("abort");
  }
  if (e.key === "Escape" && !$("#overlay").hidden && $("#note").hidden)
    closeDialog();
  if (e.key === "Tab" && !$("#overlay").hidden) {
    const items = [
      ...$("#overlay").querySelectorAll("textarea:not([hidden]),button"),
    ];
    if (e.shiftKey && document.activeElement === items[0]) {
      e.preventDefault();
      items.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
      e.preventDefault();
      items[0].focus();
    }
  }
});
api
  .initial()
  .then((state) => {
    plan = state.plan;
    muted = state.muted;
    celebrated = !!plan && plan.tasks.every((t) => t.done);
    $("#sound").textContent = muted ? "✕" : "♪";
    $("#sound").title = muted ? "Ativar som" : "Silenciar som";
    render();
    if (plan) print();
    if (state.error) error(Error(state.error));
  })
  .catch(error);
// Keep the native input region aligned with printing, resizing and dialog changes.
let regionFrame = null;
let previousRegions = "";
function updateInputRegions() {
  regionFrame = null;
  const overlay = document.querySelector("#overlay");
  const rectangles = [];
  function add(element, clip) {
    if (!element || getComputedStyle(element).visibility === "hidden") return;
    const bounds = element.getBoundingClientRect();
    const x = Math.max(0, bounds.left, clip?.left ?? 0);
    const y = Math.max(0, bounds.top, clip?.top ?? 0);
    const right = Math.min(innerWidth, bounds.right, clip?.right ?? innerWidth);
    const bottom = Math.min(
      innerHeight,
      bounds.bottom,
      clip?.bottom ?? innerHeight,
    );
    if (right > x && bottom > y)
      rectangles.push({ x, y, width: right - x, height: bottom - y });
  }
  if (!overlay.hidden) add(overlay);
  else {
    add(document.querySelector("#machine"));
    add(
      document.querySelector("#paper"),
      document.querySelector("#paper-track").getBoundingClientRect(),
    );
    const error = document.querySelector("#error");
    if (error.textContent) add(error);
    document.querySelectorAll(".confetti").forEach((piece) => add(piece));
  }
  const serialized = JSON.stringify(rectangles);
  if (serialized !== previousRegions) {
    previousRegions = serialized;
    api.updateInputRegions(rectangles);
  }
  if (
    document.getAnimations().some((animation) => {
      const target = animation.effect?.target;
      return (
        animation.playState === "running" &&
        target?.matches("#paper,#machine,#app,.confetti")
      );
    })
  )
    scheduleInputRegions();
}
function scheduleInputRegions() {
  if (regionFrame === null)
    regionFrame = requestAnimationFrame(updateInputRegions);
}
new MutationObserver(scheduleInputRegions).observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  characterData: true,
});
const regionResize = new ResizeObserver(scheduleInputRegions);
for (const selector of ["#machine", "#paper", "#paper-track", "#error"])
  regionResize.observe(document.querySelector(selector));
for (const event of [
  "resize",
  "animationstart",
  "animationend",
  "animationcancel",
  "transitionrun",
  "transitionend",
])
  window.addEventListener(event, scheduleInputRegions);
document.fonts.ready.then(scheduleInputRegions);
scheduleInputRegions();
