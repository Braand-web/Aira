// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "7e94be83fea260ae02007e3137b1ae50311a2664a0c6f56dff78121d68a08a67",
    "bytes": 1645,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/cb85f671fe35/SKILL.md": {
    "sha256": "be610de73e55af8d7649cf878e19dc71a29c69cfd957f2a07d579f08a04ec0ae",
    "bytes": 3472,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/cb85f671fe35/agents/openai.yaml": {
    "sha256": "a1d640101bc8322aa9b13295ff2e90fc724cca9d4f37454c83fcc70bddaf4edc",
    "bytes": 261,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("onboarding-messaging",files,reference,storage);
