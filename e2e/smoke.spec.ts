import { expect, test } from "@playwright/test";

test("ranking loads with balanced default and per-group ranks", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: "SwissCareerScore" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Occupations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Education paths" })).toBeVisible();
  const ranks = page.locator("ol").first().locator("li").first();
  await expect(ranks.getByLabel("Rank 1")).toBeVisible();
  await expect(page.getByText("Decision support, not career advice.").first()).toBeVisible();
});

test("German locale renders translated UI", async ({ page }) => {
  await page.goto("/de");
  await expect(page.getByRole("heading", { name: "Berufe", exact: true })).toBeVisible();
  await expect(page.getByText("Entscheidungshilfe, keine Berufsberatung.").first()).toBeVisible();
});
