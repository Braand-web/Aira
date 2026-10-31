// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "1a71fd9744a97cef8582c00a02fc2ff513bba3dcdbf7da3ab6da66569289b7e5",
    "bytes": 1611,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/7cc96484416a/SKILL.md": {
    "sha256": "28e7bb84b127081fde31edd21241be039aff44b3bf3a6b1170150bc70d756de0",
    "bytes": 7613,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/7cc96484416a/agents/openai.yaml": {
    "sha256": "a026a7b8ac41f10bd8c9abea10b4ce03274a20f087abf2d0adc591970d2de6a1",
    "bytes": 223,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("resolve-recipients",files,reference,storage);
