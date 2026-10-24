import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_VERSION, CONTENT_REVISION } from "../src/config/version.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const publicRoots = ["index.html", "src", "styles", "assets"];

async function collectFiles(root, relative = "") {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    assert.ok(!entry.isSymbolicLink(), `SITE_SYMLINK: ${name}`);
    if (entry.isDirectory()) files.push(...await collectFiles(root, name));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

/** The same allowlisted files are used in local preview and Pages deployment. */
export async function buildSite(outputRoot) {
  // Deliberately refuse existing directories: never erase or mix an older release.
  await mkdir(outputRoot);
  for (const name of publicRoots) {
    await cp(path.join(sourceRoot, name), path.join(outputRoot, name), { recursive: true, dereference: false });
  }
  await writeFile(path.join(outputRoot, ".nojekyll"), "");
  const files = [];
  for (const name of await collectFiles(outputRoot)) {
    const bytes = await readFile(path.join(outputRoot, name));
    files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
  const manifest = {
    version: GAME_VERSION,
    contentRevision: CONTENT_REVISION,
    chapters: V9_OPENING_STAGE_SOURCE.map(({ id, title }) => ({ id, title })),
    files
  };
  await writeFile(path.join(outputRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await verifySite(outputRoot);
  return manifest;
}

export async function verifySite(root) {
  const manifest = JSON.parse(await readFile(path.join(root, "release-manifest.json"), "utf8"));
  assert.equal(manifest.version, GAME_VERSION, "SITE_VERSION_MISMATCH");
  assert.equal(manifest.contentRevision, CONTENT_REVISION, "SITE_CONTENT_MISMATCH");
  assert.deepEqual(manifest.chapters, V9_OPENING_STAGE_SOURCE.map(({ id, title }) => ({ id, title })));
  assert.equal(manifest.chapters.length, 9, "SITE_MUST_HAVE_NINE_CHAPTERS");
  const names = manifest.files.map((entry) => entry.path);
  assert.equal(new Set(names).size, names.length, "SITE_DUPLICATE_PATH");
  assert.deepEqual(await collectFiles(root), [...names, "release-manifest.json"].sort(), "SITE_FILE_LIST_MISMATCH");
  for (const entry of manifest.files) {
    assert.ok(!entry.path.startsWith("/") && !entry.path.includes("\\") &&
      !entry.path.split("/").some((part) => part === ".." || part === "." || part === ""), "SITE_UNSAFE_PATH");
    const bytes = await readFile(path.join(root, entry.path));
    assert.equal(bytes.length, entry.bytes, `SITE_SIZE_MISMATCH: ${entry.path}`);
    assert.equal(hash(bytes), entry.sha256, `SITE_HASH_MISMATCH: ${entry.path}`);
  }
  for (const required of ["index.html", "src/app/bootstrap.js", "styles/player-interface.css",
    "src/definitions/v9-characters.js", "src/definitions/v9-opening-stage-source.js"]) {
    assert.ok(names.includes(required), `SITE_REQUIRED_FILE_MISSING: ${required}`);
  }
  const html = await readFile(path.join(root, "index.html"), "utf8");
  assert.match(html, /id="stageSelectOverlay"/, "SITE_STAGE_SELECTION_MISSING");
  assert.doesNotMatch(html, /Battle vertical slice|Milestone 13 scope/, "SITE_DEVELOPMENT_ENTRY");
  return manifest;
}
