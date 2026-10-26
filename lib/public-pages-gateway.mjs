// Dedicated origin: the public host never exposes the SaaS, auth or private APIs.
export function publicPagesGateway(application) {
  return {
    async fetch(request, env, context) {
      const url = new URL(request.url);
      if (url.origin !== env.PAGES_ORIGIN || !/^\/api\/published\/[a-zA-Z0-9_-]{1,160}$/.test(url.pathname)) {
        return new Response('Page introuvable.', {status: 404, headers: {'Cache-Control': 'no-store'}});
      }
      if (!['GET', 'POST'].includes(request.method)) {
        return new Response('Méthode non autorisée.', {status: 405, headers: {Allow: 'GET, POST'}});
      }
      // Browser sessions and identity headers have no role on a public origin.
      const headers = new Headers(request.headers);
      for (const name of [...headers.keys()]) {
        if (['cookie', 'authorization', 'x-braand-workspace'].includes(name) || name.startsWith('x-braand-identity-') || name.startsWith('oai-authenticated-user-')) headers.delete(name);
      }
      let body;
      if (request.method === 'POST') {
        // Match the existing form limit before the handler buffers any input,
        // including requests sent without a Content-Length header.
        const parts = [], reader = request.body?.getReader();
        let size = 0;
        if (reader) {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.byteLength;
            if (size > 8192) {
              await reader.cancel();
              return new Response('Formulaire trop volumineux.', {status: 413});
            }
            parts.push(next.value);
          }
        }
        body = new Uint8Array(size);
        let offset = 0;
        for (const part of parts) {body.set(part, offset); offset += part.byteLength;}
      }
      return application.fetch(new Request(request, {headers, ...(body ? {body} : {})}), env, context);
    },
  };
}
