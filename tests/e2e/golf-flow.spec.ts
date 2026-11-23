import { expect, test } from "@playwright/test";

test.describe("Public tournament pages & UI sanity", () => {
  test("home page and tournaments list load with zero runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Browse tournaments/i })).toBeVisible();

    await page.goto("/tournaments", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("SM 2027 public page renders with sentence case and no runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    await page.goto("/tournaments/sm-2027", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "SM 2027" })).toBeVisible();
    await expect(page.getByText("Date & time")).toBeVisible();
    await expect(page.getByText("Event types")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

test.describe("Authenticated M1.3 + M1.4 Disc golf flow", () => {
  // eslint-disable-next-line node/no-process-env
  const email = process.env.E2E_EMAIL;
  // eslint-disable-next-line node/no-process-env
  const password = process.env.E2E_PASSWORD;

  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated TD tests.");

  test("enforces locked starting list gate and allows score entry once locked", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    // 1. Sign in via Better Auth email endpoint (sets session cookie on browser context)
    const signInRes = await page.request.post("/api/auth/sign-in/email", {
      headers: {
        "content-type": "application/json",
        "origin": "http://localhost:3000",
      },
      data: { email: email!, password: password! },
    });
    expect(signInRes.ok()).toBeTruthy();

    // 2. Open Starting lists for SM 2027, ensure Round 1 is unlocked
    await page.goto("/dashboard/tournaments/sm-2027/starting-lists", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Starting lists" })).toBeVisible();

    const unlockBtn = page.getByRole("button", { name: "Unlock list", exact: true });
    await expect(page.getByText("List status")).toBeVisible();
    if (await unlockBtn.isEnabled()) {
      await unlockBtn.click();
      await expect(page.getByText("Starting list unlocked.")).toBeVisible();
    }

    // 3. Verify Score entry is blocked when starting list is unlocked
    await page.goto("/dashboard/tournaments/sm-2027/scores/golf", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Disc golf score entry" })).toBeVisible();
    await expect(page.getByText(/must be generated and locked|not locked yet|not been generated yet/i)).toBeVisible();
    const firstScoreInput = page.locator("input[id^='golf-score-']").first();
    await expect(firstScoreInput).toBeDisabled();

    // 4. Go back, generate (if needed) and lock Round 1
    await page.goto("/dashboard/tournaments/sm-2027/starting-lists", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("List status")).toBeVisible();
    const generateBtn = page.getByRole("button", { name: "Generate starting list" });
    if (await generateBtn.isVisible() && await generateBtn.isEnabled()) {
      await generateBtn.click();
      await expect(page.getByText("Starting list generated.")).toBeVisible();
    }

    await page.getByRole("button", { name: "Lock list", exact: true }).click();
    await expect(page.getByText("Starting list locked.")).toBeVisible();

    // 5. Return to Score entry, verify inputs are enabled and typing strokes works with zero errors
    await page.goto("/dashboard/tournaments/sm-2027/scores/golf", { waitUntil: "domcontentloaded" });
    await expect(firstScoreInput).toBeEnabled();
    await firstScoreInput.fill("54");
    await firstScoreInput.press("Enter");
    await expect(page.getByRole("button", { name: "Save scores" }).first()).toBeEnabled();
    await page.getByRole("button", { name: "Save scores" }).first().click();
    await expect(page.getByText(/Saved .* round 1/i)).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
