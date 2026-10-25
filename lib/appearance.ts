export const ACCENT_STORAGE_KEY = "braand-accent";
export const MODE_STORAGE_KEY = "braand-color-mode";
export const ACCENT_THEMES = [
  {id: "default", label: "Par défaut"},
  {id: "blue", label: "Bleu"},
  {id: "sky", label: "Bleu ciel"},
  {id: "purple", label: "Violet"},
  {id: "pink", label: "Rose"},
  {id: "orange", label: "Orange"},
  {id: "green", label: "Vert"},
  {id: "brown", label: "Brun"},
  {id: "monochrome", label: "Monochrome"},
] as const;

export type AccentTheme = typeof ACCENT_THEMES[number]["id"];

export function accentTheme(value: unknown): AccentTheme {
  return ACCENT_THEMES.some(theme => theme.id === value) ? value as AccentTheme : "default";
}

// Runs before the first paint. Only a known identifier is written to the document.
export const ACCENT_INIT_SCRIPT = `(()=>{let a="default";try{const v=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});if(${JSON.stringify(ACCENT_THEMES.map(theme => theme.id))}.includes(v))a=v;const m=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});if(m!==null&&!["light","dark","system"].includes(m))localStorage.removeItem(${JSON.stringify(MODE_STORAGE_KEY)})}catch{}document.documentElement.dataset.accent=a})()`;
