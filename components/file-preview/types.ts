export type PreviewFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  status: string;
  createdAt?: number;
};

export type PreviewScope = "content" | "download" | "thumbnail";

export function previewFileFromResource(resource: {
  id: string;
  title: string;
  status: string;
  data?: Record<string, unknown>;
  created_at?: number;
}): PreviewFile {
  return {
    id: resource.id,
    name: resource.title,
    size: Number(resource.data?.size || 0),
    mime: String(resource.data?.mime || "application/octet-stream"),
    status: resource.status,
    createdAt: resource.created_at,
  };
}

export function extensionFor(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase() : "FICHIER";
}

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "Taille inconnue";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export function previewKind(mime: string): "image" | "pdf" | "audio" | "video" | "text" | "docx" | "xlsx" | "pptx" | "unsupported" {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return "unsupported";
}

export function statusLabel(status: string): string {
  if (status === "ready") return "Prêt";
  if (status === "deleted") return "Fichier supprimé";
  if (status === "rejected" || status === "unavailable") return "Fichier indisponible";
  if (status === "uploading") return "Envoi en cours";
  if (status === "validating") return "Vérification en cours";
  return "En attente";
}
