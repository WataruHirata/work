import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.BROWSER_CHECK_BASE_URL || "http://localhost:3000";
const email =
  process.env.BROWSER_CHECK_EMAIL ||
  `minoriya-demo+product_office@${process.env.DEMO_EMAIL_DOMAIN || "example.invalid"}`;
const password = process.env.BROWSER_CHECK_PASSWORD || process.env.DEMO_INITIAL_PASSWORD;
if (!password) throw new Error("BROWSER_CHECK_PASSWORD または DEMO_INITIAL_PASSWORD が必要です。");

const executablePath = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find(existsSync);
if (!executablePath) throw new Error("検証に使用できるEdgeまたはChromeが見つかりません。");

const artifactDir = join(process.cwd(), ".local", "browser-check");
mkdirSync(artifactDir, { recursive: true });
const consoleErrors = [];
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const context = await browser.newContext({ locale: "ja-JP", timezoneId: "Asia/Tokyo" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message.slice(0, 500)));

  await page.goto(`${baseUrl}/login?next=%2Fadmin%2Fcampaigns`, {
    waitUntil: "domcontentloaded",
  });
  if (new URL(page.url()).pathname === "/login") {
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await page
      .waitForURL((url) => url.pathname !== "/login", { timeout: 20_000 })
      .catch(() => undefined);
    if (new URL(page.url()).pathname === "/login") {
      const message =
        (
          await page
            .locator('[role="alert"]')
            .first()
            .textContent()
            .catch(() => null)
        )?.trim() || "ログイン後の遷移を確認できませんでした。";
      await page.screenshot({ path: join(artifactDir, "login-failed.png"), fullPage: true });
      throw new Error(`デモアカウントでログインできません: ${message}`);
    }
  }

  await page.goto(`${baseUrl}/admin/campaigns`, { waitUntil: "networkidle" });
  const result = {
    checkedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    heading: (await page.locator("h1").first().textContent())?.trim() || null,
    hasCampaignForm: await page.getByText("POS・商品値札の変更依頼を作成").isVisible(),
    hasLoadError: await page.getByText("特売情報を読み込めませんでした").isVisible(),
    consoleErrors,
  };
  await page.screenshot({
    path: join(artifactDir, "admin-campaigns.png"),
    fullPage: true,
  });
  writeFileSync(join(artifactDir, "admin-campaigns.json"), JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.hasCampaignForm || result.hasLoadError || consoleErrors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
