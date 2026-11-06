// Page behavior: theme state, its view transition, copy-to-clipboard, and the
// language menu. Every effect is an enhancement; the page renders and animates
// without this module, and the entrance sequence is pure CSS. Glass is inert
// here — the LiquidGlass component mounts itself once the document is parsed.

type Theme = "light" | "dark";

const root = document.documentElement;
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const themeSwitch = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
const chrome: Record<Theme, string> = { dark: "#0e0f10", light: "#f3f4f1" };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state: { theme: Theme } = {
  theme: root.dataset.theme === "light" ? "light" : "dark",
};

function store(): void {
  try {
    localStorage.setItem("cliff-theme", JSON.stringify({ theme: state.theme }));
  } catch {
    // Storage can be unavailable in private modes; the theme still applies.
  }
}

function syncUi(): void {
  if (themeSwitch) {
    // The label comes from the localized document; only the state changes here.
    themeSwitch.setAttribute("aria-checked", String(state.theme === "dark"));
  }
  if (themeMeta) themeMeta.content = chrome[state.theme];
}

function applyTheme(next: Theme): void {
  if (next === state.theme) return;
  state.theme = next;
  root.dataset.theme = next;
  syncUi();
  store();
}

function setTheme(next: Theme, origin: HTMLElement | null): void {
  if (next === state.theme) return;
  const canTransition =
    !reduceMotion && typeof document.startViewTransition === "function" && origin !== null;
  if (!canTransition) {
    applyTheme(next);
    return;
  }

  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(() => applyTheme(next));
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 620,
          easing: "cubic-bezier(.22, 1, .36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
}

themeSwitch?.addEventListener("click", () => {
  setTheme(state.theme === "dark" ? "light" : "dark", themeSwitch);
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable]")) return;
  if (event.key === "t" || event.key === "T") {
    setTheme(state.theme === "dark" ? "light" : "dark", themeSwitch);
  }
});

/* Anchor the language popover to its trigger. The CSS fallback sits under the
   header's right edge; this keeps the menu under the button at every width and
   in both writing directions. */
const langMenu = document.getElementById("lang-menu");
const langButton = document.querySelector<HTMLButtonElement>(".lang-btn");
const headPane = document.querySelector<HTMLElement>(".head-pane");

function placeLangMenu(): void {
  if (!langMenu || !langButton || !headPane) return;
  const button = langButton.getBoundingClientRect();
  const head = headPane.getBoundingClientRect();
  const gutter = parseFloat(getComputedStyle(root).getPropertyValue("--gutter")) || 20;
  const width = langMenu.offsetWidth || 164;
  const rtl = getComputedStyle(root).direction === "rtl";

  if (rtl) {
    // In RTL, inset-inline-start is the menu's right edge. Align it with the
    // trigger's inline start, then clamp so the menu stays inside the gutter.
    const right = Math.min(Math.max(button.right, gutter + width), innerWidth - gutter);
    langMenu.style.insetInlineStart = `${Math.round(innerWidth - right)}px`;
  } else {
    const left = Math.min(Math.max(button.left, gutter), innerWidth - gutter - width);
    langMenu.style.insetInlineStart = `${Math.round(left)}px`;
  }
  langMenu.style.insetInlineEnd = "auto";
  langMenu.style.top = `${Math.round(head.bottom + 8)}px`;
}

const repositionLangMenu = (): void => {
  if (langMenu?.matches(":popover-open")) placeLangMenu();
};
langMenu?.addEventListener("beforetoggle", (event) => {
  if ((event as ToggleEvent).newState === "open") placeLangMenu();
});
langMenu?.addEventListener("toggle", () => {
  if (langMenu.matches(":popover-open")) requestAnimationFrame(placeLangMenu);
});
langButton?.addEventListener("click", () => requestAnimationFrame(repositionLangMenu));
addEventListener("resize", repositionLangMenu, { passive: true });

/* The language popover is anchored to a button inside a sticky header, so it
   follows the header while the page scrolls. */
addEventListener(
  "scroll",
  () => {
    repositionLangMenu();
  },
  { passive: true },
);

/* Copy-to-clipboard for the install command in the footer. */
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  button.addEventListener("click", async () => {
    const text = button.dataset.copy ?? "";
    try {
      await navigator.clipboard.writeText(text);
      button.dataset.copied = "true";
      window.setTimeout(() => {
        delete button.dataset.copied;
      }, 1600);
    } catch {
      // Clipboard access can be denied; the command stays selectable.
    }
  });
}

syncUi();