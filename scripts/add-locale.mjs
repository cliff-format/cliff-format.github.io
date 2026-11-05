// Add a locale document from a JSON translation map.
//
//   node scripts/add-locale.mjs <locale> <map.json>
//
// The map is { entryId: translatedText }. Sources and structure come from the
// zh-CN document, so only the target text is authored here; formatting is
// produced by the core serializer, which keeps the output conforming.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDocument, createHeader, parse, serialize } from "@cliff-format/core";

const [locale, mapPath] = process.argv.slice(2);
if (!locale || !mapPath) throw new Error("usage: node scripts/add-locale.mjs <locale> <map.json>");

const source = parse(readFileSync("src/locales/zh-CN/site.cliff", "utf8"));
const map = JSON.parse(readFileSync(mapPath, "utf8"));

const missing = [];
const document = createDocument("1.1");
document.header = createHeader();
document.header.namespace = "cliff";
document.header.clan = "site";
document.header.sourceLanguage = "zh-CN";
document.header.targetLanguage = locale;
document.header.title = "CLIFF site copy";
document.groups = source.groups.map((group) => ({
  path: group.path,
  line: 0,
  type: group.type,
  emotion: [],
  entries: group.entries.map((entry) => {
    const target = map[entry.id];
    if (typeof target !== "string" || target.length === 0) missing.push(entry.id);
    return {
      id: entry.id,
      line: 0,
      source: entry.source,
      target: target ?? entry.source,
      ...(entry.type ? { type: entry.type } : {}),
      emotion: [],
      reference: [],
      status: "translated",
      extensions: {},
    };
  }),
  extensions: {},
}));

if (missing.length > 0) {
  console.error("missing translations:", missing.join(", "));
  process.exit(1);
}

mkdirSync(join("src/locales", locale), { recursive: true });
writeFileSync(join("src/locales", locale, "site.cliff"), serialize(document), "utf8");
console.log(locale, "written, entries:", document.groups.reduce((n, g) => n + g.entries.length, 0));