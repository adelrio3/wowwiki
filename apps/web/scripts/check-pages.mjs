// Renders every page with mock data in both themes and two widths, saves
// screenshots, and audits text contrast against WCAG AA. Exits non-zero on
// any failure. Run: node apps/web/scripts/check-pages.mjs (needs the dev
// server: COMPENDIUM_MOCK=1 pnpm dev --port 5173)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = process.env.SHOTS_DIR ?? "/tmp/claude-0/-home-user-wowwiki/86a64ee4-0607-5687-b424-652937e851aa/scratchpad/shots";
mkdirSync(OUT, { recursive: true });

const PAGES = ["/", "/wiki", "/wiki?q=wolf", "/wiki/era/creature/2995", "/wiki/era/creature/2955", "/wiki/era/zone/1412", "/journal?mockUser=1", "/journal/c1?mockUser=1", "/sync?mockUser=1", "/account?mockUser=1", "/auth", "/wiki/era/creature/999999"];
const THEMES = ["light", "dark"];
const WIDTHS = [1280, 390];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
let failures = 0;
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const page = await ctx.newPage();
    for (const path of PAGES) {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      const name = `${theme}-${width}-${path.replace(/[^a-z0-9]+/gi, "_") || "home"}`;
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      const problems = await page.evaluate(() => {
        const toRgb = (s) => {
          const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
          return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
        };
        const lum = ({ r, g, b }) => {
          const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
        const bgOf = (el) => {
          let node = el;
          let acc = null;
          while (node && node !== document.documentElement) {
            const c = toRgb(getComputedStyle(node).backgroundColor);
            if (c && c.a > 0) acc = acc ? blend(acc, c) : c;
            if (acc && acc.a >= 1) return acc;
            node = node.parentElement;
          }
          const root = toRgb(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
          return acc ? blend(acc, root) : root;
        };
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        let n;
        while ((n = walker.nextNode())) {
          const text = n.textContent.trim();
          if (!text) continue;
          const el = n.parentElement;
          if (!el || seen.has(el)) continue;
          seen.add(el);
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none" || el.closest("[aria-hidden=true]") || el.closest("svg")) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const fg = toRgb(cs.color);
          if (!fg) continue;
          const bg = bgOf(el);
          const fgb = fg.a < 1 ? blend(fg, bg) : fg;
          const L1 = lum(fgb), L2 = lum(bg);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(cs.fontSize);
          const bold = parseInt(cs.fontWeight, 10) >= 600;
          const large = size >= 24 || (size >= 18.66 && bold);
          const need = large ? 3 : 4.5;
          if (ratio < need) out.push({ text: text.slice(0, 40), ratio: +ratio.toFixed(2), need, color: cs.color, bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`, tag: el.tagName.toLowerCase(), cls: el.className?.toString().slice(0, 60) });
        }
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        return { out, overflow, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
      });
      const status = res?.status();
      const label = `${theme} ${width} ${path} (${status})`;
      if (problems.out.length || problems.overflow) {
        failures += problems.out.length + (problems.overflow ? 1 : 0);
        console.log(`FAIL ${label}`);
        if (problems.overflow) console.log(`  horizontal overflow: ${problems.scrollWidth} > ${problems.clientWidth}`);
        for (const p of problems.out) console.log(`  ${p.ratio} < ${p.need}: <${p.tag} class="${p.cls}"> "${p.text}" ${p.color} on ${p.bg}`);
      } else {
        console.log(`ok   ${label}`);
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `\n${failures} problem(s)` : "\nall pages pass contrast and width checks");
process.exit(failures ? 1 : 0);
