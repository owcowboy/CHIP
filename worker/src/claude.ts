import type { Env } from './index';
import type { NotionTask } from './notion';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

async function callClaude(
  env: Env,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<string> {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Claude] API error:', res.status, err);
    throw new Error(`Claude API error: ${res.status}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content[0]?.text ?? '';
}

export interface PomodoroBlock {
  taskId: string;
  taskName: string;
  pomodoroCount: number;
  estimatedMinutes: number;
  priority: number;
  notes: string;
}

export async function generateDailyPlan(
  env: Env,
  tasks: NotionTask[],
  context: Record<string, string>
): Promise<PomodoroBlock[]> {
  const system = `Tu es CHIP, assistant personnel direct et sans fioritures.
Tu génères des plannings Pomodoro clairs et réalistes.
Réponds UNIQUEMENT avec du JSON valide, aucun texte avant ou après.`;

  const user = `Tâches disponibles :
${JSON.stringify(tasks, null, 2)}

Contexte utilisateur :
${JSON.stringify(context, null, 2)}

Génère le planning Pomodoro pour aujourd'hui.
Règles :
- Max 5 blocs
- Commence par les tâches prioritaires (priority=1)
- Chaque Pomodoro = 25 minutes
- Sois réaliste sur les estimations
- Les notes doivent être courtes et directes

Retourne un tableau JSON avec cette structure exacte :
[{"taskId":"...","taskName":"...","pomodoroCount":2,"estimatedMinutes":50,"priority":1,"notes":"..."}]`;

  const raw = await callClaude(env, 'claude-haiku-4-5-20251001', system, user, 512);

  try {
    // Extract JSON if wrapped in markdown code blocks
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    console.error('[Claude] Failed to parse planning JSON:', raw);
    return [];
  }
}

export async function chat(
  env: Env,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: Record<string, string>,
  tasks: NotionTask[]
): Promise<string> {
  const system = `Tu es CHIP — Contextual Hub for Intelligence & Productivity.
Tu es l'assistant personnel de l'utilisatrice. Direct, efficace, sans bullshit.
Tu connais ses projets, ses habitudes, et son planning du jour.

Contexte actuel :
${JSON.stringify(context, null, 2)}

Tâches du jour :
${JSON.stringify(tasks.slice(0, 10), null, 2)}

Règles :
- Réponds en français
- Sois direct, maximum 3 phrases sauf si plus est nécessaire
- Si elle demande à modifier le planning, propose un JSON mis à jour
- Si elle dit qu'une tâche est finie, confirme et mets à jour`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content[0]?.text ?? '';
}

export async function generateMorningBrief(
  env: Env,
  tasks: NotionTask[],
  context: Record<string, string>
): Promise<string> {
  const system = `Tu es CHIP. Génère un brief matin court et motivant.
Direct, max 5 lignes, en français.`;

  const user = `Tâches disponibles : ${tasks.length}
Top 3 prioritaires : ${tasks.slice(0, 3).map(t => t.title).join(', ')}
Contexte : ${JSON.stringify(context)}

Génère le brief matin pour Telegram. Inclus :
1. Une micro-tâche de démarrage (quelque chose de 5 min max)
2. Les 3 tâches du jour
3. Un mot direct de motivation`;

  return callClaude(env, 'claude-haiku-4-5-20251001', system, user, 256);
}
