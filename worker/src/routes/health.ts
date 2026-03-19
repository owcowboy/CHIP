export async function handleHealth(): Promise<Response> {
  return new Response(
    JSON.stringify({ status: 'ok', service: 'CHIP Worker', version: '0.1.0' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
