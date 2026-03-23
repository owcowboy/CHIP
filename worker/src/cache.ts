import type { Env } from './index';

const TTL_5MIN = 60 * 5;
const TTL_1H = 60 * 60;

export async function getCached<T>(env: Env, key: string): Promise<T | null> {
  const val = await env.CHIP_KV.get(key, 'json');
  return val as T | null;
}

export async function setCached<T>(
  env: Env,
  key: string,
  value: T,
  ttl = TTL_5MIN
): Promise<void> {
  await env.CHIP_KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

export async function invalidate(env: Env, key: string): Promise<void> {
  await env.CHIP_KV.delete(key);
}

export const KEYS = {
  tasks: 'cache:tasks',
  context: 'cache:context',
  todayPlan: 'plan:today',
  workerConfig: 'cache:worker-config',
};
