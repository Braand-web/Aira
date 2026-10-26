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
      return application.fetch(new Request(request, {headers}), env, context);
    },
  };
}
