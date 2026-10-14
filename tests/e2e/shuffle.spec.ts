import { test, expect } from "@playwright/test";
test("compact match list, opt-in ordering, drawing preview, cancel/apply and stale confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "shuffle-ui@example.test", name: "Drawing Owner" },
  });
  const c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Drawing Mobile",
        format: "group_stage",
        groups: 4,
        meetings: 1,
        teamNames: Array.from({ length: 16 }, (_, i) => `Team ${i + 1}`),
      },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  const snapshot = async () => (await page.request.get(path)).json();
  await page.goto(`/dashboard/competitions/${c.id}/fixtures`);
  await expect(page.locator(".fixture-row")).toHaveCount(24);
  await expect(
    page.getByRole("button", { name: "Optimalkan jeda" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Turunkan pertandingan 1", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ketuk pertandingan untuk catat gol.", { exact: true }),
  ).toHaveCount(1);
  const height = await page
    .locator(".fixture-row")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(90);
  expect(height).toBeLessThanOrEqual(120);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".fixture-row")
    .first()
    .evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 80));
  await page.screenshot({ path: "test-results/compact-schedule-mobile.png" });
  await page.getByRole("button", { name: "Atur urutan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Turunkan pertandingan 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Selesai mengatur", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Turunkan pertandingan 1", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Acak jadwal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tinjau hasil acak jadwal" }),
  ).toBeVisible();
  expect((await snapshot()).matches.map((m: { id: string }) => m.id)).toEqual(
    c.matches.map((m: { id: string }) => m.id),
  );
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  expect((await snapshot()).version).toBe(c.version);
  await page.getByRole("button", { name: "Acak jadwal", exact: true }).click();
  for (
    let attempt = 0;
    attempt < 12 &&
    (await page
      .getByRole("button", { name: "Terapkan jadwal acak" })
      .isDisabled());
    attempt++
  )
    await page.getByRole("button", { name: "Acak ulang", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Terapkan jadwal acak" }),
  ).toBeEnabled();
  await page.screenshot({ path: "test-results/drawing-preview-mobile.png" });
  await page.getByRole("button", { name: "Terapkan jadwal acak" }).click();
  await expect(
    page.getByRole("heading", { name: "Tinjau hasil acak jadwal" }),
  ).toHaveCount(0);
  const applied = await snapshot();
  expect(applied.matches.map((m: { id: string }) => m.id)).not.toEqual(
    c.matches.map((m: { id: string }) => m.id),
  );
  expect(
    applied.matches.map((m: { group: string; round: number }) => [
      m.group,
      m.round,
    ]),
  ).toEqual(
    c.matches.map((m: { group: string; round: number }) => [m.group, m.round]),
  );
  expect(applied.audit.at(-1).event).toBe("shuffle_schedule");
  await page.getByRole("button", { name: "Acak jadwal", exact: true }).click();
  await page.request.patch(path, {
    data: {
      type: "settings",
      version: applied.version,
      settings: {
        name: c.name,
        description: "Concurrent change",
        venue: "",
        visibility: "public",
      },
    },
  });
  await expect(
    page.getByText(
      "Jadwal telah berubah. Buat hasil acak baru sebelum menyimpan.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "Terapkan jadwal acak" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await page.reload();
  await expect(page.locator(".fixture-row")).toHaveCount(24);
});
