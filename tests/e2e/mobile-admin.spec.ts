import { test, expect } from "@playwright/test";
test("main admin provisions accounts; other users cannot; mobile inputs and group ordering", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/demo-login", {
    data: { email: "sanjifile@gmail.com", name: "Admin Utama" },
  });
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Kelola akun", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nama pengguna", { exact: true }).fill("Operator Baru");
  await page
    .getByLabel("Email akun", { exact: true })
    .fill("managed-operator@example.test");
  await page
    .getByLabel("Kata sandi awal", { exact: true })
    .fill("Local-test-password-44");
  const inputs = await page
    .locator("input,select,textarea")
    .evaluateAll((els) =>
      els
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => parseFloat(getComputedStyle(el).fontSize)),
    );
  expect(inputs.every((size) => size >= 16)).toBe(true);
  await page
    .getByRole("button", { name: "Buat akun / beri akses", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Akun dibuat");
  await expect(page.locator(".managed-account-list")).toContainText(
    "managed-operator@example.test",
  );
  await expect(page.getByLabel("Kata sandi awal", { exact: true })).toHaveValue(
    "",
  );
  await page.screenshot({
    path: "test-results/admin-accounts-mobile.png",
    fullPage: true,
  });
  const member = await browser.newContext();
  try {
    await member.request.post("/api/demo-login", {
      data: { email: "managed-operator@example.test", name: "Operator Baru" },
    });
    expect((await member.request.get("/api/admin/accounts")).status()).toBe(
      403,
    );
    expect(
      (
        await member.request.post("/api/admin/accounts", {
          data: {
            email: "forbidden@example.test",
            name: "No",
            password: "No-access-44",
          },
        })
      ).status(),
    ).toBe(403);
    const p = await member.newPage();
    await p.goto("/account");
    await expect(
      p.getByRole("heading", { name: "Akun saya", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("heading", { name: "Kelola akun", exact: true }),
    ).toHaveCount(0);
  } finally {
    await member.close();
  }
  const guest = await browser.newContext();
  try {
    expect((await guest.request.get("/api/admin/accounts")).status()).toBe(401);
  } finally {
    await guest.close();
  }
  const c = await (
    await page.request.post("/api/competitions", {
      data: {
        name: "Giliran Grup",
        format: "group_stage",
        teamNames: Array.from({ length: 16 }, (_, i) => `Tim ${i + 1}`),
        groups: 4,
        meetings: 1,
      },
    })
  ).json();
  expect(c.matches.slice(0, 8).map((m: { group: string }) => m.group)).toEqual([
    "A",
    "B",
    "C",
    "D",
    "A",
    "B",
    "C",
    "D",
  ]);
  await page.goto(`/dashboard/competitions/${c.id}/fixtures`);
  await expect(page.locator(".fixture-row")).toHaveCount(24);
  await page.getByRole("button", { name: "Atur urutan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Seimbangkan giliran grup", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/group-fixtures-mobile.png",
    fullPage: false,
  });
  await page.goto("/dashboard/new");
  await page.getByLabel("Nama kompetisi").fill("Mobile input test");
  expect(
    await page
      .getByLabel("Nama kompetisi")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
