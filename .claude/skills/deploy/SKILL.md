# Deploy — Cloudflare Worker Checklist

## Steps to follow every time:

1. **Read `wrangler.toml`** and show its contents. Search for any occurrence of `REPLACE_WITH` — if found, STOP and ask the user to provide the real value before continuing.

2. **Check secrets** — run `wrangler secret list` and confirm all required secrets are present:
   - `ANTHROPIC_API_KEY`
   - `NOTION_TOKEN`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_SECRET`

3. **Run dry-run** — execute `wrangler deploy --dry-run` from the `worker/` directory. If it fails, read the error, fix the issue, and retry. Show what was changed.

4. **Deploy** — if dry-run passes, run `wrangler deploy` from the `worker/` directory.

5. **Verify** — test the live endpoint and report success or failure. If it fails, diagnose and fix before declaring the deployment done.

> Never claim the deployment succeeded without actually verifying the live endpoint.
