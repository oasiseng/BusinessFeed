# Connector Notes

BusinessFeed uses adapters that normalize source activity into `ActivityEvent`.

## Trello

The Trello adapter is read-only. It searches cards using a configured Trello query and maps each card into an activity event.

Required variables:

- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- `TRELLO_QUERY`

## Outlook

The Outlook adapter is a Microsoft Graph shape, not a full OAuth product. Provide a token through `OUTLOOK_GRAPH_TOKEN`, or ingest email activity through Zapier/batch imports until a real auth flow is added.

## Zapier

Use Zapier for v1 sources without native adapters: QuickBooks, Quotient, Quo/messages, website forms, and other business systems. Each Zap should send a JSON body compatible with `ActivityEvent` or a source-specific event that the generic mapper can normalize.

Always sign requests in production with `x-businessfeed-signature`.
