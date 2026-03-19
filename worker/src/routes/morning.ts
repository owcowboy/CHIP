import type { Env } from '../index';
import { fetchTasks, fetchContext } from '../notion';
import { generateMorningBrief } from '../claude';
import { sendTelegram } from '../telegram';
import { setCached, KEYS } from '../cache';

export async function handleMorning(env: Env): Promise<Response> {
  const tasks = await fetchTasks(env);
  const context = await fetchContext(env);

  // Pre-cache for the day
  await setCached(env, KEYS.tasks, tasks);
  await setCached(env, KEYS.context, context, 60 * 60);

  const brief = await generateMorningBrief(env, tasks, context);
  const message = `🌅 *Bonjour CHIP*\n\n${brief}\n\nOuvre l'app pour ton planning 👉`;

  await sendTelegram(env, message);

  return new Response(JSON.stringify({ ok: true, brief }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
