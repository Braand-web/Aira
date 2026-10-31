// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "6e88ae048b590f6f6581230bc8798eff5621a23d3ea150e185438d87a4784e40",
    "bytes": 1641,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/c46e70292664/SKILL.md": {
    "sha256": "2f3f96a4fd4992583553bd8038f0319d6343b77974a6fd4e6f1bc379bd313698",
    "bytes": 3324,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/c46e70292664/agents/openai.yaml": {
    "sha256": "18956330d62dd8999dc60c10044e9c7b76bf5d0224333ca5a269823be1b50ac8",
    "bytes": 240,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("onboarding-email",files,reference,storage);
