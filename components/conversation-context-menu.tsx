"use client";

import type { ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  Mail,
  MailOpen,
  Pin,
  PinOff,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import type { Resource } from "@/lib/contracts";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export type ConversationActions = {
  onRename: (conversation: Resource) => void;
  onPin: (conversation: Resource) => void;
  onUnread: (conversation: Resource) => void;
  onArchive: (conversation: Resource) => void;
  onDelete: (conversation: Resource) => void;
  onShare: (conversation: Resource) => void;
  onCopyLink: (conversation: Resource) => void;
  onCopyTitle: (conversation: Resource) => void;
  onCopyContent: (conversation: Resource) => void;
  onOpenWindow: (conversation: Resource) => void;
};

export function isConversationPinned(resource: Resource) {
  const sidebar = resource.data.sidebar;
  return !!sidebar && typeof sidebar === "object" && !Array.isArray(sidebar) && (sidebar as Record<string, unknown>).pinned === true;
}

export function isConversationUnread(resource: Resource) {
  const sidebar = resource.data.sidebar;
  return !!sidebar && typeof sidebar === "object" && !Array.isArray(sidebar) && (sidebar as Record<string, unknown>).unread === true;
}

export function isConversationArchived(resource: Resource) {
  const sidebar = resource.data.sidebar;
  return !!sidebar && typeof sidebar === "object" && !Array.isArray(sidebar) && (sidebar as Record<string, unknown>).archived === true;
}

export function ConversationContextMenu({
  conversation,
  actions,
  isBusy = false,
  children,
}: {
  conversation: Resource;
  actions: ConversationActions;
  isBusy?: boolean;
  children: ReactNode;
}) {
  const pinned = isConversationPinned(conversation);
  const unread = isConversationUnread(conversation);
  const archived = isConversationArchived(conversation);
  const running = isBusy || conversation.status === "streaming";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="conversation-context-menu">
        <ContextMenuItem onSelect={() => actions.onRename(conversation)}>
          <Pencil />
          Renommer
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.onPin(conversation)}>
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? "Désépingler" : "Épingler"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.onUnread(conversation)}>
          {unread ? <MailOpen /> : <Mail />}
          {unread ? "Marquer comme lue" : "Marquer comme non lue"}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy />
            Copier
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="conversation-context-menu">
            <ContextMenuItem onSelect={() => actions.onCopyLink(conversation)}>
              <Copy />
              Copier le lien privé
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => actions.onCopyTitle(conversation)}>
              <Copy />
              Copier le titre
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => actions.onCopyContent(conversation)}>
              <Copy />
              Copier le contenu
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => actions.onShare(conversation)}>
          <Share2 />
          Partager le lien privé
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.onOpenWindow(conversation)}>
          <ExternalLink />
          Ouvrir dans une nouvelle fenêtre
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={running} onSelect={() => actions.onArchive(conversation)}>
          {archived ? <ArchiveRestore /> : <Archive />}
          {archived ? "Désarchiver" : "Archiver"}
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          disabled={running}
          onSelect={() => actions.onDelete(conversation)}
        >
          <Trash2 />
          Supprimer
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
