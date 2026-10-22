import { test, expect } from "@playwright/test";

test("any recipient opens an invitation without an account; shared role, score entry, scope and revocation", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "sanjifile@gmail.com", name: "Main Admin" },
  });
  const accountsBefore = await (
    await page.request.get("/api/admin/accounts")
  ).json();
  let c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Account-free private tournament",
        format: "fourfeo",
        visibility: "private",
        teamNames: ["Garuda", "Elang", "Singa", "Rajawali"],
      },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  c = await (
    await page.request.patch(path, {
      data: { type: "publish", version: c.version },
    })
  ).json();
  const other = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Other private tournament",
        format: "fourfeo",
        visibility: "private",
        teamNames: ["A", "B", "C", "D"],
      },
    })
  ).json();
  await page.goto(`/dashboard/competitions/${c.id}/members`);
  await page
    .getByLabel("Nama akses (opsional)", { exact: true })
    .fill("Operator lapangan 1");
  await page
    .getByRole("button", { name: "Buat tautan undangan", exact: true })
    .click();
  const link = await page
    .getByLabel("Tautan undangan", { exact: true })
    .inputValue();
  await expect(
    page.getByText("Operator lapangan 1", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Berlaku sampai akses dicabut/)).toBeVisible();
  await expect(page.getByText(/72 jam/)).toHaveCount(0);
  c = await (await page.request.get(path)).json();
  expect(JSON.stringify(c)).not.toContain("tokenHash");
  const first = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const guest = await first.newPage();
  expect((await first.request.get(path)).status()).toBe(404);
  const landing = await guest.goto(link);
  expect(landing?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(guest).toHaveURL(
    new RegExp(`/dashboard/competitions/${c.id}/fixtures$`),
  );
  const session = await (await first.request.get("/api/session")).json();
  expect(session.user).toMatchObject({
    guest: true,
    competitionId: c.id,
    role: "score_operator",
    name: "Operator lapangan 1",
    expiresAt: null,
  });
  expect(
    (await first.cookies()).find((cookie) => cookie.name === "fms_committee"),
  ).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(
    (await first.cookies()).find((cookie) => cookie.name === "fms_committee")!
      .expires,
  ).toBeGreaterThan(Date.now() / 1000 + 300 * 86400);
  // Existing short-lived browser cookies are renewed after resolving a valid grant.
  const cookie = (await first.cookies()).find(
    (cookie) => cookie.name === "fms_committee",
  )!;
  await first.addCookies([{ ...cookie, expires: Date.now() / 1000 + 60 }]);
  await first.request.get("/api/session");
  expect(
    (await first.cookies()).find((cookie) => cookie.name === "fms_committee")!
      .expires,
  ).toBeGreaterThan(Date.now() / 1000 + 300 * 86400);
  await expect(
    guest.getByRole("link", { name: "Panitia", exact: true }),
  ).toHaveCount(0);
  await expect(
    guest.getByRole("link", { name: "Pengaturan", exact: true }),
  ).toHaveCount(0);
  expect(
    (await first.request.get(`/api/competitions/${other.id}`)).status(),
  ).toBe(404);
  expect((await first.request.get("/api/admin/accounts")).status()).toBe(403);
  expect(
    (
      await first.request.post("/api/competitions", {
        data: {
          name: "Guest new",
          format: "fourfeo",
          teamNames: ["A", "B", "C", "D"],
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await first.request.post(`${path}/invites`, {
        data: { mode: "link", role: "admin" },
      })
    ).status(),
  ).toBe(403);
  await guest.locator(".fixture-row").first().locator(".fixture-score").click();
  const home = c.teams.find(
    (t: { id: string }) => t.id === c.matches[0].home,
  ).name;
  await guest.getByRole("button", { name: `Gol ${home}`, exact: true }).click();
  await guest
    .getByLabel("Pencetak gol (opsional)", { exact: true })
    .fill("Pemain panitia");
  await guest.getByRole("button", { name: "Simpan gol", exact: true }).click();
  await expect(
    guest.getByLabel("Pencetak gol (opsional)", { exact: true }),
  ).toHaveCount(0);
  c = await (await page.request.get(path)).json();
  expect(c.matches[0].homeScore).toBe(1);
  await guest.screenshot({
    path: "test-results/account-free-score-mobile.png",
  });
  await guest.reload();
  await expect(guest.locator(".fixture-row")).toHaveCount(12);
  const second = await browser.newContext();
  const guest2 = await second.newPage();
  await guest2.goto(link);
  await expect(guest2).toHaveURL(
    new RegExp(`/dashboard/competitions/${c.id}/fixtures$`),
  );
  expect(
    (await (await second.request.get("/api/session")).json()).user.id,
  ).toBe(session.user.id);
  expect(await (await page.request.get("/api/admin/accounts")).json()).toEqual(
    accountsBefore,
  );
  expect(c.members).toHaveLength(1);
  await page.reload();
  await page.screenshot({ path: "test-results/committee-links-mobile.png" });
  await page
    .getByRole("button", { name: "Cabut akses tautan", exact: true })
    .click();
  await expect(
    page.getByText("Operator lapangan 1", { exact: true }),
  ).toHaveCount(0);
  expect((await first.request.get(path)).status()).toBe(404);
  expect((await second.request.get("/api/session")).status()).toBe(200);
  expect(
    (await (await second.request.get("/api/session")).json()).user,
  ).toBeNull();
  await guest2.goto(link);
  await expect(
    guest2.getByRole("heading", { name: "Tautan panitia tidak tersedia" }),
  ).toBeVisible();
  await first.close();
  await second.close();
});

test("admin guest can manage the invited competition; legacy unused link activates without login and logout clears access", async ({
  page,
  browser,
}) => {
  await page.request.post("/api/demo-login", {
    data: { email: "guest-admin-owner@example.test", name: "Owner" },
  });
  let c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Legacy guest admin",
        format: "fourfeo",
        visibility: "private",
        teamNames: ["A", "B", "C", "D"],
      },
    })
  ).json();
  const path = `/api/competitions/${c.id}`;
  const invite = await (
    await page.request.post(`${path}/invites`, {
      data: { role: "admin", email: "legacy@example.test" },
    })
  ).json();
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(`/invite/${invite.token}`);
  await expect(guest).toHaveURL(
    new RegExp(`/dashboard/competitions/${c.id}/overview$`),
  );
  await expect(
    guest.getByRole("link", { name: "Panitia", exact: true }),
  ).toBeVisible();
  await expect(
    guest.getByRole("link", { name: "Pengaturan", exact: true }),
  ).toBeVisible();
  c = await (await page.request.get(path)).json();
  expect(
    (
      await context.request.patch(path, {
        data: {
          type: "settings",
          version: c.version,
          settings: {
            name: c.name,
            venue: "",
            description: "Guest admin updated",
            visibility: "private",
          },
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await context.request.post(`${path}/invites`, {
        data: { mode: "link", role: "admin" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.delete(path, {
        data: { name: c.name, version: c.version + 1 },
      })
    ).status(),
  ).toBe(403);
  await guest.goto("/account");
  await expect(
    guest.getByRole("heading", { name: "Akses panitia", exact: true }),
  ).toBeVisible();
  await expect(
    guest.getByRole("button", { name: "Simpan profil", exact: true }),
  ).toHaveCount(0);
  await guest
    .getByRole("button", { name: "Keluar dari akses tautan", exact: true })
    .click();
  await expect(guest).toHaveURL("/");
  expect(
    (await (await context.request.get("/api/session")).json()).user,
  ).toBeNull();
  await guest.goto(`/invite/${invite.token}`);
  await expect(guest).toHaveURL(
    new RegExp(`/dashboard/competitions/${c.id}/overview$`),
  );
  await context.close();
});
