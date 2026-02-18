import { expect, test } from "@playwright/test";

test("puzzle recall reveal and grade loop", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Mode").selectOption("puzzle_recall");
  const startButton = page.getByTestId("start-session-btn");
  await expect(startButton).toBeEnabled({ timeout: 20_000 });
  await startButton.click();

  await expect(page.getByTestId("focused-overlay")).toBeVisible();
  await expect(page.getByTestId("exercise-card-puzzle-recall")).toBeVisible();

  await page.getByTestId("view-answer-btn").click();
  await expect(page.getByTestId("puzzle-continuation")).toBeVisible();
  await expect(page.getByTestId("board-container")).toBeVisible();

  await page.getByTestId("grade-right-btn").click();
  await expect(page.getByTestId("view-answer-btn")).toBeVisible();

  await page.getByTestId("stop-session-btn").click();
  await expect(page.getByTestId("focused-overlay")).toBeHidden();
});
