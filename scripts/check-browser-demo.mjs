import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const html = readFileSync("demo-output/Fun-Mini-Soccer-Demo.html", "utf8");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:32123/")) external.push(r.url());
  });
  // Serve the exact HTML from memory at an isolated origin. No network server is used.
  await page.route("http://127.0.0.1:32123/**", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("http://127.0.0.1:32123/");
  await page.getByRole("heading", { name: "Halo, Pemain." }).waitFor();
  await page
    .locator(".hero")
    .getByRole("button", { name: "Buat kompetisi" })
    .click();
  await page.getByLabel("Nama kompetisi").fill("Demo Tanpa Port");
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("textbox", { name: `Nama tim ${i + 1}`, exact: true })
      .fill(["Merah", "Biru", "Hijau", "Kuning"][i]);
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await page.getByRole("button", { name: "Buat draft & jadwal" }).click();
  await page.locator(".fixture-row").nth(11).waitFor();
  if ((await page.locator(".fixture-row").count()) !== 12)
    throw new Error("Expected 12 fixtures");
  await page.getByRole("button", { name: "Publikasikan", exact: true }).click();
  await page.getByRole("button", { name: "Ya, publikasikan" }).click();
  await page.locator(".draft-banner").waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Kelola pertandingan 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Mulai LIVE" }).click();
  await page
    .getByRole("dialog")
    .getByText("Tersimpan di browser ini")
    .waitFor();
  await page.getByRole("button", { name: "Tambah skor tuan rumah" }).click();
  await page.getByRole("button", { name: "Tambah skor tuan rumah" }).click();
  await page.getByRole("button", { name: "Tambah skor tamu" }).click();
  await page.getByRole("button", { name: "Simpan skor live" }).click();
  await page
    .getByRole("dialog")
    .getByText("Tersimpan di browser ini")
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/fun-browser-demo-control.png" });
  await page.getByRole("button", { name: "Tinjau hasil final" }).click();
  await page.getByRole("button", { name: "Konfirmasi & simpan" }).click();
  await page
    .getByRole("dialog")
    .getByText("Tersimpan di browser ini")
    .waitFor();
  await page.getByRole("button", { name: "Tutup dialog" }).click();
  await page.getByRole("link", { name: "Klasemen", exact: true }).click();
  await page.locator(".points").first().waitFor();
  if (!(await page.locator(".points").allTextContents()).includes("3"))
    throw new Error("Expected winner points");
  await page.reload();
  await page
    .getByRole("heading", { name: "Demo Tanpa Port", exact: true })
    .waitFor();
  await page.locator(".points").first().waitFor();
  if (!(await page.locator(".points").allTextContents()).includes("3"))
    throw new Error("Reload lost results");
  if (errors.length || external.length)
    throw new Error(JSON.stringify({ errors, external }));
  console.log(
    JSON.stringify({
      demo: true,
      fixtures: 12,
      score: "2–1",
      winnerPoints: 3,
      persistence: "verified after reload",
      externalRequests: 0,
      javascriptErrors: 0,
      mobile: true,
    }),
  );
} finally {
  await browser.close();
}
