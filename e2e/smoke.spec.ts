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

test("after the Matura: catalogue with institutions, filters and blended numbers", async ({ page }) => {
  await page.goto("/en/after-matura");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every study path in Switzerland");
  await expect(page.getByText(/128 programmes/)).toBeVisible();
  await page.getByRole("combobox", { name: "Institution" }).selectOption("EPFL");
  await expect(page.getByRole("link", { name: "Microengineering" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Human medicine" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Institution" }).selectOption("");
  await page.getByRole("searchbox", { name: "Search" }).fill("medicine");
  const card = page.locator("li", { has: page.getByRole("link", { name: "Human medicine" }) });
  await expect(card.getByText("Numerus clausus")).toBeVisible();
  await expect(card.getByText(/BFS CHF .* · own CHF/).first()).toBeVisible();
});

test("after the Matura: institutions are differentiated within a programme", async ({ page }) => {
  await page.goto("/en/after-matura");
  await page.getByRole("combobox", { name: "Institution" }).selectOption("UNISG");
  const card = page.locator("li", { has: page.getByRole("link", { name: "Business administration (university)" }) });
  await expect(card.getByText(/^At HSG/)).toBeVisible();
  await card.locator("summary", { hasText: "Compare the 10 institutions" }).click();
  const rows = card.locator("tbody tr");
  await expect(rows.first()).toContainText("HSG");
  await expect(rows.first()).toContainText("reputation premium +12 %");
});
