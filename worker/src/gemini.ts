import type { Env } from './index';
import type { NotionTask } from './notion';

const GEMINI_MODEL = 'gemini-2.0-flash';

function geminiUrl(env: Env): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
}

type GeminiContent = { role: 'user' | 'model'; parts: Array<{ text: string }> };

async function callGemini(
  env: Env,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<string> {
  const res = await fetch(geminiUrl(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Gemini] API error:', res.status, err);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> };
  return data.candidates[0]?.content?.parts[0]?.text ?? '';
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

  const raw = await callGemini(env, system, user, 512);

  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    console.error('[Gemini] Failed to parse planning JSON:', raw);
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

  // Convert messages to Gemini format (assistant → model)
  const contents: GeminiContent[] = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(geminiUrl(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> };
  return data.candidates[0]?.content?.parts[0]?.text ?? '';
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

const CHIP_FUNCTION = {
  name: 'respond_and_act',
  description: "Répond à l'utilisatrice et exécute des actions Notion si nécessaire.",
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Réponse en français à afficher dans Telegram. Directe, max 3 phrases sauf si planning demandé.',
      },
      actions: {
        type: 'array',
        description: 'Actions Notion à exécuter. Tableau vide si aucune action.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['create_task', 'mark_done', 'update_context', 'write_log'] },
            title: { type: 'string' },
            priority: { type: 'number' },
            estimatedMinutes: { type: 'number' },
            project: { type: 'string' },
            taskId: { type: 'string' },
            taskTitle: { type: 'string' },
            key: { type: 'string' },
            value: { type: 'string' },
            summary: { type: 'string' },
          },
          required: ['type'],
        },
      },
    },
    required: ['message', 'actions'],
  },
};

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
Tu gères son Notion automatiquement selon le contexte.

Contexte actuel :
${JSON.stringify(context, null, 2)}

Tâches en cours :
${taskList || 'Aucune tâche en cours.'}

Règles :
- Réponds en français, direct, max 3 phrases — sauf si planning demandé (là tu peux être long)
- Déduis les actions par contexte : nouvelle tâche → create_task, tâche finie → mark_done, info perso → update_context, bilan → write_log
- Pour mark_done : utilise l'ID exact de la liste ci-dessus
- Si planning demandé : génère un planning Pomodoro dans message (max 5 blocs, format Telegram avec 🍅)`;

  const contents: GeminiContent[] = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(geminiUrl(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: [CHIP_FUNCTION] }],
      toolConfig: {
        functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['respond_and_act'] },
      },
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Gemini] chatWithActions error:', res.status, err);
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json() as {
    candidates: Array<{
      content: {
        parts: Array<{
          text?: string;
          functionCall?: { name: string; args: { message: string; actions: NotionAction[] } };
        }>;
      };
    }>;
  };

  const parts = data.candidates[0]?.content?.parts ?? [];
  const fnCall = parts.find(p => p.functionCall?.name === 'respond_and_act');
  if (fnCall?.functionCall) {
    return {
      message: fnCall.functionCall.args.message ?? '…',
      actions: Array.isArray(fnCall.functionCall.args.actions) ? fnCall.functionCall.args.actions : [],
    };
  }

  // Fallback si function call absent
  const raw = parts.find(p => p.text)?.text ?? '';
  console.error('[Gemini] chatWithActions: aucun functionCall reçu, fallback texte brut:', raw);
  return { message: raw || "Je n'ai pas pu générer une réponse.", actions: [] };
}

export async function generateCheckIn(
  env: Env,
  tasks: NotionTask[],
  context: Record<string, string>,
  type: 'midday' | 'evening'
): Promise<string> {
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

    return callGemini(env, system, user, 200);
  } else {
    const system = `Tu es CHIP. Bilan de fin de journée, direct (max 4 lignes).
Tu résumes ce qui a été fait, ce qui reste, et tu poses une question sur demain.
Ton direct, pas condescendant.`;

    const user = `Tâches restantes aujourd'hui : ${remaining.slice(0, 5).map(t => t.title).join(', ') || 'aucune — bonne journée'}
Contexte : ${JSON.stringify(context)}

Génère le message de bilan soir pour Telegram.`;

    return callGemini(env, system, user, 256);
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

  const raw = await callGemini(env, system, user, 512);

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
    console.error('[Gemini] Failed to parse synthesizeDayEnd JSON:', raw);
  }

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
  context: Record<string, string>,
  rolledOver = ''
): Promise<string> {
  const system = `Tu es CHIP. Génère un brief matin court et motivant.
Direct, max 5 lignes, en français.`;

  const rolledOverLine = rolledOver
    ? `\nTâches reportées d'hier : ${rolledOver}`
    : '';

  const user = `Tâches disponibles : ${tasks.length}
Top 3 prioritaires : ${tasks.slice(0, 3).map(t => t.title).join(', ')}${rolledOverLine}
Contexte : ${JSON.stringify(context)}

Génère le brief matin pour Telegram. Inclus :
1. Une micro-tâche de démarrage (quelque chose de 5 min max)
2. Les 3 tâches du jour${rolledOver ? ' (intègre les tâches reportées)' : ''}
3. Un mot direct de motivation`;

  return callGemini(env, system, user, 256);
}
