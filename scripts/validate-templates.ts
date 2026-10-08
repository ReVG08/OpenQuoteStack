import { readdir, readFile } from "node:fs/promises";
import { parseDocument } from "@openquotestack/schema";
const directory = new URL("../templates/", import.meta.url),
  ids = new Set<string>();
for (const file of await readdir(directory)) {
  if (!file.endsWith(".oqs.json")) continue;
  const doc = parseDocument(
    JSON.parse(await readFile(new URL(file, directory), "utf8")),
  );
  if (!doc.template) throw new Error(`${file}: template metadata is required`);
  if (ids.has(doc.template.id))
    throw new Error(`${file}: duplicate template ID`);
  ids.add(doc.template.id);
  console.log(`Valid: ${file}`);
}
