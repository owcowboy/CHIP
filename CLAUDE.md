# CHIP Project — Claude Instructions

## Project Overview
CHIP is a PWA assistant with:
- **Telegram bot** for user interaction
- **Cloudflare Worker** backend (TypeScript)
- **Notion integration** for task and project management
- **GitHub Pages** frontend (PWA)

Primary language: TypeScript

---

## User Environment
- **OS: Windows** — always use PowerShell or CMD syntax
- Never assume Linux/Mac commands
- When giving terminal instructions, provide Windows-compatible commands
- Offer GUI alternatives when a task involves git or CLI tools the user may not be familiar with

---

## Deployment (Cloudflare Worker)
Before running `wrangler deploy`:
1. Read `wrangler.toml` and confirm there are **zero placeholder values** (search for `REPLACE_WITH`)
2. Verify all secrets are set: run `wrangler secret list`
3. Run `wrangler deploy --dry-run` first
4. Only deploy if dry-run passes
5. After deploying, test the live endpoint and report the result

**Never claim a config is correct without reading the actual file first.**

---

## Notion Integration
- When creating Notion databases, create ALL required databases in a single pass
- After creation, verify every property name and type matches the TypeScript interfaces in `worker/src`
- Never create duplicate databases — check if they already exist before creating
- Report any schema mismatches before committing changes

---

## Security
- If a secret or token is shared in chat, immediately advise the user to rotate it via the relevant platform
- Never contradict previous security advice
- Do not minimize token exposure incidents

---

## Session Continuity
- At the end of each session, update `STATUS.md` with:
  - What was accomplished
  - What is still pending
  - The exact next step to resume
  - Any config values, IDs, or commands needed
- At the start of each session, read `STATUS.md` before asking "what should I work on next?"
