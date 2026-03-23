import type { Env } from '../index';
import { fetchTasks, fetchContext, fetchYesterdayDailyLog } from '../notion';
import { generateMorningBrief } from '../claude';
import { sendTelegram } from '../telegram';
import { setCached, KEYS } from '../cache';
import { getWorkerConfig, cfg } from '../config';

export async function handleMorning(env: Env): Promise<Response> {
  const [tasks, context, config, yesterdayLog] = await Promise.all([
    fetchTasks(env),
    fetchContext(env),
    getWorkerConfig(env),
    fetchYesterdayDailyLog(env),
  ]);

  // Pre-cache for the day
  await setCached(env, KEYS.tasks, tasks);
  await setCached(env, KEYS.context, context, 60 * 60);

  const rolledOver = yesterdayLog?.tasksRolledOver ?? '';
  const brief = await generateMorningBrief(env, tasks, context, rolledOver);
  const deepLink = cfg(config, 'deep_link_planning', '/planning');
  const message = `🌅 *Bonjour CHIP*\n\n${brief}\n\nOuvre l'app pour ton planning 👉 ${deepLink}`;

  await sendTelegram(env, message);

  return new Response(JSON.stringify({ ok: true, brief }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
