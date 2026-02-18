import { expect, test } from "@playwright/test";

test("focused puzzle recall keeps controls and board reachable", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Mode").selectOption("puzzle_recall");
  const startButton = page.getByTestId("start-session-btn");
  await expect(startButton).toBeEnabled({ timeout: 20_000 });
  await startButton.click();

  const overlay = page.getByTestId("focused-overlay");
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId("exercise-card-puzzle-recall")).toBeVisible();

  await page.getByTestId("view-answer-btn").click();

  const board = page.getByTestId("board-container");
  const right = page.getByTestId("grade-right-btn");
  const wrong = page.getByTestId("grade-wrong-btn");

  await expect(board).toBeVisible();
  await expect(board).toBeInViewport();
  await right.scrollIntoViewIfNeeded();
  await wrong.scrollIntoViewIfNeeded();
  await expect(right).toBeInViewport();
  await expect(wrong).toBeInViewport();

  const overlayMetrics = await overlay.evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight
  }));
  expect(overlayMetrics.scrollHeight).toBeGreaterThanOrEqual(overlayMetrics.clientHeight);

  await page.getByTestId("stop-session-btn").click();
  await expect(overlay).toBeHidden();
});
