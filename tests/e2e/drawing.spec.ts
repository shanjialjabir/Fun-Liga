import { test, expect } from "@playwright/test";
test("mobile group and knockout drawing: preview, shuffle, manual assignment, persistence and played lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "drawing-ui@example.test", name: "Drawing Owner" },
  });
  let c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Drawing real life",
        format: "group_then_knockout",
        groups: 2,
        qualifiers: 2,
        meetings: 1,
        teamNames: Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`),
      },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  const snapshot = async () => (await page.request.get(path)).json();
  const command = async (data: Record<string, unknown>) => {
    const response = await page.request.patch(path, {
      data: { ...data, version: c.version },
    });
    expect(response.status()).toBe(200);
    c = await response.json();
  };
  await page.goto(`/dashboard/competitions/${c.id}/teams`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Drawing grup", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Terapkan grup & buat ulang jadwal" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Acak grup", exact: true }).click();
  expect((await snapshot()).version).toBe(c.version);
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await page.getByRole("button", { name: "Drawing grup", exact: true }).click();
  const a = c.teams.find((t: { group: string }) => t.group === "A");
  const b = c.teams.find((t: { group: string }) => t.group === "B");
  await page
    .getByLabel(`Grup untuk ${a.name}`, { exact: true })
    .selectOption("B");
  await page
    .getByLabel(`Grup untuk ${b.name}`, { exact: true })
    .selectOption("A");
  await page.screenshot({ path: "test-results/group-drawing-mobile.png" });
  await page
    .getByRole("button", { name: "Terapkan grup & buat ulang jadwal" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Drawing pembagian grup" }),
  ).toHaveCount(0);
  c = await snapshot();
  expect(c.teams.find((t: { id: string }) => t.id === a.id).group).toBe("B");
  await command({ type: "publish" });
  for (const match of c.matches)
    await command({
      type: "finalize",
      matchId: match.id,
      matchVersion: match.version,
      homeScore: 0,
      awayScore: 0,
      confirm: true,
    });
  await command({
    type: "resolve_tie",
    ids: c.teams.map((t: { id: string }) => t.id),
    reason: "Drawing resmi panitia",
  });
  const groupBefore = structuredClone(c.matches);
  await page.goto(`/dashboard/competitions/${c.id}/bracket`);
  await page
    .getByRole("button", { name: "Drawing bagan gugur", exact: true })
    .click();
  await expect(
    page.getByLabel("Aturan babak awal", { exact: true }),
  ).toHaveValue("avoid");
  await page.getByRole("button", { name: "Acak bagan", exact: true }).click();
  expect((await snapshot()).matches).toEqual(groupBefore);
  await page
    .getByLabel("Aturan babak awal", { exact: true })
    .selectOption("free");
  const fromA = c.teams
    .filter((t: { group: string }) => t.group === "A")
    .slice(0, 2);
  await page
    .getByLabel("Tim pertama pasangan 1", { exact: true })
    .selectOption(fromA[0].id);
  await page
    .getByLabel("Tim kedua pasangan 1", { exact: true })
    .selectOption(fromA[1].id);
  await page
    .getByLabel("Aturan babak awal", { exact: true })
    .selectOption("avoid");
  await expect(
    page.getByText(
      "Babak awal tidak boleh mempertemukan tim dari grup yang sama",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Terapkan drawing bagan" }),
  ).toBeDisabled();
  await page
    .getByLabel("Aturan babak awal", { exact: true })
    .selectOption("free");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/bracket-drawing-mobile.png" });
  await page.getByRole("button", { name: "Terapkan drawing bagan" }).click();
  await expect(
    page.getByRole("heading", { name: "Drawing bagan gugur", exact: true }),
  ).toHaveCount(0);
  c = await snapshot();
  expect(
    c.matches.filter((m: { stage: string }) => m.stage === "group"),
  ).toEqual(groupBefore);
  expect(c.knockoutDrawing.slots.slice(0, 2)).toEqual(
    fromA.map((t: { id: string }) => t.id),
  );
  expect(c.knockoutDrawing.avoidSameGroup).toBe(false);
  await page.reload();
  await page
    .getByRole("button", { name: "Drawing bagan gugur", exact: true })
    .click();
  await expect(
    page.getByLabel("Tim pertama pasangan 1", { exact: true }),
  ).toHaveValue(fromA[0].id);
  await expect(
    page.getByLabel("Aturan babak awal", { exact: true }),
  ).toHaveValue("free");
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  const match = c.matches.find(
    (m: { stage: string }) => m.stage === "knockout",
  );
  await command({
    type: "match_status",
    matchId: match.id,
    matchVersion: match.version,
    status: "live",
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Drawing bagan gugur", exact: true }),
  ).toBeDisabled();
  await page.goto(`/dashboard/competitions/${c.id}/teams`);
  await expect(
    page.getByRole("button", { name: "Drawing grup", exact: true }),
  ).toHaveCount(0);
});
