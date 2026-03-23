import type { Env } from '../index';
import { fetchTasks, fetchContext } from '../notion';
import { chat } from '../gemini';
import { getCached, setCached, KEYS } from '../cache';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { messages: ChatMessage[] };

  if (!body.messages || body.messages.length === 0) {
    return json({ error: 'messages requis' }, 400);
  }

  let tasks = await getCached<Awaited<ReturnType<typeof fetchTasks>>>(env, KEYS.tasks);
  if (!tasks) {
    tasks = await fetchTasks(env);
    await setCached(env, KEYS.tasks, tasks);
  }

  let context = await getCached<Record<string, string>>(env, KEYS.context);
  if (!context) {
    context = await fetchContext(env);
    await setCached(env, KEYS.context, context, 60 * 60);
  }

  const reply = await chat(env, body.messages, context, tasks);
  return json({ reply });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
