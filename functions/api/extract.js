// functions/api/extract.js

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  const tmdbId = url.searchParams.get("id");
  const type = url.searchParams.get("type") || "movie";
  const season = url.searchParams.get("season") || "1";
  const episode = url.searchParams.get("episode") || "1";
  const targetStream = url.searchParams.get("streamUrl");

  // CAS 1 : Relais HLS / Bypass CORS
  if (targetStream) {
    try {
      const targetHeaderReferer = url.searchParams.get("referer") || "https://vidsrc.to/";
      const streamResponse = await fetch(targetStream, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": targetHeaderReferer,
          "Origin": new URL(targetHeaderReferer).origin
        }
      });

      const newHeaders = new Headers(streamResponse.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      
      return new Response(streamResponse.body, {
        status: streamResponse.status,
        headers: newHeaders
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Échec du relais de flux." }), { status: 500 });
    }
  }

  // CAS 2 : Génération des sources d'intégration
  if (!tmdbId) {
    return new Response(JSON.stringify({ error: "Paramètre 'id' requis." }), { status: 400 });
  }

  const queryPath = type === "tv" ? `tv/${tmdbId}/${season}/${episode}` : `movie/${tmdbId}`;

  const sources = [
    {
      name: "VidSrc Pro",
      quality: "1080p",
      embedUrl: `https://vidsrc.pro/embed/${queryPath}`,
      type: "iframe"
    },
    {
      name: "SmashyStream",
      quality: "1080p / Multi",
      embedUrl: `https://player.smashy.stream/${type}/${tmdbId}${type === 'tv' ? `?s=${season}&e=${episode}` : ''}`,
      type: "iframe"
    },
    {
      name: "2Embed",
      quality: "720p / 1080p",
      embedUrl: `https://www.2embed.cc/embed${type === 'tv' ? 'tv' : ''}/${tmdbId}${type === 'tv' ? `?s=${season}&e=${episode}` : ''}`,
      type: "iframe"
    }
  ];

  return new Response(JSON.stringify({ sources }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
