// Generated manifest members only; payloads remain in private R2.
import {loadPackedReference} from "../pack-storage.mjs";
export const files = {
  "SKILL.md": {
    "sha256": "bd0e5dc4b35ba5b245a8517a76415d32814e1af21aecc3fe13ae9c7cf38c89db",
    "bytes": 1364,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/7a57cda05728/LICENSE.txt": {
    "sha256": "58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd",
    "bytes": 11357,
    "text": true,
    "mime": "text/plain"
  },
  "imports/7a57cda05728/SKILL.md": {
    "sha256": "81c5002c6643b0de7b8710b00e7a9038daa6fb9b68d59870ee6adb12da8d10f8",
    "bytes": 3087,
    "text": true,
    "mime": "text/markdown"
  },
  "imports/7a57cda05728/scripts/bundle-artifact.sh": {
    "sha256": "abf0e480bf6585b56fab8526a407dfb7dc740812bddd70c636e1e8f3df5f9618",
    "bytes": 1517,
    "text": true,
    "mime": "application/x-sh"
  },
  "imports/7a57cda05728/scripts/init-artifact.sh": {
    "sha256": "355e5dd4382aaaee91f01f1627eaeab30b2676ffa8d9b3ec328a1ae450ebccaa",
    "bytes": 9924,
    "text": true,
    "mime": "application/x-sh"
  },
  "imports/7a57cda05728/scripts/shadcn-components.tar.gz": {
    "sha256": "1296f069e825de7933de7e8ac63672495cacce3f88f2dc45554dbcddbcbca60f",
    "bytes": 19967,
    "text": false,
    "mime": "application/x-tar"
  }
};
export const load = (reference,storage) => loadPackedReference("web-artifacts-builder",files,reference,storage);
