// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { cliff } from "@cliff-format/vite";

// The site is an organization page: it owns the root of cliff-format.github.io,
// so `base` stays "/" and every absolute URL is built from `site`.
export default defineConfig({
  site: "https://cliff-format.github.io",
  trailingSlash: "always",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss(), cliff({ dirs: ["src/locales"], dts: "src/cliff.d.ts" })],
  },
  build: {
    inlineStylesheets: "auto",
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      wrap: false,
    },
  },
});