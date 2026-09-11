import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { BATTLE_VIEW_ELEMENT_IDS } from "../src/presentation/battle-view.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("index.html references local assets that exist", async () => {
  const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
  const localReferences = [...html.matchAll(/(?:href|src)="(\.\/[^"?#]+)"/g)]
    .map((match) => match[1]);

  assert.deepEqual(localReferences, ["./styles/main.css", "./src/app/bootstrap.js"]);
  await Promise.all(localReferences.map((reference) => access(
    path.resolve(projectRoot, reference)
  )));
});

test("bootstrap DOM selectors all exist in index.html", async () => {
  const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
  const bootstrap = await readFile(
    path.join(projectRoot, "src", "app", "bootstrap.js"),
    "utf8"
  );
  const selectorIds = [...bootstrap.matchAll(/querySelector\("#([A-Za-z][A-Za-z0-9]*)"\)/g)]
    .map((match) => match[1]);

  assert.equal(selectorIds.length > 0, true);
  assert.equal(new Set(selectorIds).size, selectorIds.length);
  for (const id of selectorIds) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  for (const id of Object.values(BATTLE_VIEW_ELEMENT_IDS)) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("index.html contains exactly one detached Battle view template and unique IDs", async () => {
  const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
  assert.match(html, /<template id="battleViewTemplate">/);
  assert.match(html, /data-battle-view-root/);
  const ids = [...html.matchAll(/\sid="([A-Za-z][A-Za-z0-9]*)"/g)]
    .map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
