const fs = require("node:fs");
const assert = require("node:assert/strict");
const { NtExecutable, NtExecutableResource, Resource } = require("resedit");
const version = require("../package.json").version;
const icon = fs.readFileSync("build/icon.ico");
const rawIcons = [];
for (let i = 0; i < icon.readUInt16LE(4); i++) {
  const offset = 6 + i * 16;
  rawIcons.push(
    icon.subarray(
      icon.readUInt32LE(offset + 12),
      icon.readUInt32LE(offset + 12) + icon.readUInt32LE(offset + 8),
    ),
  );
}
for (const file of [
  "dist/win-unpacked/Typewriter.exe",
  `dist/Typewriter-${version}-portatil.exe`,
]) {
  const executable = NtExecutable.from(fs.readFileSync(file));
  const resources = NtExecutableResource.from(executable);
  const groups = Resource.IconGroupEntry.fromEntries(resources.entries);
  assert.ok(groups.length, `Ícones ausentes em ${file}`);
  for (const expected of rawIcons)
    assert.ok(
      resources.entries.some(
        (entry) => entry.type === 3 && Buffer.from(entry.bin).equals(expected),
      ),
      `Ícone personalizado não encontrado em ${file}`,
    );
  console.log(`PASS: ícones de 32 e 256 pixels incorporados em ${file}`);
}
