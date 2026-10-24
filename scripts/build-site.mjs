import path from "node:path";
import { buildSite } from "./site-package.mjs";

const outputRoot = path.resolve(process.argv[2] ?? "_site");
const manifest = await buildSite(outputRoot);
console.log(`Built and verified ${manifest.version}: ${manifest.chapters.length} chapters, ${manifest.files.length} files`);
console.log(outputRoot);
