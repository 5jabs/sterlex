"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import { useAssistantChat } from "@/app/hooks/useAssistantChat";
import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";
import type { ChatInputHandle } from "@/app/components/assistant/ChatInput";
import type {
    Citation,
    Document,
    EditAnnotation,
    Message,
} from "@/app/components/shared/types";
import { cn } from "@/app/lib/utils";
import {
    PROJECT_CHAT_BOTTOM_PADDING,
    ProjectChatPane,
} from "./ProjectChatPane";

export function ProjectDocumentChatOverlay({
    open,
    onClose,
    projectId,
    projectName,
    projectCmNumber,
    document,
    onOpenDocument,
    onDocumentMutated,
}: {
    open: boolean;
    onClose: () => void;
    projectId: string;
    projectName?: string;
    projectCmNumber?: string | null;
    document: Document;
    onOpenDocument?: (args: {
        documentId: string;
        filename: string;
        versionId: string | null;
        versionNumber: number | null;
    }) => void;
    onDocumentMutated?: () => void;
}) {
    const { saveChat } = useChatHistoryContext();
    const [chatId, setChatId] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || chatId) return;
        let cancelled = false;
        void saveChat(projectId).then((id) => {
            if (cancelled) return;
            if (id) {
                setChatId(id);
                setCreateError(null);
            } else {
                setCreateError("Could not start a chat. Please try again.");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [open, chatId, projectId, saveChat]);

    if (!open && !chatId) return null;

    return (
        <div
            className={cn(
                "absolute inset-0 z-30 flex flex-col bg-gray-50",
                !open && "hidden",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Document chat"
        >
            <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-3">
                <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-800">
                        Project Assistant
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                        {document.filename}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                    title="Back to document"
                    aria-label="Back to document"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {chatId ? (
                <ProjectDocumentChatBody
                    chatId={chatId}
                    projectId={projectId}
                    projectName={projectName}
                    projectCmNumber={projectCmNumber}
                    document={document}
                    onClose={onClose}
                    onOpenDocument={onOpenDocument}
                    onDocumentMutated={onDocumentMutated}
                />
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="text-sm text-gray-500">
                        {createError ?? "Opening chat…"}
                    </p>
                    {createError && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-xs font-medium text-burgundy-700"
                        >
                            Close
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function ProjectDocumentChatBody({
    chatId,
    projectId,
    projectName,
    projectCmNumber,
    document,
    onClose,
    onOpenDocument,
    onDocumentMutated,
}: {
    chatId: string;
    projectId: string;
    projectName?: string;
    projectCmNumber?: string | null;
    document: Document;
    onClose: () => void;
    onOpenDocument?: (args: {
        documentId: string;
        filename: string;
        versionId: string | null;
        versionNumber: number | null;
    }) => void;
    onDocumentMutated?: () => void;
}) {
    const chatInputRef = useRef<ChatInputHandle | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const latestUserMessageRef = useRef<HTMLDivElement>(null);
    const [minHeight, setMinHeight] = useState("0px");
    const attachedDocIdRef = useRef<string | null>(null);
    const onDocumentMutatedRef = useRef(onDocumentMutated);

    useEffect(() => {
        onDocumentMutatedRef.current = onDocumentMutated;
    }, [onDocumentMutated]);

    const { messages, isResponseLoading, handleChat, cancel } =
        useAssistantChat({ chatId, projectId });

    useEffect(() => {
        if (attachedDocIdRef.current === document.id) return;
        chatInputRef.current?.addDoc(document);
        attachedDocIdRef.current = document.id;
    }, [document]);

    const scrollLatestUserToTop = useCallback(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const container = messagesContainerRef.current;
                const element = latestUserMessageRef.current;
                if (!container || !element) return;
                container.scrollTo({
                    top: element.offsetTop - 24,
                    behavior: "smooth",
                });
            });
        });
    }, []);

    useEffect(() => {
        const last = messages[messages.length - 1];
        if (last?.role === "user") scrollLatestUserToTop();
    }, [messages, scrollLatestUserToTop]);

    useEffect(() => {
        if (isResponseLoading) scrollLatestUserToTop();
    }, [isResponseLoading, scrollLatestUserToTop]);

    useEffect(() => {
        const userEl = latestUserMessageRef.current;
        const containerEl = messagesContainerRef.current;
        if (!userEl || !containerEl) return;
        setMinHeight(
            `${Math.max(
                0,
                containerEl.clientHeight -
                    24 * 3 -
                    userEl.offsetHeight -
                    PROJECT_CHAT_BOTTOM_PADDING,
            )}px`,
        );
    }, [messages.length]);

    const mutationSignature = useMemo(
        () => documentMutationSignature(messages),
        [messages],
    );

    useEffect(() => {
        if (!mutationSignature) return;
        onDocumentMutatedRef.current?.();
    }, [mutationSignature]);

    const handleSubmit = useCallback(
        (message: Message) =>
            handleChat(message, {
                displayedDoc: {
                    filename: document.filename,
                    documentId: document.id,
                },
            }),
        [document.filename, document.id, handleChat],
    );

    const handleCitationClick = useCallback(
        (citation: Citation) => {
            if (citation.kind === "case") return;
            onOpenDocument?.({
                documentId: citation.document_id,
                filename: citation.filename,
                versionId: null,
                versionNumber: null,
            });
            onClose();
        },
        [onClose, onOpenDocument],
    );

    const handleEditViewClick = useCallback(
        (ann: EditAnnotation, filename: string) => {
            onOpenDocument?.({
                documentId: ann.document_id,
                filename,
                versionId: ann.version_id ?? null,
                versionNumber: null,
            });
            onClose();
        },
        [onClose, onOpenDocument],
    );

    const handleOpenDocument = useCallback(
        (args: {
            documentId: string;
            filename: string;
            versionId: string | null;
            versionNumber: number | null;
        }) => {
            onOpenDocument?.(args);
            onClose();
        },
        [onClose, onOpenDocument],
    );

    return (
        <ProjectChatPane
            chatLoaded
            messages={messages}
            isResponseLoading={isResponseLoading}
            minHeight={minHeight}
            projectName={projectName}
            projectCmNumber={projectCmNumber}
            hideAddDocButton={false}
            greeting={
                <div className="flex flex-1 items-center justify-center px-8">
                    <div className="max-w-sm space-y-2 text-center">
                        <p className="font-serif text-base text-gray-500">
                            Ask for edits, a new version, or questions about
                            this document.
                        </p>
                        <p className="inline-flex items-center justify-center gap-1.5 font-serif text-sm text-gray-400">
                            <FileText className="h-3.5 w-3.5" />
                            {document.filename}
                        </p>
                    </div>
                </div>
            }
            onSubmit={handleSubmit}
            onCancel={cancel}
            onCitationClick={handleCitationClick}
            onEditViewClick={handleEditViewClick}
            onOpenDocument={handleOpenDocument}
            onEditResolved={() => onDocumentMutatedRef.current?.()}
            chatInputRef={chatInputRef}
            latestUserMessageRef={latestUserMessageRef}
            messagesContainerRef={messagesContainerRef}
        />
    );
}

function documentMutationSignature(messages: Message[]) {
    const created: string[] = [];
    const replicated: string[] = [];
    const editedPerDoc: Record<string, number> = {};
    for (const msg of messages) {
        for (const ev of msg.events ?? []) {
            if ("isStreaming" in ev && ev.isStreaming) continue;
            if (ev.type === "doc_created" && ev.document_id) {
                created.push(
                    `${ev.document_id}:${ev.version_id ?? ""}:${ev.filename}`,
                );
                continue;
            }
            if (ev.type === "doc_replicated") {
                for (const copy of ev.copies ?? []) {
                    replicated.push(
                        `${copy.document_id}:${copy.version_id}:${copy.new_filename}`,
                    );
                }
                continue;
            }
            if (ev.type === "doc_edited") {
                editedPerDoc[ev.document_id] = Math.max(
                    editedPerDoc[ev.document_id] ?? 0,
                    (ev.version_number as number | null | undefined) ?? 0,
                );
            }
        }
    }
    const signature = [
        `created=${created.sort().join(",")}`,
        `replicated=${replicated.sort().join(",")}`,
        `edited=${Object.entries(editedPerDoc)
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join(",")}`,
    ].join("|");
    if (
        signature === "created=|replicated=|edited=" ||
        (!created.length && !replicated.length && !Object.keys(editedPerDoc).length)
    ) {
        return "";
    }
    return signature;
}
