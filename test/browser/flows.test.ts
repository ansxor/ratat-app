import { expect, test } from "@playwright/test";

const BASE = process.env.RATAT_E2E_URL ?? "http://127.0.0.1:3000";

test.describe("Ratat E2E flows", () => {
  test.skip(
    process.env.RATAT_E2E !== "1",
    "Set RATAT_E2E=1 with a seeded vp dev server running on http://127.0.0.1:3000",
  );

  test("1. Home page renders login panel when signed out (and timeline when signed in)", async ({
    page,
  }) => {
    await page.goto(BASE);
    await expect(page.getByPlaceholder("alice.bsky.social")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("2. Artist profile displays byline, counts, and seeded artworks", async ({ page }) => {
    await page.goto(`${BASE}/profile/bob.test`);
    await expect(page.getByText("Bob", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("@bob.test").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /65\s+PIECES/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /FOLLOWERS/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /FOLLOWING/i })).toBeVisible();
    await expect(
      page.locator("article, [data-artwork-card], a[href^='/art/bob.test/']").first(),
    ).toBeVisible();
  });

  test("3. Pager navigates across pages of bob.test portfolio", async ({ page }) => {
    await page.goto(`${BASE}/profile/bob.test`);
    const page2Link = page.getByRole("link", { name: "2", exact: true }).first();
    await expect(page2Link).toBeVisible();
    await page2Link.click();
    await expect(page).toHaveURL(/\/profile\/bob\.test\?page=2/);

    const page3Link = page.getByRole("link", { name: "3", exact: true }).first();
    await expect(page3Link).toBeVisible();
    await page3Link.click();
    await expect(page).toHaveURL(/\/profile\/bob\.test\?page=3/);
  });

  test("4. Artwork detail displays carousel, metadata, and More by sidebar", async ({ page }) => {
    await page.goto(`${BASE}/art/bob.test/bob-65`);
    await expect(page.getByText(/Artwork series #65/)).toBeVisible();
    await expect(page.getByText("1 / 4")).toBeVisible();

    const nextSlide = page.getByRole("button", { name: /Next slide/i });
    await expect(nextSlide).toBeVisible();
    await nextSlide.click();
    await expect(page.getByText("2 / 4")).toBeVisible();

    await expect(page.getByText(/More by/i)).toBeVisible();
  });

  test("5. Content filter veils blur rated artwork, uncensor reveals, and Hide shows gate", async ({
    page,
  }) => {
    await page.goto(`${BASE}/profile/alice.test`);

    const uncensorBtn = page.getByRole("button", { name: /Uncensor/i }).first();
    await expect(uncensorBtn).toBeVisible();
    await uncensorBtn.click();

    await page.getByRole("button", { name: /Quick settings/i }).click();
    await page.getByRole("radio", { name: "Hide" }).first().click();

    await page.goto(`${BASE}/art/alice.test/alice-03`);
    await expect(page.getByRole("heading", { name: "Filtered" })).toBeVisible();
    await page.getByRole("button", { name: "Reveal" }).click();
    await expect(page.getByText(/Figure study/)).toBeVisible();
  });

  test("6. Search bar returns typeahead matches and navigates to artist profile", async ({
    page,
  }) => {
    await page.goto(BASE);
    const combobox = page.getByRole("combobox");
    await combobox.click();
    await combobox.fill("ali");

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    const aliceOption = listbox.getByText(/alice\.test/).first();
    await expect(aliceOption).toBeVisible();
    await aliceOption.click();

    await expect(page).toHaveURL(/\/profile\/alice\.test/);
  });

  test("7. Followers, following, and engagement/follow controls render seeded graph", async ({
    page,
  }) => {
    await page.goto(`${BASE}/profile/bob.test/followers`);
    await expect(page.getByText(/alice\.test/)).toBeVisible();
    await expect(page.getByText(/carol\.test/)).toBeVisible();

    await page.goto(`${BASE}/profile/carol.test/following`);
    await expect(page.getByText(/alice\.test/)).toBeVisible();
    await expect(page.getByText(/bob\.test/)).toBeVisible();
  });
});
