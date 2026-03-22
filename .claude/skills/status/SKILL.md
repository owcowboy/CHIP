# Status — Project Status Check

## Steps to follow every time:

1. **Read `STATUS.md`** at the project root (if it exists) for the last known state.

2. **Check git log** — run `git log --oneline -5` to see recent commits.

3. **Check deployment** — read `wrangler.toml` and confirm:
   - No placeholder values (`REPLACE_WITH`)
   - KV namespace ID is set

4. **Check frontend** — verify `app/` has the latest build ready for GitHub Pages.

5. **Summarize** — output a clear status report:
   - What is done
   - What is in progress
   - What is blocked
   - Exact next step to resume work

6. **Update `STATUS.md`** — write the summary to `STATUS.md` at the project root with today's date.

7. **Update Notion** — use the Notion MCP tools to update the CHIP Project Tracker page with the current status summary.
