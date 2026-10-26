"use client";

import { AudioLines, FileArchive, FileImage, FileText, Film, Headphones, Paperclip, X } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useFilePreview } from "./file-preview-provider";
import { extensionFor, formatFileSize, previewKind, statusLabel, type PreviewFile } from "./types";

function AttachmentImage({ file, ready, legacy = false }: { file: PreviewFile; ready: boolean; legacy?: boolean }) {
  const { fetchContent } = useFilePreview();
  const [image, setImage] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!ready || legacy) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void fetchContent(file.id).then(response => response.blob()).then(blob => {
      objectUrl = URL.createObjectURL(blob);
      if (cancelled) URL.revokeObjectURL(objectUrl);
      else setImage({ id: file.id, url: objectUrl });
    }).catch(() => {
      if (!cancelled) setImage({ id: file.id, url: null });
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.id, fetchContent, legacy, ready]);

  const url = ready ? legacy ? `/api/files?id=${encodeURIComponent(file.id)}&preview=thumbnail` : image?.id === file.id ? image.url : null : null;
  return <span className="file-card-attachment-visual" aria-hidden="true">
    <FileImage size={25}/>
    {url && <Image src={url} alt="" width={150} height={150} unoptimized loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImage({ id: file.id, url: null })}/>}
  </span>;
}

export function FileCard({ file, contextFileIds = [file.id], variant = "grid", onRemove, disabled = false, legacyImagePreview = false }: {
  file: PreviewFile;
  contextFileIds?: string[];
  variant?: "grid" | "compact" | "attachment";
  onRemove?: () => void;
  disabled?: boolean;
  legacyImagePreview?: boolean;
}) {
  const { openPreview } = useFilePreview();
  const kind = previewKind(file.mime);
  const TypeIcon = kind === "image" ? FileImage : kind === "pdf" || kind === "text" ? FileText : kind === "audio" ? Headphones : kind === "video" ? Film : FileArchive;
  const fileReady = file.status === "ready";
  const ready = fileReady && !disabled;
  if (variant === "attachment") {
    // Only validated raster formats are loaded inline; other types retain their file card.
    const image = ["image/png", "image/jpeg", "image/webp"].includes(file.mime);
    return <article className="file-card file-card-attachment" data-kind={image ? "image" : kind}>
      <button type="button" className="file-card-open" onClick={() => openPreview(file.id, { contextFileIds })} disabled={!ready} title={`${file.name} · ${statusLabel(file.status)}`} aria-label={`${ready ? "Ouvrir l’aperçu de" : statusLabel(file.status) + " :"} ${file.name}`}>
        {image ? <AttachmentImage file={file} ready={fileReady && (!disabled || legacyImagePreview)} legacy={legacyImagePreview}/> : <>
          <span className="file-card-attachment-visual" aria-hidden="true"><TypeIcon size={25}/></span>
          <span className="file-card-attachment-caption"><span className={`file-card-icon file-card-icon-${kind}`} aria-hidden="true"><TypeIcon size={16}/></span><span>{file.name}</span></span>
        </>}
      </button>
      {onRemove && <button type="button" className="file-card-remove" onClick={onRemove} aria-label={`Retirer ${file.name}`}><X size={15}/></button>}
    </article>;
  }
  return <article className={`file-card file-card-${variant}`}>
    <button type="button" className="file-card-open" onClick={() => openPreview(file.id, { contextFileIds })} disabled={!ready} aria-label={`${ready ? "Ouvrir l’aperçu de" : "Fichier indisponible :"} ${file.name}`}>
      <span className={`file-card-icon file-card-icon-${kind}`}><TypeIcon size={variant === "grid" ? 25 : 19} aria-hidden="true"/><span>{extensionFor(file.name)}</span></span>
      <span className="file-card-copy"><strong title={file.name}>{file.name}</strong><small>{formatFileSize(file.size)} · {statusLabel(file.status)}</small></span>
    </button>
    {onRemove && <button type="button" className="file-card-remove" onClick={onRemove} aria-label={`Retirer ${file.name}`}><X size={15}/></button>}
    {variant === "grid" && <span className="file-card-kind"><Paperclip size={12}/>{kind === "unsupported" ? "Téléchargement" : kind === "pdf" ? "PDF" : kind === "text" ? "Document texte" : kind === "docx" ? "Document Word" : kind === "xlsx" ? "Classeur Excel" : kind === "pptx" ? "Présentation PowerPoint" : kind === "image" ? "Image" : kind === "audio" ? "Audio" : "Vidéo"}</span>}
    {kind === "audio" && variant === "compact" && <AudioLines size={14} aria-hidden="true"/>}
  </article>;
}
