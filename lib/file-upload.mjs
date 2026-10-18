import { FILE_POLICY } from "./file-policy.mjs";

export function fileUploadPartCount(sizeBytes) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > FILE_POLICY.maxFileBytes) return 0;
  return Math.ceil(sizeBytes / FILE_POLICY.chunkBytes);
}

export function fileUploadPartSize(sizeBytes, partNumber) {
  const count = fileUploadPartCount(sizeBytes);
  if (!count || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > count) return 0;
  return Math.min(FILE_POLICY.chunkBytes, sizeBytes - (partNumber - 1) * FILE_POLICY.chunkBytes);
}

export function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/iu.test(value);
}

export function uploadSessionExpired(session, now = Date.now()) {
  return !session || Number(session.expires_at) <= now;
}

export function publicUploadSession(session, parts = []) {
  return {
    uploadId: session.id,
    fileId: session.file_id,
    name: session.display_name,
    size: Number(session.declared_size),
    mime: session.declared_mime,
    sha256: session.sha256,
    chunkBytes: Number(session.part_size),
    partCount: Number(session.part_count),
    uploadedParts: parts.map(part => ({
      partNumber: Number(part.part_number),
      size: Number(part.size_bytes),
      sha256: part.sha256,
    })),
    expiresAt: Number(session.expires_at),
    status: session.status,
  };
}
