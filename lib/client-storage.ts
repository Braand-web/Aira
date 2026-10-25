const APP_PREFIX = "braand";
const LEGACY_PREFIX = ["ai", "ra"].join("");
let migrated = false;

/** Move browser-owned preferences and drafts once, retaining their exact values. */
export function migrateLegacyBrowserStorage() {
  if (typeof window === "undefined" || migrated) return;
  migrated = true;
  try {
    const legacyPrefix = `${LEGACY_PREFIX}.`;
    const entries: Array<[string, string]> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(legacyPrefix)) {
        const value = localStorage.getItem(key);
        if (value !== null) entries.push([key, value]);
      }
    }
    for (const [legacyKey, value] of entries) {
      const nextKey = `${APP_PREFIX}${legacyKey.slice(LEGACY_PREFIX.length)}`;
      if (localStorage.getItem(nextKey) === null) localStorage.setItem(nextKey, value);
      localStorage.removeItem(legacyKey);
    }

    const legacyCookie = [LEGACY_PREFIX, "_workspace"].join("");
    const nextCookie = "braand_workspace";
    const cookies = document.cookie.split(";").map((item) => item.trim());
    const oldValue = cookies.find((item) => item.startsWith(`${legacyCookie}=`))?.slice(legacyCookie.length + 1);
    if (oldValue !== undefined) {
      if (!cookies.some((item) => item.startsWith(`${nextCookie}=`))) {
        document.cookie = `${nextCookie}=${oldValue}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      }
      document.cookie = `${legacyCookie}=; Path=/; SameSite=Lax; Max-Age=0${location.protocol === "https:" ? "; Secure" : ""}`;
    }
  } catch {
    // Storage can be disabled; the app can still continue without local state.
  }
}

export function readBraandStorage(key: string): string | null {
  migrateLegacyBrowserStorage();
  try { return localStorage.getItem(key); } catch { return null; }
}
