# DARK FEEL Events

Same architecture as Kaya Lum: a Telegram bot manages persistent event data; the Sites frontend reads a public events API. Kaya Lum's public page uses `https://dj-bot-production.up.railway.app/api/kaya-lum/events`. This companion is isolated from Kaya Lum and exposes `/api/dark-feel/events`.

Deployed as Railway Function darkfeel-events-bot. The user has configured TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USER_IDS. The public API domain and website endpoint are still pending explicit domain approval. Existing Kaya Lum services are unchanged.

## Activate after credentials are supplied

1. Deploy this directory as one Node 22 Railway service. Start command: `node server.mjs`.
2. Attach a persistent volume at `/data`; set `DATA_DIR=/data`.
3. Set `TELEGRAM_BOT_TOKEN` as a runtime secret and `TELEGRAM_ALLOWED_USER_IDS` to comma-separated numeric IDs for Darina and any authorized manager. Do not put credentials in frontend files or commit them.
4. Set `SITE_ORIGIN=https://darkfeel-official.mukvik.chatgpt.site`.
5. Use a new dedicated bot with no webhook. The service uses Telegram long polling; run exactly one replica. Do not repurpose Kaya Lum's token.
6. Set `dist/events-config.json` endpoint to the new service's HTTPS `/api/dark-feel/events`, then publish the site.
7. Test with Darina: `/start`, `/add`, date, venue, city, country, optional ticket URL, `/confirm`. Verify the entry on the site. `/list` and `/delete ID` manage entries; deletion needs `/confirm`. `/cancel` abandons a draft.

Until activated, Events shows “Dates to be announced.” No demo performances are published. Drafts are in memory; confirmed events and Telegram update cursor persist on the volume.

## Telegram interface

Matches Kaya Lum Events inline navigation: Add performance, All events, Statistics. The add flow accepts DD.MM.YYYY or ISO dates, optional time/range, venue, city, country, optional ticket URL and public/hidden visibility. Event detail buttons edit fields, toggle visibility or delete after confirmation. Statistics is intentionally deferred. Existing saved event records remain compatible. Runtime data lives on the mounted /data volume.

Menu is shown by /start. Command registration is configured during startup; no broadcast is sent.

## Invitations

The env allowlist remains the owner role. `/invite` generates a 24-hour, one-use Telegram deep link for an event editor. New invitations replace the owner's prior invitation. Only token hashes are stored; raw tokens are returned only in the reply to the owner. Redeeming requires a private `/start invite_TOKEN` update. The editor's numeric ID and inviter are persisted atomically with consumption of the invitation on /data, and editor authorization survives process restarts. Editors can manage performances but cannot issue invitations. Existing owners opening their own link do not consume it. Public event responses never expose invitations or editors.
