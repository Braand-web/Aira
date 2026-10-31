// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "879182054b9bb46f831d39d2e2587d8f6618cb7cba5a48ddc50acf2238b43a28",
    "bytes": 1274,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/0ec027014b52/SKILL.md": {
    "sha256": "1bf5d45fd6a6390aab777229293fb05cef7cf898aac882f8955e40c378e52fcd",
    "bytes": 3552,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/0ec027014b52/agents/openai.yaml": {
    "sha256": "2570b140c41a0080edcdb323235690ae8f18b0e3c40dbe08a7dc57ce006b8cf2",
    "bytes": 204,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("pets",files,reference,storage);
