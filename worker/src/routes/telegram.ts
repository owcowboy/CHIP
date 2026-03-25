import type { Env } from '../index';
import { fetchTasks, fetchContext, markTaskDone, createTask, updateContext, deleteTask, writeDailyLog } from '../notion';
import { chatWithActions, generateDailyPlan, type NotionAction } from '../claude';
import { getCached, setCached } from '../cache';
import { sendTelegram } from '../telegram';
import { getBilanState, handleDayEndReply } from './day-end';

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

  // Texte libre — vérifier si on est en mode bilan de fin de journée
  const bilanState = await getBilanState(env);
  if (bilanState?.active) {
    await handleDayEndReply(env, text, bilanState);
    return new Response('ok');
  }

  // Texte libre → Claude avec actions Notion automatiques
  const [history, tasks, context] = await Promise.all([
    getHistory(env, chatId),
    fetchTasks(env),
    fetchContext(env),
  ]);

  const updatedHistory: ChatMessage[] = [...history, { role: 'user', content: text }];
  const result = await chatWithActions(env, updatedHistory, context, tasks);

  // Envoyer la réponse + sauvegarder historique en parallèle
  await Promise.all([
    sendTelegram(env, result.message),
    saveHistory(env, chatId, [...updatedHistory, { role: 'assistant', content: result.message }]),
  ]);

  // Exécuter les actions Notion (sans bloquer la réponse)
  if (result.actions.length > 0) {
    await Promise.allSettled(result.actions.map(action => executeNotionAction(env, action)));
    // Invalider le cache des tâches si des tâches ont été modifiées
    const tasksMutated = result.actions.some(a =>
      a.type === 'create_task' || a.type === 'mark_done'
    );
    if (tasksMutated) {
      await env.CHIP_KV.delete('tasks');
    }
  }

  return new Response('ok');
}

async function executeNotionAction(env: Env, action: NotionAction): Promise<void> {
  switch (action.type) {
    case 'create_task':
      await createTask(env, action.title, action.priority, action.estimatedMinutes, action.project);
      break;
    case 'mark_done':
      await markTaskDone(env, action.taskId);
      break;
    case 'update_context':
      await updateContext(env, action.key, action.value);
      break;
    case 'write_log':
      await writeDailyLog(env, action.summary, 0, '');
      break;
  }
}
