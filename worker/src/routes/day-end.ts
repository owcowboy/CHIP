import type { Env } from '../index';
import type { NotionTask } from '../notion';
import {
  fetchTasks,
  fetchYesterdayDailyLog,
  writeDailyLogEnriched,
  markTaskRolledOver,
} from '../notion';
import { synthesizeDayEnd } from '../gemini';
import { sendTelegram } from '../telegram';
import { getCached, setCached, invalidate, KEYS } from '../cache';
import { getWorkerConfig, cfg } from '../config';

export const BILAN_STATE_KEY = 'bilan:state';
const BILAN_TTL = 60 * 60 * 4; // 4h pour répondre

export interface BilanState {
  active: boolean;
  tasks: NotionTask[];
  yesterdayRolledOver: string;
}

/**
 * POST /day-end — déclenché par la PWA (tous les Pomodoros validés) ou cron fallback.
 * Envoie le prompt bilan à Telegram et stocke l'état en KV.
 */
export async function handleDayEnd(env: Env): Promise<Response> {
  const [tasks, yesterdayLog, config] = await Promise.all([
    fetchTasks(env),
    fetchYesterdayDailyLog(env),
    getWorkerConfig(env),
  ]);

  const state: BilanState = {
    active: true,
    tasks,
    yesterdayRolledOver: yesterdayLog?.tasksRolledOver ?? '',
  };

  await setCached(env, BILAN_STATE_KEY, state, BILAN_TTL);

  const prompt = cfg(
    config,
    'msg_day_end_prompt',
    "Journée terminée. On fait le bilan — t'as fait quoi aujourd'hui ?"
  );
  await sendTelegram(env, prompt);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Appelée depuis le handler Telegram quand le bilan est actif.
 * Claude synthétise → écriture Notion → confirmation Telegram.
 */
export async function handleDayEndReply(
  env: Env,
  userMessage: string,
  state: BilanState
): Promise<void> {
  const synthesis = await synthesizeDayEnd(
    env,
    userMessage,
    state.tasks,
    state.yesterdayRolledOver
  );

  // Écriture Daily Log enrichi
  await writeDailyLogEnriched(
    env,
    synthesis.summary,
    0,
    synthesis.message,
    synthesis.tasksCompleted,
    synthesis.tasksRolledOver,
    synthesis.freeNotes,
    synthesis.energyLevel
  );

  // Marquer les tâches non-finies comme rolled_over
  const remaining = state.tasks.filter(t => t.status !== 'done');
  await Promise.allSettled(remaining.map(t => markTaskRolledOver(env, t.id)));

  // Invalider le cache des tâches + effacer l'état bilan
  await Promise.all([
    invalidate(env, KEYS.tasks),
    invalidate(env, BILAN_STATE_KEY),
    markBilanDoneToday(env),
  ]);

  await sendTelegram(env, `${synthesis.message}\n\n✅ Bilan enregistré dans Notion.`);
}

export async function getBilanState(env: Env): Promise<BilanState | null> {
  return getCached<BilanState>(env, BILAN_STATE_KEY);
}

function todayDoneKey(): string {
  return `bilan:done:${new Date().toISOString().split('T')[0]}`;
}

export async function isBilanDoneToday(env: Env): Promise<boolean> {
  const val = await getCached<boolean>(env, todayDoneKey());
  return val === true;
}

async function markBilanDoneToday(env: Env): Promise<void> {
  await setCached(env, todayDoneKey(), true, 60 * 60 * 26); // expire après 26h
}
