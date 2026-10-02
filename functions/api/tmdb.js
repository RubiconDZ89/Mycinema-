// functions/api/tmdb.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") || "/trending/all/week";

  const apiKey = env.TMDB_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Clé TMDB_API_KEY manquante dans les variables d'environnement." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const targetUrl = new URL(`https://api.themoviedb.org/3${endpoint}`);
  
  url.searchParams.forEach((value, key) => {
    if (key !== "endpoint") {
      targetUrl.searchParams.set(key, value);
    }
  });

  targetUrl.searchParams.set("api_key", apiKey);
  if (!targetUrl.searchParams.has("language")) {
    targetUrl.searchParams.set("language", "fr-FR");
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: { "Accept": "application/json" }
    });
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
