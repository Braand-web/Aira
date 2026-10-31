// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "165e54989677aa73e3606c0f5f6cd195560fe8b6fd03014810020408e65f2bf5",
    "bytes": 1689,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/bb9b49d64802/SKILL.md": {
    "sha256": "a4b4adf5b7aa565efdf9f61f77275043e9f609a0c4a254d1fcfb49e6a377ed0a",
    "bytes": 5443,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/bb9b49d64802/agents/openai.yaml": {
    "sha256": "45ad891fba1c0f029f7e259e7ca9c3c678f8266de5f252ad8b7bb74f51e77c24",
    "bytes": 255,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("onboarding-artifact-creation",files,reference,storage);
