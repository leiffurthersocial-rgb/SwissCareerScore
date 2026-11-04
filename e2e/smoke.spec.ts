import { expect, test } from "@playwright/test";

test("home loads with hero, top picks and a ranked list", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find the job or training");
  await expect(page.getByRole("heading", { name: "Top picks for your weights" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Occupations" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#results li").first().getByText("#1")).toBeVisible();
  await expect(page.getByText("Decision support, not career advice.").first()).toBeVisible();
});

test("hero search jumps to an entry", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("searchbox", { name: "Search occupations and education paths" }).fill("polymech");
  await page.getByRole("list", { name: "Search occupations and education paths" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/entity\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Polymech/i);
});

test("German locale renders translated UI", async ({ page }) => {
  await page.goto("/de");
  await expect(page.getByRole("tab", { name: "Berufe", exact: true })).toBeVisible();
  await expect(page.getByText("Entscheidungshilfe, keine Berufsberatung.").first()).toBeVisible();
});

test("large dataset: paginated list with show-more and a generated entry page", async ({ page }) => {
  await page.goto("/en");
  const list = page.locator("#results ol > li");
  await expect(list).toHaveCount(30);
  await page.getByRole("button", { name: /Show more/ }).click();
  await expect(list).toHaveCount(90);
  await page.goto("/de/entity/edu-efz-schreiner-in");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Schreiner");
});

test("education entries show where they lead and occupations show how to get there", async ({ page }) => {
  await page.goto("/en/entity/edu-efz-polymechaniker");
  await expect(page.getByRole("heading", { name: /Where this leads/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Further training options/ })).toBeVisible();
  await page.goto("/en/entity/occ-polymechaniker");
  await expect(page.getByRole("heading", { name: /How to get there/ })).toBeVisible();
});
