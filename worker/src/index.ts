import { handleHealth } from './routes/health';
import { handlePlanning } from './routes/planning';
import { handleChat } from './routes/chat';
import { handleMorning } from './routes/morning';
import { handleTelegramWebhook } from './routes/telegram';
import { handleDayEnd, isBilanDoneToday } from './routes/day-end';

export interface Env {
  CHIP_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  NOTION_API_KEY: string;
  NOTION_TASKS_DB_ID: string;
  NOTION_DAILY_LOG_DB_ID: string;
  NOTION_CONTEXT_DB_ID: string;
  NOTION_WORKER_CONFIG_DB_ID: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let response: Response;

    if (path === '/health') {
      response = await handleHealth();
    } else if (path === '/planning' && request.method === 'POST') {
      response = await handlePlanning(request, env);
    } else if (path === '/chat' && request.method === 'POST') {
      response = await handleChat(request, env);
    } else if (path === '/morning' && request.method === 'POST') {
      response = await handleMorning(env);
    } else if (path === '/telegram' && request.method === 'POST') {
      response = await handleTelegramWebhook(request, env);
    } else if (path === '/day-end' && request.method === 'POST') {
      response = await handleDayEnd(env);
    } else {
      response = new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Attach CORS headers to every response
    const newHeaders = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },

  // Cron triggers
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();

    if (hour === 7) {
      // 9h30 Paris — morning brief
      await handleMorning(env);
    } else if (hour === 11) {
      // 13h Paris — check-in mi-journée intelligent
      const { fetchTasks, fetchContext } = await import('./notion');
      const { generateCheckIn } = await import('./claude');
      const { sendTelegram } = await import('./telegram');
      const [tasks, context] = await Promise.all([fetchTasks(env), fetchContext(env)]);
      const message = await generateCheckIn(env, tasks, context, 'midday');
      await sendTelegram(env, message);
    } else if (hour === 16) {
      // 18h Paris — bilan soir intelligent
      const { fetchTasks, fetchContext } = await import('./notion');
      const { generateCheckIn } = await import('./claude');
      const { sendTelegram } = await import('./telegram');
      const [tasks, context] = await Promise.all([fetchTasks(env), fetchContext(env)]);
      const message = await generateCheckIn(env, tasks, context, 'evening');
      await sendTelegram(env, message);
    } else if (hour === 20) {
      // 22h Paris — fallback bilan fin de journée (si pas encore fait)
      const done = await isBilanDoneToday(env);
      if (!done) {
        await handleDayEnd(env);
      }
    }
  },
};
