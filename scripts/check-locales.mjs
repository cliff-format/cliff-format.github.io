// Audit the site's CLIFF catalogs and smoke-test every locale.
//
//   node scripts/check-locales.mjs [dir]
//
// Validates each document with the core checks, reports translated/missing
// counts per document, and renders two sample entries per locale so a broken
// document or a bad entry ID fails here instead of at build time. A locale
// listed below without a document is an error, not a skip: the runtime would
// otherwise fall back to another language without saying so.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse, validateDocument } from "@cliff-format/core";
import { createI18n } from "@cliff-format/i18n";

const LOCALES = ["zh-CN", "en-US", "ja-JP", "ko-KR", "ar", "es-ES", "fr-FR", "pt-BR", "ru-RU", "de-DE"];
const SOURCE = "zh-CN";

const dir = process.argv[2] ?? fileURLToPath(new URL("../src/locales", import.meta.url));
const present = readdirSync(dir).filter((name) => /^[a-z]{2}(-[A-Z]{2})?$/.test(name));

let failed = false;
for (const name of present) {
  if (!LOCALES.includes(name)) {
    console.error(`locale directory missing from check-locales.mjs: ${name}`);
    failed = true;
  }
}
for (const locale of LOCALES) {
  if (!existsSync(join(dir, locale, "site.cliff"))) {
    console.error(`no document for ${locale}: expected src/locales/${locale}/site.cliff`);
    failed = true;
  }
}
if (failed) {
  console.error("fix the locale list first");
  process.exit(1);
}

const documents = LOCALES.map((locale) => {
  const text = readFileSync(join(dir, locale, "site.cliff"), "utf8");
  return { locale, text, document: parse(text) };
});
const resources = documents.map((entry) => entry.text);

for (const { locale, document } of documents) {
  const issues = validateDocument(document, { checkWidth: true, checkLayout: true, style: true });
  const entries = document.groups.flatMap((group) => group.entries);
  const missing = entries.filter((entry) => entry.target === undefined).length;
  const i18n = createI18n({ locale, fallbackLocale: SOURCE, resources, missing: "throw" });
  const { t } = i18n.scope({ namespace: "cliff", clan: "site" });
  const sample = t("hero-title-1").render();
  const lede = t("hero-lede").render().slice(0, 40);

  const coverage = locale === SOURCE ? "source" : `${String(entries.length - missing).padStart(3)}/${entries.length}`;
  console.log(`${locale.padEnd(6)} ${coverage.padStart(7)}  "${sample}" / "${lede}…"`);
  for (const issue of issues) {
    failed = true;
    console.log("  issue:", JSON.stringify(issue));
  }
  if (issues.length === 0 && missing > 0 && locale !== SOURCE) {
    failed = true;
    console.log("  missing targets:", missing);
  }
}

console.log(`locales=${documents.length}`);
process.exitCode = failed ? 1 : 0;
