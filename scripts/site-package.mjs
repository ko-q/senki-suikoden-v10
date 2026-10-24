import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_VERSION, CONTENT_REVISION } from "../src/config/version.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const publicDirectories = ["src", "styles", "assets"];

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
  const sourceFiles = ["index.html"];
  for (const directory of publicDirectories) sourceFiles.push(...await collectFiles(sourceRoot, directory));
  const fingerprint = createHash("sha256");
  for (const name of sourceFiles.sort()) {
    fingerprint.update(name).update("\0").update(await readFile(path.join(sourceRoot, name))).update("\0");
  }
  // Give the entire module graph a new URL, not just bootstrap.js. Browsers can
  // otherwise combine a new HTML entry with still-fresh modules from dev.13.
  const assetBase = `builds/${GAME_VERSION}-${fingerprint.digest("hex").slice(0, 12)}`;
  const assetRoot = path.join(outputRoot, assetBase);
  await mkdir(assetRoot, { recursive: true });
  for (const name of publicDirectories) {
    await cp(path.join(sourceRoot, name), path.join(assetRoot, name), { recursive: true, dereference: false });
  }
  const sourceHtml = await readFile(path.join(sourceRoot, "index.html"), "utf8");
  const html = sourceHtml.replaceAll('href="./styles/', `href="./${assetBase}/styles/`)
    .replace('src="./src/app/bootstrap.js"', `src="./${assetBase}/src/app/bootstrap.js"`);
  await writeFile(path.join(outputRoot, "index.html"), html);
  await writeFile(path.join(outputRoot, ".nojekyll"), "");
  const files = [];
  for (const name of await collectFiles(outputRoot)) {
    const bytes = await readFile(path.join(outputRoot, name));
    files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
  const manifest = {
    version: GAME_VERSION,
    contentRevision: CONTENT_REVISION,
    assetBase,
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
  const assetPrefix = `builds/${GAME_VERSION}-`;
  assert.ok(typeof manifest.assetBase === "string" && manifest.assetBase.startsWith(assetPrefix) &&
    /^[a-f0-9]{12}$/.test(manifest.assetBase.slice(assetPrefix.length)), "SITE_ASSET_BASE_INVALID");
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
  for (const required of ["index.html", ...["src/app/bootstrap.js", "styles/player-interface.css",
    "src/definitions/v9-characters.js", "src/definitions/v9-opening-stage-source.js"].map((name) => `${manifest.assetBase}/${name}`)]) {
    assert.ok(names.includes(required), `SITE_REQUIRED_FILE_MISSING: ${required}`);
  }
  const html = await readFile(path.join(root, "index.html"), "utf8");
  assert.match(html, /id="stageSelectOverlay"/, "SITE_STAGE_SELECTION_MISSING");
  assert.doesNotMatch(html, /Battle vertical slice|Milestone 13 scope/, "SITE_DEVELOPMENT_ENTRY");
  const references = [...html.matchAll(/(?:href|src)="(\.\/[^"?#]+)"/g)].map((match) => match[1].slice(2));
  assert.equal(references.length, 3, "SITE_ENTRY_REFERENCES_MISSING");
  for (const name of references) {
    assert.ok(name.startsWith(`${manifest.assetBase}/`) && names.includes(name), `SITE_UNVERSIONED_REFERENCE: ${name}`);
  }
  return manifest;
}
