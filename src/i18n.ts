// Site localization: every string comes from src/locales/<locale>/site.cliff.
//
// One CLIFF document per rendered language, laid out as the specification
// recommends (§11.1: <target-language>/<clan>.cliff). Each document declares the
// Chinese source and its own `target`, so the runtime picks a record by its
// target language and no per-locale transformation happens at build time.

import { parse } from "@cliff-format/core";
import { createI18n } from "@cliff-format/i18n";
import { resources } from "virtual:cliff";

type Catalog = ReturnType<typeof createI18n>;

export const LOCALES = [
  "zh-CN",
  "en-US",
  "ja-JP",
  "ko-KR",
  "ar",
  "es-ES",
  "fr-FR",
  "pt-BR",
  "ru-RU",
  "de-DE",
] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-CN";

/** Language name in its own language, for the switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "中文",
  "en-US": "English",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  ar: "العربية",
  "es-ES": "Español",
  "fr-FR": "Français",
  "pt-BR": "Português",
  "ru-RU": "Русский",
  "de-DE": "Deutsch",
};

/** Writing direction; Arabic is the only right-to-left locale for now. */
export function localeDir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** URL prefix per locale, shared by pages, links and hreflang. */
export const LOCALE_PREFIX: Record<Locale, string> = {
  "zh-CN": "",
  "en-US": "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
  ar: "ar",
  "es-ES": "es",
  "fr-FR": "fr",
  "pt-BR": "pt",
  "ru-RU": "ru",
  "de-DE": "de",
};

const NAMESPACE = "cliff";
const CLAN = "site";

/** Target language of every document the build actually received. Without
    this guard a locale whose document is missing silently renders whichever
    record the catalog happens to return first. */
const documentLocales = new Set(resources.map((text) => parse(text).header.targetLanguage));

const catalogs = new Map<Locale, Catalog>();

function catalog(locale: Locale): Catalog {
  if (!documentLocales.has(locale)) {
    throw new Error(
      `No CLIFF document declares target-language "${locale}". Add src/locales/${locale}/site.cliff.`,
    );
  }
  let instance = catalogs.get(locale);
  if (instance === undefined) {
    instance = createI18n({
      locale,
      fallbackLocale: DEFAULT_LOCALE,
      // A typo in an entry ID must fail the build, not render a fallback.
      missing: "throw",
      resources,
    });
    catalogs.set(locale, instance);
  }
  return instance;
}

/** Render one entry for a locale. Values are inserted verbatim, so callers that
    pass HTML must render the result with `set:html`. */
export function t(locale: Locale, id: string, params?: Record<string, unknown>): string {
  return catalog(locale).scope({ namespace: NAMESPACE, clan: CLAN }).t(id).render(params);
}

export function localePath(locale: Locale): string {
  const prefix = LOCALE_PREFIX[locale];
  return prefix.length === 0 ? "/" : `/${prefix}/`;
}

/** Resolve a route prefix such as "en" or "ja" back to a locale. */
export function localeFromPrefix(prefix: string): Locale | undefined {
  return LOCALES.find((locale) => LOCALE_PREFIX[locale] === prefix);
}