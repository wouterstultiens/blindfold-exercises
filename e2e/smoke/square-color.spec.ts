import { expect, test } from "@playwright/test";

test("square color run then progress tab render", async ({ page }) => {
  await page.goto("/");

  const startButton = page.getByTestId("start-session-btn");
  await expect(startButton).toBeEnabled();
  await startButton.click();

  await expect(page.getByTestId("focused-overlay")).toBeVisible();
  await expect(page.getByTestId("exercise-card-square-color")).toBeVisible();
  await page.getByTestId("square-answer-black").click();
  await expect(page.getByTestId("exercise-card-square-color")).toBeVisible();

  await page.getByTestId("stop-session-btn").click();
  await expect(page.getByTestId("focused-overlay")).toBeHidden();

  await page.getByTestId("progress-tab").click();
  await expect(page.getByTestId("progress-view")).toBeVisible();
});
