import { expect, test } from "@playwright/test";

test("capture critical design states across tabs and focused mode", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByTestId("training-tab")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("01-training-default.png"),
    fullPage: true
  });

  await page.getByLabel("Mode").selectOption("puzzle_recall");
  await expect(page.getByTestId("start-session-btn")).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId("start-session-btn").click();

  const overlay = page.getByTestId("focused-overlay");
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId("exercise-card-puzzle-recall")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("02-focused-question.png"),
    fullPage: true
  });

  await page.getByTestId("view-answer-btn").click();
  await expect(page.getByTestId("board-container")).toBeVisible();
  await expect(page.getByTestId("grade-right-btn")).toBeInViewport();
  await expect(page.getByTestId("grade-wrong-btn")).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("03-focused-answer.png"),
    fullPage: true
  });

  await page.getByTestId("stop-session-btn").click();
  await expect(overlay).toBeHidden();

  await page.getByTestId("progress-tab").click();
  await expect(page.getByTestId("progress-view")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("04-progress-tab.png"),
    fullPage: true
  });
});
