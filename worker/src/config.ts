import type { Env } from './index';
import { fetchWorkerConfig } from './notion';
import { getCached, setCached, KEYS } from './cache';

const DEFAULT_TTL = 3600;

/**
 * Retourne la Worker Config depuis KV (cache) ou Notion.
 * TTL défini par la clé kv_ttl_worker_config dans Notion (défaut 3600s).
 */
export async function getWorkerConfig(env: Env): Promise<Record<string, string>> {
  const cached = await getCached<Record<string, string>>(env, KEYS.workerConfig);
  if (cached) return cached;

  const config = await fetchWorkerConfig(env);
  const ttl = parseInt(config['kv_ttl_worker_config'] ?? String(DEFAULT_TTL), 10);
  await setCached(env, KEYS.workerConfig, config, isNaN(ttl) ? DEFAULT_TTL : ttl);

  return config;
}

/**
 * Lit une clé depuis la Worker Config avec fallback garanti (pas de crash).
 */
export function cfg(config: Record<string, string>, key: string, fallback: string): string {
  return config[key] ?? fallback;
}
