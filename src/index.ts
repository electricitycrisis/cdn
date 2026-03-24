export interface Env {
  ASSET_ORIGIN: string; 
}

const CACHE_TTL = 60 * 60 * 24 * 365; // 1 year

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Only handle static assets
    if (isAsset(url.pathname)) {
      return handleAsset(request, env, ctx);
    }

    // Optional: block everything else
    return new Response("Not Found", { status: 404 });
  },
};

function isAsset(path: string): boolean {
  return (
    path.startsWith("/assets") ||
    path.startsWith("/fonts") ||
    path.endsWith(".js") ||
    path.endsWith(".css") ||
    path.endsWith(".woff2") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".svg")
  );
}

async function handleAsset(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const originUrl = `${env.ASSET_ORIGIN}${url.pathname}${url.search}`;

  const cache = caches.default;
  const cacheKey = new Request(originUrl, request);


  let cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }


  const originResponse = await fetch(originUrl, {
    cf: {
      cacheEverything: true,
      cacheTtl: CACHE_TTL,
      polish: "on", 
      minify: {
        javascript: true,
        css: true,
        html: false,
      },
    },
  });


  const response = new Response(originResponse.body, originResponse);


  response.headers.set(
    "Cache-Control",
    "public, max-age=31536000, immutable"
  );


  response.headers.set("Access-Control-Allow-Origin", "*");


  if (url.pathname.endsWith(".woff2")) {
    response.headers.set("Content-Type", "font/woff2");
  }


  if (url.pathname.endsWith(".woff2")) {
    response.headers.append(
      "Link",
      `<${url.pathname}>; rel=preload; as=font; type="font/woff2"; crossorigin`
    );
  }
  response.headers.set("Vary", "Accept-Encoding");
  ctx.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}