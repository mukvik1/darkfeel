# DARK FEEL

Website deployed to Railway outside Ukraine. Start with `npm start`; static public files are served by web.mjs. `/api/events` proxies the isolated Telegram Events API.

Telegram bot source is under telegram-events. Runtime secrets remain in Railway Variables; invitations, editors and event data persist on the bot's Railway /data volume in SFO. Do not commit runtime data.
