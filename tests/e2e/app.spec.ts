import { test, expect } from "@playwright/test";

test("owner creates Fourfeo; operator and spectator permissions, scoring, conflict, invitation and archive", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kompetisi Anda. Permainan kita." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Masuk", exact: false })
    .first()
    .click();
  await page.getByLabel("Nama Anda").fill("Panitia Uji");
  await page
    .getByLabel("Email", { exact: true })
    .fill("owner-e2e@example.test");
  await page.getByRole("button", { name: "Masuk & mulai bermain" }).click();
  await expect(
    page.getByRole("heading", { name: "Halo, Panitia." }),
  ).toBeVisible();
  await page.goto("/dashboard/new");
  await page.getByLabel("Nama kompetisi").fill("Fourfeo E2E");
  await page.getByLabel("Lokasi lapangan").fill("Lapangan Pengujian");
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  for (const [i, name] of [
    "Garuda Uji",
    "Elang Uji",
    "Rajawali Uji",
    "Singa Uji",
  ].entries())
    await page
      .getByRole("textbox", { name: `Nama tim ${i + 1}`, exact: true })
      .fill(name);
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await expect(
    page.getByText("Fourfeo · 4 tim · 12 pertandingan"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buat draft & jadwal" }).click();
  await expect(page).toHaveURL(/fixtures/);
  await expect(page.locator(".fixture-row")).toHaveCount(12);
  const cid = page.url().split("/")[5];
  const ownerSnapshot = await page.request.get(`/api/competitions/${cid}`);
  let c = await ownerSnapshot.json();
  expect(c.status).toBe("draft");
  const spectator = await browser.newContext();
  const visitor = await spectator.newPage();
  await visitor.goto("/explore");
  await expect(visitor.getByText("Fourfeo E2E", { exact: true })).toHaveCount(
    0,
  );
  expect(
    (await spectator.request.get(`/api/competitions/${cid}`)).status(),
  ).toBe(404);
  expect(
    (
      await spectator.request.patch(`/api/competitions/${cid}`, {
        data: { type: "publish", version: c.version },
      })
    ).status(),
  ).toBe(404);
  const firstId = c.matches[0].id;
  await page
    .getByRole("button", { name: "Turunkan pertandingan 1", exact: true })
    .click();
  await expect
    .poll(async () => {
      const r = await page.request.get(`/api/competitions/${cid}`);
      return (await r.json()).matches[1].id;
    })
    .toBe(firstId);
  await page.getByRole("button", { name: "Publikasikan", exact: true }).click();
  await page.getByRole("button", { name: "Ya, publikasikan" }).click();
  await expect(page.locator(".draft-banner")).toHaveCount(0);
  c = await (await page.request.get(`/api/competitions/${cid}`)).json();
  await visitor.goto(`/c/${c.slug}`);
  await expect(
    visitor.getByRole("heading", { name: "Fourfeo E2E", exact: true }),
  ).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Kontrol skor" })).toHaveCount(
    0,
  );
  const publicData = await (
    await spectator.request.get(`/api/competitions/${cid}`)
  ).json();
  expect(publicData.members).toEqual([]);
  expect(publicData.audit).toEqual([]);
  await page
    .getByRole("button", { name: "Kelola pertandingan 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Mulai LIVE" }).click();
  await expect(
    page.getByRole("dialog").getByText("Tersimpan di server"),
  ).toBeVisible();
  await page
    .getByText("Skor lama / tanpa catatan pemain", { exact: true })
    .click();
  await page.getByRole("button", { name: "Tambah skor tuan rumah" }).click();
  await page.getByRole("button", { name: "Tambah skor tuan rumah" }).click();
  await page.getByRole("button", { name: "Tambah skor tamu" }).click();
  await page.getByRole("button", { name: "Simpan skor live" }).click();
  await expect(
    page.getByRole("dialog").getByText("Tersimpan di server"),
  ).toBeVisible();
  await expect(visitor.locator(".featured-score strong")).toHaveText("2 : 1", {
    timeout: 10000,
  });
  await expect(visitor.locator(".points")).toHaveText(["0", "0", "0", "0"]);
  await page.getByRole("button", { name: "Tinjau hasil final" }).click();
  await page.getByRole("button", { name: "Konfirmasi & simpan" }).click();
  await expect(
    page.getByRole("dialog").getByText("Tersimpan di server"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tutup dialog" }).click();
  await expect
    .poll(() => visitor.locator(".points").allTextContents(), {
      timeout: 10000,
    })
    .toContain("3");
  await page
    .getByRole("button", { name: "Kelola pertandingan 1", exact: true })
    .click();
  await page
    .getByText("Skor lama / tanpa catatan pemain", { exact: true })
    .click();
  await page.getByRole("button", { name: "Kurangi skor tuan rumah" }).click();
  await page
    .getByLabel("Alasan koreksi")
    .fill("Salah pencatatan skor pengujian");
  await page.getByRole("button", { name: "Tinjau koreksi hasil" }).click();
  await page.getByRole("button", { name: "Konfirmasi & simpan" }).click();
  await expect(
    page.getByRole("dialog").getByText("Tersimpan di server"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tutup dialog" }).click();
  c = await (await page.request.get(`/api/competitions/${cid}`)).json();
  expect(c.audit.at(-1).event).toBe("correct");
  await expect
    .poll(
      async () =>
        (await visitor.locator(".points").allTextContents()).filter(
          (p) => p === "1",
        ).length,
      { timeout: 10000 },
    )
    .toBe(2);
  const stale = c.version - 1;
  expect(
    (
      await page.request.patch(`/api/competitions/${cid}`, {
        data: {
          type: "reorder",
          version: stale,
          ids: c.matches.map((m: { id: string }) => m.id),
        },
      })
    ).status(),
  ).toBe(409);
  await page.goto(`/dashboard/competitions/${cid}/members`);
  await page.getByRole("button", { name: "Buat tautan undangan" }).click();
  const invite = await page.getByLabel("Tautan undangan").inputValue();
  const operator = await browser.newContext();
  const op = await operator.newPage();
  await op.goto(invite.replace("localhost", "127.0.0.1"));
  await op.getByRole("button", { name: "Masuk untuk menerima" }).click();
  await op.getByLabel("Nama Anda").fill("Operator Uji");
  await op
    .getByLabel("Email", { exact: true })
    .fill("operator-e2e@example.test");
  await op.getByRole("button", { name: "Masuk & mulai bermain" }).click();
  await op.getByRole("button", { name: "Terima undangan" }).click();
  await expect(op).toHaveURL(new RegExp(`/dashboard/competitions/${cid}`));
  await expect(
    op.getByRole("link", { name: "Pengaturan", exact: true }),
  ).toHaveCount(0);
  await expect(
    op.getByRole("link", { name: "Panitia", exact: true }),
  ).toHaveCount(0);
  c = await (await page.request.get(`/api/competitions/${cid}`)).json();
  expect(
    (
      await operator.request.patch(`/api/competitions/${cid}`, {
        data: {
          type: "settings",
          version: c.version,
          settings: {
            name: "Hijacked",
            venue: "",
            description: "",
            visibility: "public",
          },
        },
      })
    ).status(),
  ).toBe(403);
  await op.goto(`/dashboard/competitions/${cid}/control`);
  await op
    .getByRole("button", { name: "Kelola pertandingan 2", exact: true })
    .click();
  await op.getByRole("button", { name: "Mulai LIVE" }).click();
  await expect(
    op.getByRole("dialog").getByText("Tersimpan di server"),
  ).toBeVisible();
  await op.getByRole("button", { name: "Tutup dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Cabut akses" }).click();
  const latest = await (
    await page.request.get(`/api/competitions/${cid}`)
  ).json();
  const m = latest.matches[1];
  expect(
    (
      await operator.request.patch(`/api/competitions/${cid}`, {
        data: {
          type: "score",
          version: latest.version,
          matchId: m.id,
          matchVersion: m.version,
          homeScore: 3,
          awayScore: 1,
        },
      })
    ).status(),
  ).toBe(403);
  // Finalize the live match before archiving; archived scores are immutable.
  await page.request.patch(`/api/competitions/${cid}`, {
    data: {
      type: "finalize",
      version: latest.version,
      matchId: m.id,
      matchVersion: m.version,
      homeScore: 0,
      awayScore: 0,
      confirm: true,
    },
  });
  await page.goto(`/dashboard/competitions/${cid}/settings`);
  await page.getByRole("button", { name: "Arsipkan", exact: true }).click();
  await page.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await expect(
    page.locator(".title-tags").getByText("Diarsipkan"),
  ).toBeVisible();
  await spectator.close();
  await operator.close();
});

test("local demo visibility, invitation revocation, persistence and origin checks via API", async ({
  request,
}) => {
  await request.post("/api/demo-login", {
    data: { email: "api-owner@example.test", name: "API Owner" },
  });
  const input = {
    name: "Privat API",
    format: "fourfeo",
    visibility: "private",
    teamNames: ["A", "B", "C", "D"],
  };
  let c = await (
    await request.post("/api/competitions", { data: input })
  ).json();
  const publish = await request.patch(`/api/competitions/${c.id}`, {
    data: { type: "publish", version: c.version },
  });
  expect(publish.ok()).toBe(true);
  c = await publish.json();
  const discovered = await (await request.get("/api/competitions")).json();
  expect(discovered.some((x: { id: string }) => x.id === c.id)).toBe(false);
  expect(
    (
      await request.patch(`/api/competitions/${c.id}`, {
        headers: { origin: "https://attacker.test" },
        data: { type: "publish", version: c.version },
      })
    ).status(),
  ).toBe(403);
  const invited = await (
    await request.post(`/api/competitions/${c.id}/invites`, {
      data: { role: "score_operator" },
    })
  ).json();
  const invites = await (
    await request.get(`/api/competitions/${c.id}/invites`)
  ).json();
  await request.delete(`/api/competitions/${c.id}/invites`, {
    data: { hash: invites[0].token_hash },
  });
  await request.post("/api/demo-login", {
    data: { email: "api-operator@example.test", name: "Operator" },
  });
  expect(
    (
      await request.post("/api/invite", { data: { token: invited.token } })
    ).status(),
  ).toBe(400);
  expect((await request.get(`/api/competitions/${c.id}`)).status()).toBe(404);
  await request.post("/api/logout", { data: {} });
  await request.post("/api/demo-login", {
    data: { email: "api-owner@example.test", name: "API Owner" },
  });
  expect((await request.get(`/api/competitions/${c.id}`)).ok()).toBe(true);
});

test("responsive empty homepage and keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".bottom-nav")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
  await page
    .getByRole("button", { name: "Tutup navigasi", exact: true })
    .click();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
});

test("owner can permanently delete drafts and archived competitions with name confirmation", async ({
  page,
  browser,
}) => {
  await page.request.post("/api/demo-login", {
    data: { email: "delete-owner@example.test", name: "Delete Owner" },
  });
  const input = {
    name: "Kompetisi salah buat",
    format: "fourfeo",
    visibility: "private",
    teamNames: ["A", "B", "C", "D"],
  };
  const c = await (
    await page.request.post("/api/competitions", { data: input })
  ).json();
  const control = await (
    await page.request.post("/api/competitions", {
      data: { ...input, name: "Kompetisi tetap tersimpan" },
    })
  ).json();
  const endpoint = `/api/competitions/${c.id}`;
  const invite = await (
    await page.request.post(`${endpoint}/invites`, {
      data: { role: "score_operator" },
    })
  ).json();
  for (const role of ["admin", "score_operator"] as const) {
    const context = await browser.newContext();
    try {
      await context.request.post("/api/demo-login", {
        data: { email: `delete-${role}@example.test`, name: role },
      });
      const token = await (
        await page.request.post(`${endpoint}/invites`, { data: { role } })
      ).json();
      expect(
        (
          await context.request.post("/api/invite", {
            data: { token: token.token },
          })
        ).ok(),
      ).toBe(true);
      const snapshot = await (await page.request.get(endpoint)).json();
      expect(
        (
          await context.request.delete(endpoint, {
            data: { name: c.name, version: snapshot.version },
          })
        ).status(),
      ).toBe(403);
      const memberPage = await context.newPage();
      await memberPage.goto(`/dashboard/competitions/${c.id}/settings`);
      await expect(
        memberPage.getByRole("heading", { name: c.name, exact: true }),
      ).toBeVisible();
      await expect(
        memberPage.getByRole("button", {
          name: "Hapus kompetisi",
          exact: true,
        }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
  let latest = await (await page.request.get(endpoint)).json();
  expect(
    (
      await page.request.delete(endpoint, {
        data: { name: "Salah", version: latest.version },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.delete(endpoint, {
        data: { name: c.name, version: c.version },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await page.request.delete(endpoint, { data: { name: c.name } })).status(),
  ).toBe(400);
  expect(
    (
      await page.request.delete(endpoint, {
        headers: { origin: "https://attacker.test" },
        data: { name: c.name, version: latest.version },
      })
    ).status(),
  ).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dashboard/competitions/${c.id}/settings`);
  await page
    .getByRole("button", { name: "Hapus kompetisi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hapus permanen", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Nama kompetisi untuk konfirmasi").fill("Salah");
  await expect(
    page.getByRole("button", { name: "Hapus permanen", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Kembali", exact: true }).click();
  expect((await page.request.get(endpoint)).ok()).toBe(true);
  await page
    .getByRole("button", { name: "Hapus kompetisi", exact: true })
    .click();
  await page.getByLabel("Nama kompetisi untuk konfirmasi").fill(c.name);
  await page.screenshot({
    path: "test-results/delete-confirmation-mobile.png",
  });
  await page
    .getByRole("button", { name: "Hapus permanen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await page.request.get(endpoint)).status()).toBe(404);
  expect((await page.request.get(`/api/competitions/${c.slug}`)).status()).toBe(
    404,
  );
  expect((await page.request.get(`/api/competitions/${control.id}`)).ok()).toBe(
    true,
  );
  expect(
    (
      await page.request.post("/api/invite", { data: { token: invite.token } })
    ).status(),
  ).toBe(400);
  await page.reload();
  await expect(page.getByText(c.name, { exact: true })).toHaveCount(0);
  for (const status of ["published", "archived"] as const) {
    latest = await (
      await page.request.post("/api/competitions", {
        data: { ...input, name: `Delete ${status}`, visibility: "public" },
      })
    ).json();
    latest = await (
      await page.request.patch(`/api/competitions/${latest.id}`, {
        data: { type: "publish", version: latest.version },
      })
    ).json();
    if (status === "archived")
      latest = await (
        await page.request.patch(`/api/competitions/${latest.id}`, {
          data: { type: "lifecycle", status, version: latest.version },
        })
      ).json();
    const guest = await browser.newContext();
    try {
      expect(
        (
          await guest.request.delete(`/api/competitions/${latest.id}`, {
            data: { name: latest.name, version: latest.version },
          })
        ).status(),
      ).toBe(401);
    } finally {
      await guest.close();
    }
    expect(
      (
        await page.request.delete(`/api/competitions/${latest.id}`, {
          data: { name: latest.name, version: latest.version },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await page.request.get(`/api/competitions/${latest.id}`)).status(),
    ).toBe(404);
  }
});
