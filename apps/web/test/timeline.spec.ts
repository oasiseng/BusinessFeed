import { expect, test } from "@playwright/test";

const item = {
  id: "item-1",
  eventId: "event-1",
  source: "Website",
  sourceType: "website",
  occurredAt: new Date().toISOString(),
  actor: { name: "Maya Chen" },
  summary: "Maya Chen: New lead from website form: Needs a stamped deck repair proposal and asked whether photos are enough for preliminary review.",
  title: "New lead from website form",
  body: "Needs a stamped deck repair proposal.",
  priorityScore: 98,
  category: "lead",
  needsAction: true,
  dedupeKey: "abc",
  imagePolicy: "hide",
  sourceUrl: "https://example.com/lead",
  state: { read: false, saved: false, dismissed: false }
};

test("renders the timeline without marketing chrome", async ({ page }) => {
  await page.route("**/api/feed?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [item], nextCursor: null, generatedAt: new Date().toISOString() })
    });
  });

  await page.route("**/api/items/*/state", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ item: { ...item, state: { read: true, saved: true, dismissed: false } } })
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "BusinessFeed" })).toBeVisible();
  const feedItem = page.getByTestId("feed-item");
  await expect(feedItem).toContainText("New lead from website form");
  await expect(feedItem.getByRole("button", { name: "Save" })).toBeVisible();
});
