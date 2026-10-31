// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "bd5eaf89fa12552e76418e137256cf96f78fbbbbb2221c9bc8da304a7d7455a5",
    "bytes": 1326,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/cafa7f033c02/SKILL.md": {
    "sha256": "c63c98d67b6ad781a72a8f9837ba1fb5e2d2a8054a2562e4025890a97d8a0e67",
    "bytes": 4272,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/cafa7f033c02/agents/openai.yaml": {
    "sha256": "b031edf7b860302fc56ff938ee90906dd09e9d6c3e44447847a068417eaf80b9",
    "bytes": 220,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("update-pet",files,reference,storage);
