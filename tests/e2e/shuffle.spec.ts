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
  await expect(page.locator(".fixture-round").first()).toHaveText(
    "Grup A · Putaran 1",
  );
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
  await expect(
    page.locator(".shuffle-preview-list small").first(),
  ).toContainText("Putaran 1");
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
    applied.matches.map((m: { group: string; meeting: number }) => [
      m.group,
      m.meeting,
    ]),
  ).toEqual(
    c.matches.map((m: { group: string; meeting: number }) => [
      m.group,
      m.meeting,
    ]),
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

test("league halves use season labels, mirror pairing order by default and save independent choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "season-ui@example.test", name: "Season Owner" },
  });
  const c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Two halves",
        format: "league",
        meetings: 2,
        teamNames: Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`),
      },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  await page.goto(`/dashboard/competitions/${c.id}/fixtures`);
  await expect(page.locator(".fixture-row")).toHaveCount(56);
  await expect(page.locator(".fixture-round").nth(27)).toHaveText("Putaran 1");
  await expect(page.locator(".fixture-round").nth(28)).toHaveText("Putaran 2");
  await expect(page.locator(".fixture-round").last()).toHaveText("Putaran 2");
  const apply = async () => {
    for (
      let i = 0;
      i < 12 &&
      (await page
        .getByRole("button", { name: "Terapkan jadwal acak" })
        .isDisabled());
      i++
    )
      await page
        .getByRole("button", { name: "Acak ulang", exact: true })
        .click();
    await expect(
      page.getByRole("button", { name: "Terapkan jadwal acak" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Terapkan jadwal acak" }).click();
    await expect(
      page.getByRole("heading", { name: "Tinjau hasil acak jadwal" }),
    ).toHaveCount(0);
    return (await page.request.get(path)).json();
  };
  await page.getByRole("button", { name: "Acak jadwal", exact: true }).click();
  await expect(page.getByLabel("Urutan antarputaran")).toHaveValue("mirror");
  await expect(page.locator(".shuffle-preview-list small").nth(28)).toHaveText(
    "Putaran 2",
  );
  const mirrored = await apply();
  expect(mirrored.rules.mirrorMeetings).toBe(true);
  for (let i = 0; i < 28; i++) {
    expect(mirrored.matches[i + 28].home).toBe(mirrored.matches[i].away);
    expect(mirrored.matches[i + 28].away).toBe(mirrored.matches[i].home);
  }
  await page.getByRole("button", { name: "Acak jadwal", exact: true }).click();
  await page.getByLabel("Urutan antarputaran").selectOption("independent");
  await page.screenshot({ path: "test-results/season-drawing-mobile.png" });
  const independent = await apply();
  expect(independent.rules.mirrorMeetings).toBe(false);
  expect(
    independent.matches
      .slice(0, 28)
      .every((m: { meeting: number }) => m.meeting === 1),
  ).toBe(true);
  expect(
    independent.matches
      .slice(28)
      .every((m: { meeting: number }) => m.meeting === 2),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Acak jadwal", exact: true }).click();
  await expect(page.getByLabel("Urutan antarputaran")).toHaveValue(
    "independent",
  );
  await page.getByRole("button", { name: "Batal", exact: true }).click();
});
