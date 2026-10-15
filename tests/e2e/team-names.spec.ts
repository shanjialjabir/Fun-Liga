import { test, expect } from "@playwright/test";

test("mobile team rename updates live competition labels and preserves match data", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "rename-owner@example.test", name: "Owner" },
  });
  let c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Rename live team",
        format: "group_stage",
        groups: 2,
        meetings: 1,
        visibility: "public",
        teamNames: ["Garuda", "Elang", "Singa", "Rajawali"],
      },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  const command = async (data: Record<string, unknown>) => {
    const response = await page.request.patch(path, {
      data: { ...data, version: c.version },
    });
    expect(response.status()).toBe(200);
    c = await response.json();
  };
  await command({ type: "publish" });
  await command({
    type: "goal_add",
    matchId: c.matches[0].id,
    matchVersion: c.matches[0].version,
    teamId: c.matches[0].home,
    scorerName: "Andi",
    assistName: "Budi",
  });
  const before = structuredClone(c);
  const teamIndex = c.teams.findIndex(
    (t: { id: string }) => t.id === c.matches[0].home,
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const spectator = await context.newPage();
  await spectator.goto(`/c/${c.slug}/standings`);
  await page.goto(`/dashboard/competitions/${c.id}/teams`);
  await page
    .getByRole("button", { name: "Edit nama tim", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tambah tim", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Hapus tim/ })).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page
    .getByLabel(`Edit nama tim ${teamIndex + 1}`, { exact: true })
    .fill("Garuda Nusantara FC");
  expect(
    await page
      .getByLabel(`Edit nama tim ${teamIndex + 1}`, { exact: true })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await page.screenshot({ path: "test-results/edit-team-mobile.png" });
  await page
    .getByRole("button", { name: "Simpan nama tim", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Garuda Nusantara FC", exact: true }),
  ).toBeVisible();
  c = await (await page.request.get(path)).json();
  expect(c.matches).toEqual(before.matches);
  expect(c.players).toEqual(before.players);
  expect(c.teams[teamIndex]).toEqual({
    ...before.teams[teamIndex],
    name: "Garuda Nusantara FC",
  });
  await expect(
    spectator
      .locator(".standings-table")
      .filter({ hasText: "Garuda Nusantara FC" }),
  ).toContainText("Garuda Nusantara FC", { timeout: 10000 });
  await expect(spectator.locator(".player-leader-panel").first()).toContainText(
    "Garuda Nusantara FC",
  );
  await page
    .getByRole("button", { name: "Edit nama tim", exact: true })
    .click();
  await page
    .getByLabel(`Edit nama tim ${teamIndex + 1}`, { exact: true })
    .fill("Tidak disimpan");
  await page.getByRole("button", { name: "Batal edit", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Garuda Nusantara FC", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/renamed-team-mobile.png" });
  await page.goto(`/dashboard/competitions/${c.id}/fixtures`);
  await expect(page.locator(".fixture-row").first()).toContainText(
    "Garuda Nusantara FC",
  );
  await spectator.goto(`/c/${c.slug}/teams`);
  await expect(
    spectator.getByRole("button", { name: "Edit nama tim", exact: true }),
  ).toHaveCount(0);
  await context.close();
});
