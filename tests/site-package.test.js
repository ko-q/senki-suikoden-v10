import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildSite, verifySite } from "../scripts/site-package.mjs";
import { GAME_VERSION } from "../src/config/version.js";

test("the release contains the nine-chapter player entry, maps and portraits, with no development tools", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "senki-site-test-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const root = path.join(temporaryRoot, "site");
  const manifest = await buildSite(root);
  assert.equal(manifest.version, GAME_VERSION);
  assert.equal(manifest.chapters.length, 9);
  assert.equal(manifest.files.filter((file) => file.path.startsWith("assets/maps/")).length, 9);
  assert.equal(manifest.files.filter((file) => file.path.startsWith("assets/portraits/")).length, 166);
  assert.ok(manifest.files.every((file) => !/^(docs|tests|scripts|test-support|\.git)\//.test(file.path)));
  assert.equal((await verifySite(root)).files.length, manifest.files.length);

  await assert.rejects(buildSite(root), { code: "EEXIST" });
  assert.equal((await verifySite(root)).version, GAME_VERSION, "an existing release is left intact");

  const portrait = manifest.files.find((file) => file.path.startsWith("assets/portraits/"));
  const portraitPath = path.join(root, portrait.path);
  const original = await readFile(portraitPath);
  const corrupt = Buffer.from(original); corrupt[0] ^= 1;
  await writeFile(portraitPath, corrupt);
  await assert.rejects(verifySite(root), /SITE_HASH_MISMATCH/);
  await writeFile(portraitPath, original);

  await rm(portraitPath);
  await assert.rejects(verifySite(root), /SITE_FILE_LIST_MISMATCH/);
});
