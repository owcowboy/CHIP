import type { Env } from '../index';
import { fetchTasks, fetchContext } from '../notion';
import { chat, generateDailyPlan } from '../claude';
import { getCached, setCached } from '../cache';
import { sendTelegram } from '../telegram';

interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const HISTORY_TTL = 60 * 60 * 24; // 24h
const MAX_HISTORY = 20;

async function getHistory(env: Env, chatId: number): Promise<ChatMessage[]> {
  return (await getCached<ChatMessage[]>(env, `tg:history:${chatId}`)) ?? [];
}

async function saveHistory(env: Env, chatId: number, history: ChatMessage[]): Promise<void> {
  await setCached(env, `tg:history:${chatId}`, history.slice(-MAX_HISTORY), HISTORY_TTL);
}

function formatTasks(tasks: Awaited<ReturnType<typeof fetchTasks>>): string {
  if (tasks.length === 0) return '✅ Aucune tâche en cours.';
  return tasks.slice(0, 10).map((t, i) =>
    `${i + 1}. [P${t.priority}] ${t.title}${t.estimatedMinutes ? ` (${t.estimatedMinutes}min)` : ''}`
  ).join('\n');
}

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return new Response('ok');
  }

  const message = update.message;
  if (!message?.text) return new Response('ok');

  const chatId = message.chat.id;

  // Sécurité : ignorer les messages qui ne viennent pas du chat configuré
  if (String(chatId) !== env.TELEGRAM_CHAT_ID) return new Response('ok');

  const text = message.text.trim();

  if (text === '/start' || text === '/aide') {
    await sendTelegram(env,
      `*CHIP — Commandes disponibles*\n\n` +
      `/taches — Liste tes tâches en cours\n` +
      `/planning — Génère le planning Pomodoro du jour\n` +
      `/aide — Ce message\n\n` +
      `Ou parle-moi directement — je connais ton contexte Notion.`
    );
    return new Response('ok');
  }

  if (text === '/taches') {
    const tasks = await fetchTasks(env);
    await sendTelegram(env, `*Tâches en cours :*\n\n${formatTasks(tasks)}`);
    return new Response('ok');
  }

  if (text === '/planning') {
    const [tasks, context] = await Promise.all([fetchTasks(env), fetchContext(env)]);
    const plan = await generateDailyPlan(env, tasks, context);
    if (plan.length === 0) {
      await sendTelegram(env, 'Pas de planning généré. Vérifie tes tâches dans Notion.');
    } else {
      const msg = plan.map(b =>
        `▸ *${b.taskName}* — ${b.pomodoroCount} 🍅 (${b.estimatedMinutes}min)\n_${b.notes}_`
      ).join('\n\n');
      await sendTelegram(env, `*Planning du jour :*\n\n${msg}`);
    }
    return new Response('ok');
  }

  // Texte libre → Claude chat avec historique persisté en KV (24h)
  const [history, tasks, context] = await Promise.all([
    getHistory(env, chatId),
    fetchTasks(env),
    fetchContext(env),
  ]);

  const updatedHistory: ChatMessage[] = [...history, { role: 'user', content: text }];
  const reply = await chat(env, updatedHistory, context, tasks);

  await Promise.all([
    sendTelegram(env, reply),
    saveHistory(env, chatId, [...updatedHistory, { role: 'assistant', content: reply }]),
  ]);

  return new Response('ok');
}
