import { test, expect } from "@playwright/test";

test("tap match, autocomplete scorer and assist, own goal, edit/delete, final statistics and spectator details", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "goal-ui-owner@example.test", name: "Goal Owner" },
  });
  let c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Gol dan assist E2E",
        format: "fourfeo",
        visibility: "public",
        teamNames: ["Garuda Goal", "Elang Goal", "Singa Goal", "Rajawali Goal"],
      },
    })
  ).json();
  c = await (
    await page.request.patch(`/api/competitions/${c.id}`, {
      data: { type: "publish", version: c.version },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  const m = c.matches[0];
  const homeName = c.teams.find((t: { id: string }) => t.id === m.home).name;
  const awayName = c.teams.find((t: { id: string }) => t.id === m.away).name;
  const snapshot = async () => (await page.request.get(path)).json();
  const open = async () => {
    await page.goto(`/dashboard/competitions/${c.id}/fixtures`);
    await page
      .locator(".fixture-row")
      .first()
      .locator(".fixture-score")
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  };
  const add = async (team = homeName) =>
    page.getByRole("button", { name: `Gol ${team}`, exact: true }).click();
  const save = async () => {
    await page.getByRole("button", { name: "Simpan gol", exact: true }).click();
    await expect(page.getByLabel("Menit (opsional)")).toHaveCount(0);
  };
  await open();
  await add();
  await page
    .getByLabel("Pencetak gol (opsional)", { exact: true })
    .fill("Andi Saputra");
  await page.getByLabel("Assist (opsional)").fill("Budi Santoso");
  await page.getByLabel("Menit (opsional)").fill("5");
  await page.screenshot({ path: "test-results/goal-form-mobile.png" });
  await save();
  expect((await snapshot()).matches[0]).toMatchObject({
    homeScore: 1,
    awayScore: 0,
    status: "live",
  });
  await add();
  await page.getByLabel("Pencetak gol (opsional)", { exact: true }).fill("an");
  await expect(
    page.getByRole("option", { name: /Andi Saputra/ }),
  ).toBeVisible();
  await page.getByRole("option", { name: /Andi Saputra/ }).click();
  await page.getByLabel("Assist (opsional)").fill("bu");
  await page.getByRole("option", { name: /Budi Santoso/ }).click();
  await page.getByLabel("Menit (opsional)").fill("13");
  await save();
  expect((await snapshot()).players).toHaveLength(2);
  expect((await snapshot()).matches[0].homeScore).toBe(2);
  await add(awayName);
  await page
    .getByRole("button", { name: "Gol bunuh diri", exact: true })
    .click();
  await page
    .getByLabel("Pemain gol bunuh diri (opsional)")
    .fill("Rian Pratama");
  await expect(page.getByLabel("Assist (opsional)")).toHaveCount(0);
  await save();
  expect((await snapshot()).matches[0].homeScore).toBe(3);
  await page
    .getByRole("button", { name: "Edit gol Andi Saputra", exact: true })
    .first()
    .click();
  await page.getByLabel("Assist (opsional)").fill("Dani");
  await page
    .getByRole("button", { name: "Simpan perubahan gol", exact: true })
    .click();
  await expect(page.getByLabel("Menit (opsional)")).toHaveCount(0);
  expect((await snapshot()).matches[0].homeScore).toBe(3);
  await page
    .getByRole("button", { name: "Hapus gol Rian Pratama", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Konfirmasi hapus gol", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hapus gol Rian Pratama" }),
  ).toHaveCount(0);
  expect((await snapshot()).matches[0].homeScore).toBe(2);
  await page
    .getByRole("button", { name: "Tinjau hasil final", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Konfirmasi & simpan", exact: true })
    .click();
  await expect
    .poll(async () => (await snapshot()).matches[0].status)
    .toBe("final");
  await page.getByRole("button", { name: "Tutup dialog" }).click();
  await page.goto(`/dashboard/competitions/${c.id}/players`);
  await expect(
    page.getByRole("heading", { name: "Top skor", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".player-leader-panel").first().locator(".player-leader-row"),
  ).toHaveText(/Andi Saputra.*2/);
  await expect(
    page.locator(".player-leader-panel").nth(1).locator(".player-leader-row"),
  ).toHaveCount(2);
  await open();
  await page
    .getByRole("button", { name: "Edit gol Andi Saputra", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Pencetak gol (opsional)", { exact: true })
    .fill("BUDI SANTOSO");
  await page.getByLabel("Assist (opsional)").fill("Andi Saputra");
  await expect(
    page.getByRole("button", { name: "Simpan perubahan gol", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Alasan koreksi gol")
    .fill("Wasit membetulkan pencetak gol");
  await page
    .getByLabel("Saya mengonfirmasi koreksi hasil final dan statistik pemain.")
    .check();
  await page
    .getByRole("button", { name: "Simpan perubahan gol", exact: true })
    .click();
  await expect(page.getByLabel("Menit (opsional)")).toHaveCount(0);
  const corrected = await snapshot();
  expect(corrected.matches[0].homeScore).toBe(2);
  expect(corrected.audit.at(-1)).toMatchObject({
    event: "goal_update",
    reason: "Wasit membetulkan pencetak gol",
  });
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const visitor = await guest.newPage();
    await visitor.goto(`/c/${c.slug}/fixtures`);
    await visitor
      .locator(".fixture-row")
      .first()
      .locator(".fixture-score")
      .click();
    await expect(
      visitor.getByRole("heading", {
        name: "Detail pertandingan",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      visitor
        .locator(".goal-timeline")
        .getByText("Budi Santoso", { exact: true }),
    ).toBeVisible();
    await expect(
      visitor.getByRole("button", { name: `Gol ${homeName}`, exact: true }),
    ).toHaveCount(0);
    await visitor.screenshot({
      path: "test-results/goal-details-spectator-mobile.png",
    });
    await visitor.getByRole("button", { name: "Tutup dialog" }).click();
    await visitor.goto(`/c/${c.slug}/players`);
    await expect(
      visitor
        .locator(".player-leader-panel")
        .first()
        .locator(".player-leader-row"),
    ).toHaveCount(2);
    await visitor.reload();
    await expect(
      visitor
        .locator(".player-leader-panel")
        .first()
        .locator(".player-leader-row"),
    ).toHaveCount(2);
    expect(
      await visitor.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await guest.close();
  }
});
