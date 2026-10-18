declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    COMPOSIO_API_KEY?: string;
    COMPOSIO_AUTH_CONFIGS_JSON?: string;
    COMPOSIO_INSTANT_ENABLED?: string;
    COMPOSIO_INSTANT_CATALOG_JSON?: string;
    BUCKET?: R2Bucket;
    FILE_PREVIEW_V1?: string;
    FILE_URL_SIGNING_SECRET?: string;
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_MODEL?: string;
    ANTHROPIC_RATE_JSON?: string;
    LLM_PROVIDER?: string;
    OPENROUTER_API_KEY?: string;
    OPENROUTER_MODEL?: string;
    OPENROUTER_RATE_JSON?: string;
    FAL_KEY?: string;
    FAL_CATALOG_JSON?: string;
    META_APP_ID?: string;
    META_APP_SECRET?: string;
    META_GRAPH_VERSION?: string;
    META_REDIRECT_URI?: string;
    TOKEN_ENCRYPTION_KEY?: string;
    SCHEDULER_SECRET?: string;
    PAGES_ORIGIN?: string;
  }
}
