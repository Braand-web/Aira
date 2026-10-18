import { parseOfficePreview } from "@/lib/office-preview.mjs";

type OfficeRequest = { id: string; mime: string; bytes: ArrayBuffer };

self.addEventListener("message", event => {
  const request = event.data as OfficeRequest;
  void parseOfficePreview(new Uint8Array(request.bytes), request.mime).then(result => {
    self.postMessage({ id: request.id, ok: true, result });
  }).catch(error => {
    const code = error instanceof Error ? error.message : "FILE_CORRUPT";
    self.postMessage({ id: request.id, ok: false, code });
  });
});
