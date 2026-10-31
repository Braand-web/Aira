// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "7c46aee550911f75f716aa6ef5cc87facde6b6383e11d314c47698266ed06a5e",
    "bytes": 1237,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/91bd8c3ea069/SKILL.md": {
    "sha256": "f425ecc387cc75abe4180a4a7c3f3bc6b51cd08c22302f75c66df8e0b5b28f92",
    "bytes": 2167,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/91bd8c3ea069/skill.yaml": {
    "sha256": "c512b30ee5f43b03a0e1e0dc218465d0ea916f838a6067f261442a6670a17ee1",
    "bytes": 302,
    "text": true,
    "mime": "text/plain"
  }
};
export const load = (reference,storage) => loadPackedReference("totp-login-handoff",files,reference,storage);
