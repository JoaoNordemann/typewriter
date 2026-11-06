const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("typewriter", {
  updateInputRegions: (regions) => ipcRenderer.send("input-regions", regions),
  initial: () => ipcRenderer.invoke("initial"),
  openFile: () => ipcRenderer.invoke("open-file"),
  importText: (text) => ipcRenderer.invoke("import", { text }),
  importFile: (file) =>
    ipcRenderer.invoke("import", { path: webUtils.getPathForFile(file) }),
  timer: (action, index) => ipcRenderer.invoke("timer", action, index),
  onTimerState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("timer-state", listener);
    return () => ipcRenderer.removeListener("timer-state", listener);
  },
  toggle: (index) => ipcRenderer.invoke("toggle", index),
  mode: (list) => ipcRenderer.invoke("mode", list),
  mute: (muted) => ipcRenderer.invoke("mute", muted),
  finish: (action, note) => ipcRenderer.invoke("finish", action, note),
});
