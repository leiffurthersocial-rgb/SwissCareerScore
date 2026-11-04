import { expect, test } from "@playwright/test";

test.describe("weights, filters, URL state", () => {
  test("preset writes p= to the URL and survives reload", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Money first" }).click();
    await expect(page).toHaveURL(/p=money/);
    await page.reload();
    await expect(page.getByRole("button", { name: "Money first" })).toHaveAttribute("aria-pressed", "true");
  });

  test("keyboard slider change switches to custom weights and lock is encoded", async ({ page }) => {
    await page.goto("/en");
    const thumb = page.getByRole("slider", { name: "Weight of Pay" });
    await thumb.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/w=pay\.\d+/);
    await page.getByRole("button", { name: "Lock Pay" }).click();
    await expect(page).toHaveURL(/l=pay/);
    await expect(page.getByRole("slider", { name: "Weight of Pay" })).toHaveAttribute("data-disabled", "");
  });

  test("filters hide entries without changing scores", async ({ page }) => {
    await page.goto("/en?q=Cook");
    const row = page.locator("li", { hasText: "Cook" }).filter({ has: page.getByRole("link", { name: "Cook", exact: true }) });
    const before = await row.locator("span[aria-label^='Score']").textContent();
    await page.getByRole("combobox", { name: /^Show/ }).selectOption("occupation");
    await expect(page).toHaveURL(/k=occupation/);
    await expect(page.getByRole("heading", { name: "Education paths" })).toHaveCount(0);
    await expect(row.locator("span[aria-label^='Score']")).toHaveText(before!);
    await page.getByRole("combobox", { name: /^Max. years of training/ }).selectOption("3");
    await page.getByRole("searchbox", { name: "Search" }).fill("Physician");
    await expect(page.getByRole("link", { name: "Physician" })).toHaveCount(0);
  });

  test("compare up to four entries", async ({ page }) => {
    await page.goto("/en?k=occupation");
    await page.getByRole("searchbox", { name: "Search" }).fill("Cook");
    await page.getByRole("button", { name: "Add Cook to comparison" }).click();
    await page.getByRole("searchbox", { name: "Search" }).fill("Electrician");
    await page.getByRole("button", { name: "Add Electrician to comparison" }).click();
    await page.getByRole("link", { name: "Compare 2 selected" }).click();
    await expect(page).toHaveURL(/\/en\/compare\?.*c=/);
    const table = page.locator("table:not(.sr-only)").last();
    await expect(table.getByRole("columnheader", { name: /Cook/ })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /Electrician/ })).toBeVisible();
  });

  test("every number opens its source", async ({ page }) => {
    await page.goto("/en/entity/occ-polymechaniker");
    await page.getByRole("button", { name: /Mid-career wage, age 30–49 \(median\): CHF/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Bundesamt für Statistik", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Measured")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Open source/ })).toHaveAttribute("href", /pxweb\.bfs\.admin\.ch/);
  });

  test("pairwise wizard derives and applies weights", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Help me choose (pairwise)" }).click();
    for (let i = 0; i < 10; i++) {
      // always prefer the left option "strongly"
      await page.getByRole("radio").nth(1).check();
      await page.getByRole("button", { name: "Next" }).click();
    }
    await expect(page.getByText("Your derived weights")).toBeVisible();
    await page.getByRole("button", { name: "Apply weights" }).click();
    await expect(page).toHaveURL(/w=/);
    // money group got the highest share → pay weight > balanced 8 %
    const pct = await page.getByRole("slider", { name: "Weight of Pay" }).getAttribute("aria-valuenow");
    expect(Number(pct)).toBeGreaterThan(15);
  });
});

test("scoring model controls: scale and flaw penalty are encoded and shown in the breakdown", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("combobox", { name: "Scale" }).selectOption("relative");
  await expect(page).toHaveURL(/sm=rel/);
  await page.getByRole("combobox", { name: "Penalty for weak spots" }).selectOption("severe");
  await expect(page).toHaveURL(/fp=severe/);
  await page.goto("/en/entity/occ-koch?fp=severe");
  await expect(page.getByRole("rowheader", { name: "Penalty for weak spots" })).toBeVisible();
});
