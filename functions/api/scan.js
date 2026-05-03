export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_KEY) {
    return new Response(
      JSON.stringify({ error: { message: "Server missing ANTHROPIC_KEY" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.text();

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
