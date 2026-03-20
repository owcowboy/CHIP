import type { Env } from './index';

const NOTION_VERSION = '2022-06-28';

function notionHeaders(env: Env) {
  return {
    'Authorization': `Bearer ${env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

export interface NotionTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  estimatedMinutes: number;
  project: string;
  dueDate: string | null;
}

export async function fetchTasks(env: Env): Promise<NotionTask[]> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${env.NOTION_TASKS_DB_ID}/query`,
    {
      method: 'POST',
      headers: notionHeaders(env),
      body: JSON.stringify({
        filter: {
          property: 'Status',
          select: { does_not_equal: 'done' },
        },
        sorts: [{ property: 'Priority', direction: 'ascending' }],
        page_size: 20,
      }),
    }
  );

  if (!res.ok) {
    console.error('[Notion] fetchTasks failed:', res.status, await res.text());
    return [];
  }

  const data = await res.json() as { results: any[] };

  return data.results.map((page: any) => ({
    id: page.id,
    title: page.properties?.Title?.title?.[0]?.plain_text ?? 'Sans titre',
    status: page.properties?.Status?.select?.name ?? 'todo',
    priority: page.properties?.Priority?.number ?? 2,
    estimatedMinutes: page.properties?.EstimatedMinutes?.number ?? 25,
    project: page.properties?.Project?.select?.name ?? '',
    dueDate: page.properties?.DueDate?.date?.start ?? null,
  }));
}

export async function fetchContext(env: Env): Promise<Record<string, string>> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${env.NOTION_CONTEXT_DB_ID}/query`,
    {
      method: 'POST',
      headers: notionHeaders(env),
      body: JSON.stringify({ page_size: 50 }),
    }
  );

  if (!res.ok) return {};

  const data = await res.json() as { results: any[] };
  const context: Record<string, string> = {};

  for (const page of data.results) {
    const key = page.properties?.Key?.title?.[0]?.plain_text;
    const value = page.properties?.Value?.rich_text?.[0]?.plain_text;
    if (key && value) context[key] = value;
  }

  return context;
}

export async function markTaskDone(env: Env, taskId: string): Promise<void> {
  await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
    method: 'PATCH',
    headers: notionHeaders(env),
    body: JSON.stringify({
      properties: {
        Status: { select: { name: 'done' } },
      },
    }),
  });
}

export async function writeDailyLog(
  env: Env,
  summary: string,
  pomodoroCount: number,
  insights: string
): Promise<void> {
  await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(env),
    body: JSON.stringify({
      parent: { database_id: env.NOTION_DAILY_LOG_DB_ID },
      properties: {
        Date: { title: [{ text: { content: new Date().toISOString().split('T')[0] } }] },
        Summary: { rich_text: [{ text: { content: summary } }] },
        PomodoroCount: { number: pomodoroCount },
        ClaudeInsights: { rich_text: [{ text: { content: insights } }] },
      },
    }),
  });
}
