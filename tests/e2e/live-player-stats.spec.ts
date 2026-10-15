import { test, expect } from "@playwright/test";
test("optional scorer, anonymous goal, live scorer/assist updates, edit and deletion reach spectators without reload", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "optional-goal-owner@example.test", name: "Owner" },
  });
  let c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Live player statistics",
        format: "league",
        meetings: 1,
        visibility: "public",
        teamNames: ["Stats A", "Stats B", "Stats C", "Stats D"],
      },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  c = await (
    await page.request.patch(path, {
      data: { type: "publish", version: c.version },
    })
  ).json();
  const home = c.teams.find(
    (t: { id: string }) => t.id === c.matches[0].home,
  ).name;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const viewer = await context.newPage();
  await viewer.goto(`/c/${c.slug}/standings`);
  await expect(viewer.locator(".standings-table")).toBeVisible();
  await expect(
    viewer.getByRole("heading", { name: "Top skor & assist", exact: true }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("link", { name: "Top skor & assist", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/dashboard/competitions/${c.id}/fixtures`);
  await page.locator(".fixture-row").first().locator(".fixture-score").click();
  await page.getByRole("button", { name: `Gol ${home}`, exact: true }).click();
  await expect(
    page.getByLabel("Pencetak gol (opsional)", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Simpan gol", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Simpan gol", exact: true }).click();
  await expect(
    page.getByText("Pencetak gol belum diisi", { exact: true }),
  ).toBeVisible();
  c = await (await page.request.get(path)).json();
  expect(c.matches[0].homeScore).toBe(1);
  expect(c.players ?? []).toHaveLength(0);
  await expect(
    viewer.getByText(/1 gol belum memiliki nama pencetak gol/),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    viewer.getByText("LIVE · Statistik pemain sementara", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit gol tanpa nama", exact: true })
    .click();
  await page
    .getByLabel("Pencetak gol (opsional)", { exact: true })
    .fill("Andi Statistik");
  await page
    .getByLabel("Assist (opsional)", { exact: true })
    .fill("Budi Statistik");
  await page
    .getByRole("button", { name: "Simpan perubahan gol", exact: true })
    .click();
  const scorers = viewer.locator(".player-leader-panel").first();
  const assists = viewer.locator(".player-leader-panel").nth(1);
  await expect(scorers.locator(".player-leader-row")).toContainText(
    "Andi Statistik",
    { timeout: 10000 },
  );
  await expect(scorers.locator(".player-leader-row strong")).toHaveText("1");
  await expect(assists.locator(".player-leader-row")).toContainText(
    "Budi Statistik",
  );
  c = await (await page.request.get(path)).json();
  expect(c.matches[0].homeScore).toBe(1);
  await viewer.locator(".player-leaders").scrollIntoViewIfNeeded();
  await viewer.screenshot({
    path: "test-results/live-player-statistics-mobile.png",
  });
  await page
    .getByRole("button", { name: "Edit gol Andi Statistik", exact: true })
    .click();
  await page.getByLabel("Pencetak gol (opsional)", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Simpan perubahan gol", exact: true })
    .click();
  await expect(scorers.locator(".player-leader-row")).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(assists.locator(".player-leader-row strong")).toHaveText("1");
  await page
    .getByRole("button", { name: "Hapus gol tanpa nama", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Konfirmasi hapus gol", exact: true })
    .click();
  await expect(assists.locator(".player-leader-row")).toHaveCount(0, {
    timeout: 10000,
  });
  c = await (await page.request.get(path)).json();
  expect(c.matches[0].homeScore).toBe(0);
  expect(
    await viewer.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await viewer.goto(`/c/${c.slug}/players`);
  await expect(
    viewer.getByRole("heading", { name: "Top skor & assist", exact: true }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("link", { name: "Klasemen", exact: true }),
  ).toHaveClass(/active/);
  await context.close();
});
