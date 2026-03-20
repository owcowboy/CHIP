# CHIP — Contextual Hub for Intelligence & Productivity

Ton assistant de vie quotidienne proactif. Planning Pomodoro, routine sport, check-ins automatiques, mémoire persistante via Notion.

## Stack

| Couche | Technologie |
|---|---|
| Frontend | PWA vanilla (pixel/retro) → GitHub Pages |
| Backend | Cloudflare Workers (TypeScript) |
| Notifications | Telegram Bot |
| Base de données | Notion API |
| IA | Claude API (Haiku + Sonnet) |
| Musique | Spotify (lien direct) |

## Structure

```
CHIP/
├── app/          ← PWA (déploie sur GitHub Pages)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/chip.css
│   └── js/
│       ├── app.js        ← orchestrateur
│       ├── api.js        ← client Worker
│       └── views/        ← 5 vues
└── worker/       ← Cloudflare Worker
    ├── wrangler.toml
    └── src/
        ├── index.ts      ← router
        ├── notion.ts     ← Notion API
        ├── claude.ts     ← Claude API
        ├── telegram.ts   ← notifications
        ├── cache.ts      ← KV layer
        └── routes/
```

## Setup rapide

### 1. Notion — créer 3 bases de données

- **Tasks** : Title (title), Status (select: todo/in_progress/done), Priority (number), EstimatedMinutes (number), Project (select), DueDate (date)
- **Daily Log** : Date (date), Summary (text), PomodoroCount (number), ClaudeInsights (text)
- **Context** : Key (title), Value (text)

Crée une intégration Notion sur [notion.so/my-integrations](https://www.notion.so/my-integrations) et partage ces 3 DB avec elle.

### 2. Telegram — créer le bot

1. Parle à [@BotFather](https://t.me/BotFather) → `/newbot`
2. Récupère le token
3. Envoie un message au bot puis va sur `https://api.telegram.org/bot<TOKEN>/getUpdates` pour trouver ton `chat_id`

### 3. Worker — déployer

```bash
cd worker
npm install
# Ajouter les secrets
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put NOTION_API_KEY
npx wrangler secret put NOTION_TASKS_DB_ID
npx wrangler secret put NOTION_DAILY_LOG_DB_ID
npx wrangler secret put NOTION_CONTEXT_DB_ID
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
# Créer le KV namespace
npx wrangler kv namespace create CHIP_KV
# Mettre à jour l'ID dans wrangler.toml, puis :
npx wrangler deploy
```

### 4. PWA — déployer sur GitHub Pages

Active GitHub Pages sur ton repo : Settings → Pages → `main` / `/app`
L'app sera sur `https://owcowboy.github.io/CHIP/app/`

### 5. Installer sur iPhone

1. Ouvre Safari → ton URL GitHub Pages
2. Partager → Sur l'écran d'accueil
3. Au premier lancement, entre l'URL de ton Worker

## Développement local

```bash
cd worker && npm install && npx wrangler dev
# Tester le cron
npx wrangler dev --test-scheduled
curl http://localhost:8787/health
curl -X POST http://localhost:8787/planning -H "Content-Type: application/json" -d '{}'
```

## Roadmap

- [x] Phase 0 — Foundation (PWA skeleton + Worker stub)
- [ ] Phase 1 — Worker + Telegram opérationnels
- [ ] Phase 2 — Planning Pomodoro complet
- [ ] Phase 3 — Routine matin + Sport
- [ ] Phase 4 — Mémoire & contexte Claude
- [ ] Phase 5 — Polish UI + Chat agent