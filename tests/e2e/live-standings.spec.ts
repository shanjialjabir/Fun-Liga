import { test, expect } from "@playwright/test";
test("spectator standings follow live goals, ranking changes and finalization without refreshing", async ({
  page,
  browser,
}) => {
  await page.request.post("/api/demo-login", {
    data: { email: "live-table-owner@example.test", name: "Live Owner" },
  });
  let c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Live league table",
        format: "league",
        meetings: 1,
        visibility: "public",
        teamNames: ["Live A", "Live B", "Live C", "Live D"],
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
  const id = c.matches[0].id;
  const home = c.teams.find(
    (t: { id: string }) => t.id === c.matches[0].home,
  ).name;
  const away = c.teams.find(
    (t: { id: string }) => t.id === c.matches[0].away,
  ).name;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const spectator = await context.newPage();
  await spectator.goto(`/c/${c.slug}/standings`);
  const row = (name: string) =>
    spectator.locator(".standings-table tbody tr").filter({ hasText: name });
  await expect(row(home).locator(".points")).toHaveText("0");
  const goal = async (side: "home" | "away") => {
    const m = c.matches.find((m: { id: string }) => m.id === id);
    await command({
      type: "goal_add",
      matchId: id,
      matchVersion: m.version,
      teamId: m[side],
      scorerName: `Scorer ${side}`,
    });
  };
  await goal("home");
  await expect(row(home).locator(".points")).toHaveText("3", {
    timeout: 10000,
  });
  await expect(
    spectator.getByText("LIVE · Klasemen sementara", { exact: true }),
  ).toBeVisible();
  await goal("away");
  await expect(row(home).locator(".points")).toHaveText("1", {
    timeout: 10000,
  });
  await expect(row(away).locator(".points")).toHaveText("1");
  await goal("away");
  await expect(row(away).locator(".points")).toHaveText("3", {
    timeout: 10000,
  });
  await expect(
    spectator.locator(".standings-table tbody tr").first(),
  ).toContainText(away);
  await spectator.screenshot({
    path: "test-results/live-standings-mobile.png",
  });
  const m = c.matches.find((m: { id: string }) => m.id === id);
  await command({
    type: "finalize",
    matchId: id,
    matchVersion: m.version,
    homeScore: 1,
    awayScore: 2,
    confirm: true,
  });
  await expect(
    spectator.getByText("LIVE · Klasemen sementara", { exact: true }),
  ).toHaveCount(0, { timeout: 10000 });
  await expect(row(away).locator(".points")).toHaveText("3");
  await expect(row(away).locator("td").nth(2)).toHaveText("1");
  expect(
    await spectator.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
