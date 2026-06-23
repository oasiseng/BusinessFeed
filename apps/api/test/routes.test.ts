import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const secret = "fixture";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", secret).update(Buffer.from(body)).digest("hex")}`;
}

describe("api routes", () => {
  it("ingests signed Zapier events, filters the feed, paginates, and updates local state", async () => {
    const app = await createApp({
      dbPath: ":memory:",
      webhookSecret: secret,
      allowUnsignedWebhooks: false,
      serveStatic: false
    });

    const body = JSON.stringify({
      source: "Website form",
      id: "lead-42",
      timestamp: new Date().toISOString(),
      actorName: "Mira Alvarez",
      title: "New lead from website form",
      description: "Needs proposal for a plan-review package.",
      link: "https://example.com/leads/42"
    });

    const ingest = await app.inject({
      method: "POST",
      url: "/api/ingest/zapier",
      headers: {
        "content-type": "application/json",
        "x-businessfeed-signature": sign(body)
      },
      payload: body
    });
    expect(ingest.statusCode).toBe(201);
    const ingested = ingest.json();
    expect(ingested.item.category).toBe("lead");

    const batch = await app.inject({
      method: "POST",
      url: "/api/ingest/batch",
      headers: { "content-type": "application/json" },
      payload: {
        events: [
          {
            source: "QuickBooks",
            sourceType: "quickbooks",
            externalId: "payment-1",
            occurredAt: new Date().toISOString(),
            title: "Payment received",
            body: "Generic receipt from QuickBooks."
          },
          {
            source: "Trello",
            sourceType: "trello",
            externalId: "card-1",
            occurredAt: new Date().toISOString(),
            title: "Review permit plan comments",
            body: "Please confirm final notes."
          }
        ]
      }
    });
    expect(batch.statusCode).toBe(201);

    const leads = await app.inject("/api/feed?view=leads&limit=1");
    expect(leads.statusCode).toBe(200);
    const leadPage = leads.json();
    expect(leadPage.items).toHaveLength(1);
    expect(leadPage.items[0].sourceType).toBe("website");

    const firstPage = await app.inject("/api/feed?limit=1");
    const page = firstPage.json();
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();

    const state = await app.inject({
      method: "POST",
      url: `/api/items/${page.items[0].id}/state`,
      headers: { "content-type": "application/json" },
      payload: { read: true, saved: true }
    });
    expect(state.statusCode).toBe(200);
    expect(state.json().item.state.saved).toBe(true);

    await app.close();
  });

  it("rejects unsigned Zapier events when signatures are required", async () => {
    const app = await createApp({
      dbPath: ":memory:",
      webhookSecret: secret,
      allowUnsignedWebhooks: false,
      serveStatic: false
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/zapier",
      headers: { "content-type": "application/json" },
      payload: { source: "Website", id: "lead", title: "Lead" }
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
