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

export type NotionAction =
  | { type: 'create_task'; title: string; priority?: number; estimatedMinutes?: number; project?: string }
  | { type: 'mark_done'; taskId: string; taskTitle: string }
  | { type: 'update_context'; key: string; value: string }
  | { type: 'write_log'; summary: string };

export interface ChatResult {
  message: string;
  actions: NotionAction[];
}

export async function chatWithActions(
  env: Env,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: Record<string, string>,
  tasks: NotionTask[]
): Promise<ChatResult> {
  const taskList = tasks.slice(0, 10).map(t =>
    `- [${t.id}] "${t.title}" (priorité ${t.priority}, ${t.estimatedMinutes}min${t.project ? `, projet: ${t.project}` : ''})`
  ).join('\n');

  const system = `Tu es CHIP — assistant personnel de l'utilisatrice. Direct, efficace, sans bullshit.
Tu gères son Notion automatiquement selon le contexte — sans qu'elle ait besoin de te le demander explicitement.

Contexte actuel :
${JSON.stringify(context, null, 2)}

Tâches en cours :
${taskList || 'Aucune tâche en cours.'}

INSTRUCTIONS :
- Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
  {"message": "ta réponse en français", "actions": [...]}
- "message" : ta réponse à afficher (français, direct, max 3 phrases — sauf si on te demande un programme/planning, là tu peux être plus long)
- "actions" : tableau d'actions Notion à exécuter (peut être vide [])
- Déduis les actions par contexte — si elle mentionne une nouvelle tâche, crée-la ; si une tâche est finie, marque-la done ; si elle donne une info sur elle, mets à jour le contexte ; si elle fait un bilan, écris dans le journal.
- Pour "mark_done" : utilise l'ID exact de la tâche dans la liste ci-dessus. Si tu ne trouves pas l'ID exact, n'inclus pas l'action.
- Si elle demande un programme ou planning de la journée : génère un planning Pomodoro structuré dans "message" (max 5 blocs, format lisible Telegram avec émojis 🍅), en te basant sur les tâches disponibles ET celles qu'elle mentionne dans la conversation. Crée dans Notion les tâches qu'elle mentionne qui n'existent pas encore.

Types d'actions disponibles :
{"type":"create_task","title":"...","priority":1,"estimatedMinutes":25,"project":"..."}
{"type":"mark_done","taskId":"...","taskTitle":"..."}
{"type":"update_context","key":"...","value":"..."}
{"type":"write_log","summary":"..."}`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const raw = data.content[0]?.text ?? '';

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        message: parsed.message ?? raw,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    }
  } catch {
    console.error('[Claude] Failed to parse chatWithActions JSON:', raw);
  }

  // Fallback : réponse brute, aucune action
  return { message: raw, actions: [] };
}

export async function generateCheckIn(
  env: Env,
  tasks: NotionTask[],
  context: Record<string, string>,
  type: 'midday' | 'evening'
): Promise<string> {
  const done = tasks.filter(t => t.status === 'done');
  const remaining = tasks.filter(t => t.status !== 'done');
  const next = remaining[0];

  if (type === 'midday') {
    const system = `Tu es CHIP. Check-in mi-journée, direct et court (max 3 lignes).
Tu vois les tâches restantes et tu rappelles la prochaine priorité.
Pose UNE seule question de check-in. Ton direct, pas de fioriture.`;

    const user = `Tâches restantes : ${remaining.slice(0, 5).map(t => t.title).join(', ') || 'aucune'}
Prochaine priorité : ${next?.title ?? 'rien'}
Contexte : ${JSON.stringify(context)}

Génère le message de check-in mi-journée pour Telegram.`;

    return callClaude(env, 'claude-haiku-4-5-20251001', system, user, 200);
  } else {
    const system = `Tu es CHIP. Bilan de fin de journée, direct (max 4 lignes).
Tu résumes ce qui a été fait, ce qui reste, et tu poses une question sur demain.
Ton direct, pas condescendant.`;

    const user = `Tâches restantes aujourd'hui : ${remaining.slice(0, 5).map(t => t.title).join(', ') || 'aucune — bonne journée'}
Contexte : ${JSON.stringify(context)}

Génère le message de bilan soir pour Telegram.`;

    return callClaude(env, 'claude-haiku-4-5-20251001', system, user, 256);
  }
}

export interface DayEndSynthesis {
  message: string;
  summary: string;
  tasksCompleted: string;
  tasksRolledOver: string;
  freeNotes: string;
  energyLevel: 'Bas' | 'Moyen' | 'Haut';
}

export async function synthesizeDayEnd(
  env: Env,
  userReply: string,
  tasks: NotionTask[],
  yesterdayRolledOver: string
): Promise<DayEndSynthesis> {
  const done = tasks.filter(t => t.status === 'done');
  const remaining = tasks.filter(t => t.status !== 'done');

  const system = `Tu es CHIP. L'utilisatrice vient de décrire sa journée.
Analyse son message et génère un bilan structuré.
Réponds UNIQUEMENT en JSON valide, sans markdown.`;

  const user = `Tâches marquées "done" aujourd'hui : ${done.map(t => t.title).join(', ') || 'aucune'}
Tâches encore ouvertes : ${remaining.map(t => t.title).join(', ') || 'aucune'}
Tâches reportées d'hier : ${yesterdayRolledOver || 'aucune'}
Message de l'utilisatrice : "${userReply}"

Génère le bilan en JSON :
{"message":"ta réponse directe (2-3 lignes max)","summary":"résumé objectif (1 phrase)","tasksCompleted":"tâches finies séparées par virgules","tasksRolledOver":"tâches reportées demain séparées par virgules","freeNotes":"notes libres extraites du message","energyLevel":"Bas|Moyen|Haut"}`;

  const raw = await callClaude(env, 'claude-haiku-4-5-20251001', system, user, 512);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const validLevels = ['Bas', 'Moyen', 'Haut'];
      return {
        message: parsed.message ?? 'Bilan enregistré.',
        summary: parsed.summary ?? '',
        tasksCompleted: parsed.tasksCompleted ?? done.map(t => t.title).join(', '),
        tasksRolledOver: parsed.tasksRolledOver ?? remaining.map(t => t.title).join(', '),
        freeNotes: parsed.freeNotes ?? userReply,
        energyLevel: validLevels.includes(parsed.energyLevel) ? parsed.energyLevel : 'Moyen',
      };
    }
  } catch {
    console.error('[Claude] Failed to parse synthesizeDayEnd JSON:', raw);
  }

  // Fallback sûr
  return {
    message: 'Bilan enregistré.',
    summary: userReply.slice(0, 200),
    tasksCompleted: done.map(t => t.title).join(', '),
    tasksRolledOver: remaining.map(t => t.title).join(', '),
    freeNotes: userReply,
    energyLevel: 'Moyen',
  };
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
