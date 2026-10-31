// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "019a8ccad2bae1044c2ebbfaa110b1630ffc595f94fe59b73cacfbd3bb065d78",
    "bytes": 1569,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/1ba0cd94b543/SKILL.md": {
    "sha256": "8ba35414077df131873abd5c349fd2d5541782534ce32c2002b21659aff73472",
    "bytes": 2336,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/1ba0cd94b543/agents/openai.yaml": {
    "sha256": "b96ed1ddcd99768e68bfe9230c73cbd2a8a942be1a9178cfc35dc4ed30baf8d2",
    "bytes": 311,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("onboarding-parallel-research",files,reference,storage);
