import { describe, expect, it } from "vitest";
import { mapOutlookMessage, mapTrelloCard, normalizeZapierEvent } from "../src/index";

describe("connector normalization", () => {
  it("normalizes generic website Zapier payloads", () => {
    const event = normalizeZapierEvent({
      source: "Website form",
      id: "form-123",
      timestamp: "2026-06-23T13:00:00.000Z",
      actorName: "Priya Shah",
      title: "New lead from website form",
      description: "Needs a stamped balcony repair proposal.",
      link: "https://example.com/leads/form-123"
    });

    expect(event.sourceType).toBe("website");
    expect(event.externalId).toBe("form-123");
    expect(event.actor?.name).toBe("Priya Shah");
    expect(event.url).toContain("form-123");
  });

  it("normalizes Trello cards", () => {
    const event = mapTrelloCard({
      id: "abc",
      name: "Review Smith deck plan",
      desc: "Waiting on footing detail",
      dateLastActivity: "2026-06-23T12:30:00.000Z",
      shortUrl: "https://trello.com/c/abc",
      labels: [{ name: "Permit" }],
      badges: { checklistItems: 4, checklistItemsChecked: 2 }
    });

    expect(event.sourceType).toBe("trello");
    expect(event.body).toContain("Permit");
    expect(event.body).toContain("2/4");
  });

  it("normalizes Outlook messages", () => {
    const event = mapOutlookMessage({
      id: "mail-1",
      subject: "Please confirm proposal revision",
      bodyPreview: "Can you send the corrected plan note?",
      receivedDateTime: "2026-06-23T12:30:00.000Z",
      webLink: "https://outlook.office.com/mail/mail-1",
      from: { emailAddress: { name: "Dana", address: "dana@example.com" } },
      hasAttachments: true
    });

    expect(event.sourceType).toBe("email");
    expect(event.actor?.email).toBe("dana@example.com");
    expect(event.media?.[0]?.kind).toBe("document");
  });
});
