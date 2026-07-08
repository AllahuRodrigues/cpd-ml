import { chromium } from "playwright";

const base = "http://localhost:3000";
const outDir = "/private/tmp/claude-501/-Users-allahurodrigues-Desktop-undp-work-doc-cpd-ai/4c293891-45fc-4529-81df-9d606865daa4/scratchpad/cpd/shots";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

async function shot(path, name) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log("shot:", name, "url:", path);
}

await shot("/", "01-overview");
await shot("/inventory", "02-inventory");
await shot("/matrix", "03-matrix");

// click a cell in the matrix to test navigation to evidence
await page.goto(`${base}/matrix`, { waitUntil: "networkidle" });
const firstCell = page.locator("table tbody tr:first-child td a").first();
await firstCell.click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${outDir}/04-evidence-from-click.png`, fullPage: true });
console.log("navigated to:", page.url());

await shot("/linkage", "05-linkage");
await shot("/review", "06-review");

// test evidence filters
await page.goto(`${base}/evidence`, { waitUntil: "networkidle" });
await page.selectOption("select >> nth=0", { label: "Afghanistan CPD - 2024 - 2027" }).catch(async () => {
  const opts = await page.locator("select >> nth=0 option").allTextContents();
  console.log("country options sample:", opts.slice(0, 5));
});
await page.screenshot({ path: `${outDir}/07-evidence-country-filter.png`, fullPage: true });

console.log("CONSOLE ERRORS:", JSON.stringify(errors));
await browser.close();
