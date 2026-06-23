import { describe, expect, it } from "vitest";
import { categorizeEvent, inferNeedsAction, scoreEvent, shouldShowMedia, summarizeEvent, toFeedItemDraft } from "../src/index";

const now = new Date().toISOString();

describe("feed rules", () => {
  it("keeps summaries under 200 characters without inventing facts", () => {
    const summary = summarizeEvent({
      source: "Outlook",
      sourceType: "email",
      externalId: "mail-1",
      occurredAt: now,
      actor: { name: "Dana Lee" },
      title: "Please review the deck permit drawings before noon",
      body: "The city asked whether the revised post base detail and footing note can be confirmed today before the resubmittal package goes out."
    });

    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary).toContain("Dana Lee");
    expect(summary).toContain("permit drawings");
    expect(summary).not.toContain("approved");
  });

  it("boosts leads and marks them actionable", () => {
    const event = {
      source: "Website",
      sourceType: "website" as const,
      externalId: "lead-1",
      occurredAt: now,
      title: "New lead from website form",
      body: "Client requests a quote for a deck permit package."
    };

    expect(categorizeEvent(event)).toBe("lead");
    expect(inferNeedsAction(event)).toBe(true);
    expect(scoreEvent(event)).toBeGreaterThan(70);
  });

  it("suppresses known low-signal inbox noise", () => {
    const event = {
      source: "Outlook",
      sourceType: "email" as const,
      externalId: "dmarc-1",
      occurredAt: now,
      title: "DMARC aggregate report",
      body: "Automated no-reply digest."
    };

    expect(categorizeEvent(event)).toBe("noise");
    expect(scoreEvent(event)).toBeLessThan(35);
    expect(inferNeedsAction(event)).toBe(false);
  });

  it("only shows useful media", () => {
    const projectPhoto = {
      source: "Quo",
      sourceType: "quo" as const,
      externalId: "msg-1",
      occurredAt: now,
      title: "Site photo attached for foundation review",
      media: [{ kind: "image" as const, url: "https://example.com/photo.jpg", label: "field photo" }]
    };
    const logo = {
      ...projectPhoto,
      externalId: "msg-2",
      title: "Profile updated",
      media: [{ kind: "image" as const, url: "https://example.com/logo.png", label: "company logo" }]
    };

    expect(shouldShowMedia(projectPhoto)).toBe(true);
    expect(shouldShowMedia(logo)).toBe(false);
  });

  it("creates stable feed drafts with dedupe keys", () => {
    const draft = toFeedItemDraft({
      source: "Trello",
      sourceType: "trello",
      externalId: "card-1",
      occurredAt: now,
      title: "Card moved to Review",
      body: "Plan-review checklist is waiting on final comments."
    });

    expect(draft.dedupeKey).toHaveLength(24);
    expect(draft.category).toBe("task");
    expect(draft.needsAction).toBe(true);
  });
});
