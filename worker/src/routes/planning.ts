import type { Env } from '../index';
import { fetchTasks, fetchContext, markTaskDone } from '../notion';
import { generateDailyPlan } from '../claude';
import { getCached, setCached, invalidate, KEYS } from '../cache';

export async function handlePlanning(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { action?: string; taskId?: string };

  // Mark task done
  if (body.action === 'complete' && body.taskId) {
    await markTaskDone(env, body.taskId);
    await invalidate(env, KEYS.tasks);
    await invalidate(env, KEYS.todayPlan);
    return json({ ok: true });
  }

  // Return cached plan if available
  const cached = await getCached(env, KEYS.todayPlan);
  if (cached) return json({ plan: cached, cached: true });

  // Fetch tasks (with 5-min cache)
  let tasks = await getCached<Awaited<ReturnType<typeof fetchTasks>>>(env, KEYS.tasks);
  if (!tasks) {
    tasks = await fetchTasks(env);
    await setCached(env, KEYS.tasks, tasks);
  }

  let context = await getCached<Record<string, string>>(env, KEYS.context);
  if (!context) {
    context = await fetchContext(env);
    await setCached(env, KEYS.context, context, 60 * 60); // 1h cache for context
  }

  if (tasks.length === 0) {
    return json({ plan: [], message: 'Aucune tâche en attente dans Notion.' });
  }

  const plan = await generateDailyPlan(env, tasks, context);
  await setCached(env, KEYS.todayPlan, plan, 60 * 30); // cache plan 30min

  return json({ plan, cached: false });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
