"use client";

import {
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Folder,
    Loader2,
    Pencil,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { MobileChatFab } from "@/app/components/projects/MobileChatFab";
import {
    PROJECT_CHAT_BOTTOM_PADDING,
    ProjectChatPane,
} from "@/app/components/projects/ProjectChatPane";
import {
    deleteChat,
    deleteDocument,
    getChat,
    getProject,
    uploadProjectDocument,
    createProjectFolder,
    renameProjectFolder,
    deleteProjectFolder,
    moveDocumentToFolder,
    moveSubfolderToFolder,
} from "@/app/lib/sterlexApi";
import { useAssistantChat } from "@/app/hooks/useAssistantChat";
import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";
import type { ChatInputHandle } from "@/app/components/assistant/ChatInput";
import { ProjectExplorer } from "@/app/components/projects/ProjectExplorer";
import { PdfView } from "@/app/components/shared/views/PdfView";
import { SpreadsheetView } from "@/app/components/shared/views/SpreadsheetView";
import { OwnerOnlyPopup } from "@/app/components/popups/OwnerOnlyPopup";
import { DocxView } from "@/app/components/shared/views/DocxView";
import { useAuth } from "@/app/contexts/AuthContext";
import { useSidebar } from "@/app/contexts/SidebarContext";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { HeaderActionsMenu } from "@/app/components/shared/HeaderActionsMenu";
import type {
    CitationQuote,
    Citation,
    Document,
    EditAnnotation,
    Message,
    Project,
} from "@/app/components/shared/types";
import {
    expandCitationToEntries,
    isSpreadsheetFilename,
} from "@/app/components/shared/types";
import { cn } from "@/app/lib/utils";

interface Props {
    params: Promise<{ id: string; chatId: string }>;
}

type DocTab = {
    documentId: string;
    filename: string;
    quotes?: CitationQuote[];
    versionId?: string | null;
    refetchKey?: number;
    warning?: string | null;
    scrollTop?: number;
};

type EditScrollTarget = {
    key: string;
    documentId: string;
    inserted_text?: string;
    deleted_text?: string;
    ins_w_id?: string | null;
    del_w_id?: string | null;
};

function isDocxTab(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext === "docx" || ext === "doc";
}

const EXPLORER_MIN = 160;
const EXPLORER_DEFAULT = 280;
const CHAT_MIN = 320;
const CHAT_DEFAULT = 420;
const DEFAULT_ASSISTANT_BOTTOM_PADDING = PROJECT_CHAT_BOTTOM_PADDING;
const COMPACT_LAYOUT_PX = 1024;

function AssistantGreeting() {
    return (
        <div className="flex-1 flex items-center justify-center px-8">
            <div className="max-w-sm text-center space-y-2">
                <p className="font-serif text-base text-gray-500">
                    Use this chat to discuss and edit this project&apos;s
                    documents — including creating new versions.
                </p>
                <p className="font-serif text-sm text-gray-400">
                    Tip: drag a document from the Explorer into the chat to
                    add it as context.
                </p>
            </div>
        </div>
    );
}

/** Drag-handle divider for resizing panels */
function Divider({ onDrag }: { onDrag: (dx: number) => void }) {
    const dragging = useRef(false);
    const lastX = useRef(0);
    const [isDragging, setIsDragging] = useState(false);

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        setIsDragging(true);
        lastX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    useEffect(() => {
        function onMouseMove(e: MouseEvent) {
            if (!dragging.current) return;
            onDrag(e.clientX - lastX.current);
            lastX.current = e.clientX;
        }
        function onMouseUp() {
            if (!dragging.current) return;
            dragging.current = false;
            setIsDragging(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [onDrag]);

    return (
        <div className="relative w-0 shrink-0 z-10">
            <div
                onMouseDown={onMouseDown}
                className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize flex items-stretch justify-center"
            >
                {isDragging && (
                    <div className="w-1 bg-burgundy-500 transition-colors" />
                )}
            </div>
        </div>
    );
}

export default function ProjectAssistantChatPage({ params }: Props) {
    const { id: projectId, chatId } = use(params);
    const router = useRouter();

    const { setSidebarOpen } = useSidebar();
    const { user } = useAuth();

    const [project, setProject] = useState<Project | null>(null);
    const [chatTitle, setChatTitle] = useState<string | null>(null);
    const [chatOwnerId, setChatOwnerId] = useState<string | null>(null);
    const [ownerOnlyAction, setOwnerOnlyAction] = useState<string | null>(null);
    const [chatLoaded, setChatLoaded] = useState(false);
    const [creatingChat, setCreatingChat] = useState(false);
    const [deletingChat, setDeletingChat] = useState(false);

    // Panel widths
    const [explorerWidth, setExplorerWidth] = useState(EXPLORER_DEFAULT);
    const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
    const [explorerCollapsed, setExplorerCollapsed] = useState(false);
    const isCompact = useIsMobile(COMPACT_LAYOUT_PX);
    const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
    const [mobileChatOpen, setMobileChatOpen] = useState(true);

    // Upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [explorerDragOver, setExplorerDragOver] = useState(false);

    // Tabs
    const [tabs, setTabs] = useState<DocTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [activeQuotes, setActiveQuotes] = useState<CitationQuote[] | null>(
        null,
    );
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [editScrollTarget, setEditScrollTarget] =
        useState<EditScrollTarget | null>(null);
    const [reloadingDocIds, setReloadingDocIds] = useState<Set<string>>(
        () => new Set(),
    );

    const activeTab = tabs.find((t) => t.documentId === activeTabId) ?? null;
    const tabBarRef = useRef<HTMLDivElement | null>(null);
    const tabItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const chatInputRef = useRef<ChatInputHandle | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const latestUserMessageRef = useRef<HTMLDivElement>(null);
    const [minHeight, setMinHeight] = useState("0px");

    const {
        setCurrentChatId,
        newChatMessages,
        setNewChatMessages,
        chats,
        saveChat,
        renameChat: renameChatInHistory,
    } = useChatHistoryContext();
    const [initialMessages] = useState<Message[]>(newChatMessages ?? []);
    const { messages, isResponseLoading, handleChat, setMessages, cancel } =
        useAssistantChat({ initialMessages, chatId, projectId });
    const pendingInitialUserMessageRef = useRef<Message | null>(
        initialMessages.length === 1 && initialMessages[0].role === "user"
            ? initialMessages[0]
            : null,
    );

    const hasLoaded = useRef(false);
    const hasAutoSent = useRef(false);
    const hasInitialScrolled = useRef(false);

    useEffect(() => {
        setSidebarOpen(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        getProject(projectId)
            .then(setProject)
            .catch(() => {});
    }, [projectId]);

    // Whenever the assistant mutates project documents — creating a new
    // doc, creating a new version via edit_document, or replicating a doc —
    // refresh the project so the explorer picks up the new/changed files
    // without a manual reload. Keyed by completed mutation events only, so
    // we refetch once the backend has finished persisting the change.
    const projectMutationSignature = useMemo(() => {
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
                    for (const c of ev.copies ?? []) {
                        replicated.push(
                            `${c.document_id}:${c.version_id}:${c.new_filename}`,
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
        return [
            `created=${created.sort().join(",")}`,
            `replicated=${replicated.sort().join(",")}`,
            `edited=${Object.entries(editedPerDoc)
                .map(([k, v]) => `${k}=${v}`)
                .sort()
                .join(",")}`,
        ].join("|");
    }, [messages]);

    useEffect(() => {
        if (!projectMutationSignature) return;
        getProject(projectId)
            .then(setProject)
            .catch(() => {});
    }, [projectMutationSignature, projectId]);

    useEffect(() => {
        setCurrentChatId(chatId);
    }, [chatId, setCurrentChatId]);

    useEffect(() => {
        if (hasLoaded.current) return;
        hasLoaded.current = true;
        getChat(chatId)
            .then(({ chat, messages: loaded }) => {
                setChatTitle(chat.title);
                setChatOwnerId(chat.user_id ?? null);
                if (loaded.length > 0) setMessages(loaded);
            })
            .catch(() => router.replace(`/projects/${projectId}/assistant`))
            .finally(() => setChatLoaded(true));
    }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const match = chats?.find((c) => c.id === chatId);
        if (match?.title) setChatTitle(match.title);
    }, [chats, chatId]);

    useEffect(() => {
        const pendingMessage = pendingInitialUserMessageRef.current;
        if (
            pendingMessage &&
            !hasAutoSent.current &&
            !isResponseLoading &&
            messages.length === 1
        ) {
            hasAutoSent.current = true;
            pendingInitialUserMessageRef.current = null;
            setNewChatMessages(null);
            void handleChat(pendingMessage);
        }
    }, [messages.length, isResponseLoading, handleChat, setNewChatMessages]);

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
        if (!chatLoaded || hasInitialScrolled.current || messages.length === 0)
            return;
        const container = messagesContainerRef.current;
        const el = latestUserMessageRef.current;
        if (!container || !el) return;
        hasInitialScrolled.current = true;
        setTimeout(() => {
            container.scrollTo({
                top: el.offsetTop - 16,
                behavior: "auto",
            });
        }, 100);
    }, [chatLoaded, messages.length]);

    useEffect(() => {
        if (isResponseLoading) scrollLatestUserToTop();
    }, [isResponseLoading, scrollLatestUserToTop]);

    useEffect(() => {
        const userEl = latestUserMessageRef.current;
        const containerEl = messagesContainerRef.current;
        if (!userEl || !containerEl) return;
        const messageGap = window.innerWidth < 768 ? 24 : 32;
        setMinHeight(
            `${Math.max(
                0,
                containerEl.clientHeight -
                    messageGap * 3 -
                    userEl.offsetHeight -
                    DEFAULT_ASSISTANT_BOTTOM_PADDING,
            )}px`,
        );
    }, [messages.length]);

    useEffect(() => {
        if (!activeTabId) return;
        const el = tabItemRefs.current[activeTabId];
        if (!el) return;
        el.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
        });
    }, [activeTabId, tabs.length]);

    // ── Tabs ──────────────────────────────────────────────────────────────────
    function openTab(
        docId: string,
        filename: string,
        quotes?: CitationQuote[],
        versionId?: string | null,
    ) {
        setTabs((prev) => {
            const existing = prev.find((t) => t.documentId === docId);
            if (existing) {
                if (
                    versionId !== undefined &&
                    existing.versionId !== versionId
                ) {
                    return prev.map((t) =>
                        t.documentId === docId ? { ...t, versionId } : t,
                    );
                }
                return prev;
            }
            return [
                ...prev,
                { documentId: docId, filename, quotes, versionId },
            ];
        });
        setActiveTabId(docId);
        setActiveQuotes(quotes && quotes.length ? quotes : null);
        setSelectedDocId(docId);
        setMobileExplorerOpen(false);
        setMobileChatOpen(false);
    }

    function closeTab(docId: string) {
        setTabs((prev) => {
            const next = prev.filter((t) => t.documentId !== docId);
            if (activeTabId === docId) {
                const idx = prev.findIndex((t) => t.documentId === docId);
                const fallback = next[idx] ?? next[idx - 1] ?? null;
                setActiveTabId(fallback?.documentId ?? null);
                setActiveQuotes(null);
                setSelectedDocId(fallback?.documentId ?? null);
                if (!fallback) setMobileChatOpen(true);
            }
            return next;
        });
    }

    function switchTab(docId: string) {
        setActiveTabId(docId);
        setActiveQuotes(null);
        setSelectedDocId(docId);
        setMobileChatOpen(false);
    }

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(
        (message: Message) => {
            if (!activeTab) return handleChat(message);
            return handleChat(message, {
                displayedDoc: {
                    filename: activeTab.filename,
                    documentId: activeTab.documentId,
                },
            });
        },
        [activeTab, handleChat],
    );

    const handleDocClick = (doc: Document) => {
        openTab(doc.id, doc.filename);
    };

    const handleCitationClick = (citation: Citation) => {
        if (citation.kind === "case") return;
        openTab(
            citation.document_id,
            citation.filename,
            expandCitationToEntries(citation),
        );
    };

    const handleOpenDocument = (args: {
        documentId: string;
        filename: string;
        versionId: string | null;
        versionNumber: number | null;
    }) => {
        openTab(args.documentId, args.filename, undefined, args.versionId);
    };

    const handleEditViewClick = (ann: EditAnnotation, filename: string) => {
        openTab(ann.document_id, filename, undefined, ann.version_id ?? null);
        setEditScrollTarget({
            key: `${ann.edit_id}-${Date.now()}`,
            documentId: ann.document_id,
            inserted_text: ann.inserted_text,
            deleted_text: ann.deleted_text,
            ins_w_id: ann.ins_w_id ?? null,
            del_w_id: ann.del_w_id ?? null,
        });
    };

    const handleEditResolved = (_args: {
        editId: string;
        documentId: string;
        status: "accepted" | "rejected";
        versionId: string | null;
        downloadUrl: string | null;
    }) => {
        // Re-render after accept/reject is disabled while we verify the
        // client-side optimistic mutation works on its own. Re-enable by
        // bumping versionId + refetchKey on the matching tab and marking
        // it reloading like before.
        void _args;
    };

    const patchTab = (documentId: string, patch: Partial<DocTab>) => {
        setTabs((prev) =>
            prev.map((t) =>
                t.documentId === documentId ? { ...t, ...patch } : t,
            ),
        );
    };

    const handleEditError = (args: { documentId: string; message: string }) => {
        patchTab(args.documentId, { warning: args.message });
    };

    const dismissTabWarning = (documentId: string) => {
        patchTab(documentId, { warning: null });
    };

    const handleTabScrollChange = (documentId: string, scrollTop: number) => {
        patchTab(documentId, { scrollTop });
    };

    const handleDocxReady = (documentId: string) => {
        setReloadingDocIds((prev) => {
            if (!prev.has(documentId)) return prev;
            const next = new Set(prev);
            next.delete(documentId);
            return next;
        });
    };

    const handleChatDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const docId = e.dataTransfer.getData("application/sterlex-doc");
        if (!docId) return;
        const doc = project?.documents?.find((d) => d.id === docId);
        if (doc) chatInputRef.current?.addDoc(doc);
    };

    // ── Chat actions ──────────────────────────────────────────────────────────
    async function handleNewChat() {
        setCreatingChat(true);
        try {
            const id = await saveChat(projectId);
            if (id) router.push(`/projects/${projectId}/assistant/chat/${id}`);
        } finally {
            setCreatingChat(false);
        }
    }

    const isProjectOwner = project?.is_owner !== false;

    async function handleDeleteChat() {
        if (
            !isProjectOwner &&
            chatOwnerId &&
            user?.id &&
            chatOwnerId !== user.id
        ) {
            setOwnerOnlyAction("delete this chat");
            return;
        }
        setDeletingChat(true);
        try {
            await deleteChat(chatId);
            router.push(`/projects/${projectId}/assistant`);
        } finally {
            setDeletingChat(false);
        }
    }

    async function handleRenameChat() {
        if (
            !isProjectOwner &&
            chatOwnerId &&
            user?.id &&
            chatOwnerId !== user.id
        ) {
            setOwnerOnlyAction("rename this chat");
            return;
        }
        const nextTitle = window.prompt(
            "Rename chat",
            chatTitle ?? "Untitled New Chat",
        );
        const trimmed = nextTitle?.trim();
        if (!trimmed || trimmed === chatTitle) return;
        setChatTitle(trimmed);
        await renameChatInHistory(chatId, trimmed);
    }

    // ── Upload ────────────────────────────────────────────────────────────────
    async function uploadFiles(files: File[]) {
        if (!files.length) return;
        setUploading(true);
        try {
            const uploaded = await Promise.all(
                files.map((f) => uploadProjectDocument(projectId, f)),
            );
            setProject((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    documents: [...(prev.documents ?? []), ...uploaded],
                };
            });
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    const handleExplorerFileDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setExplorerDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) {
            await uploadFiles(files);
        }
        // Internal doc/folder moves are handled inside ProjectExplorer (stopPropagation)
    };

    // ── Folder handlers ───────────────────────────────────────────────────────
    const handleCreateFolder = async (
        parentId: string | null,
        name: string,
    ) => {
        const folder = await createProjectFolder(
            projectId,
            name,
            parentId ?? undefined,
        );
        setProject((prev) =>
            prev
                ? { ...prev, folders: [...(prev.folders ?? []), folder] }
                : prev,
        );
    };

    const handleRenameFolder = async (folderId: string, name: string) => {
        await renameProjectFolder(projectId, folderId, name);
        setProject((prev) =>
            prev
                ? {
                      ...prev,
                      folders: (prev.folders ?? []).map((f) =>
                          f.id === folderId ? { ...f, name } : f,
                      ),
                  }
                : prev,
        );
    };

    const handleDeleteFolder = async (folderId: string) => {
        const toDelete = new Set<string>();
        function collectIds(id: string) {
            toDelete.add(id);
            (project?.folders ?? [])
                .filter((f) => f.parent_folder_id === id)
                .forEach((f) => collectIds(f.id));
        }
        collectIds(folderId);
        await deleteProjectFolder(projectId, folderId);
        setProject((prev) =>
            prev
                ? {
                      ...prev,
                      folders: (prev.folders ?? []).filter(
                          (f) => !toDelete.has(f.id),
                      ),
                      documents: (prev.documents ?? []).map((d) =>
                          d.folder_id && toDelete.has(d.folder_id)
                              ? { ...d, folder_id: null }
                              : d,
                      ),
                  }
                : prev,
        );
    };

    const handleMoveDoc = async (
        docId: string,
        targetFolderId: string | null,
    ) => {
        setProject((prev) =>
            prev
                ? {
                      ...prev,
                      documents: (prev.documents ?? []).map((d) =>
                          d.id === docId
                              ? { ...d, folder_id: targetFolderId }
                              : d,
                      ),
                  }
                : prev,
        );
        await moveDocumentToFolder(projectId, docId, targetFolderId);
    };

    const handleMoveFolder = async (
        folderId: string,
        targetFolderId: string | null,
    ) => {
        setProject((prev) =>
            prev
                ? {
                      ...prev,
                      folders: (prev.folders ?? []).map((f) =>
                          f.id === folderId
                              ? { ...f, parent_folder_id: targetFolderId }
                              : f,
                      ),
                  }
                : prev,
        );
        await moveSubfolderToFolder(projectId, folderId, targetFolderId);
    };

    const handleDeleteDoc = async (docId: string) => {
        await deleteDocument(docId);
        setProject((prev) =>
            prev
                ? {
                      ...prev,
                      documents: (prev.documents ?? []).filter(
                          (d) => d.id !== docId,
                      ),
                  }
                : prev,
        );
        setTabs((prev) => prev.filter((t) => t.documentId !== docId));
        if (activeTabId === docId) {
            setActiveTabId(null);
            setActiveQuotes(null);
            setSelectedDocId(null);
            setEditScrollTarget(null);
        }
    };

    // ── Resize handlers ───────────────────────────────────────────────────────
    const onExplorerDividerDrag = useCallback((dx: number) => {
        setExplorerWidth((w) => Math.max(EXPLORER_MIN, w + dx));
    }, []);

    const onChatDividerDrag = useCallback((dx: number) => {
        setChatWidth((w) => Math.max(CHAT_MIN, w - dx));
    }, []);

    useEffect(() => {
        if (!isCompact) return;
        function onKey(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            if (mobileExplorerOpen) {
                setMobileExplorerOpen(false);
                return;
            }
            if (mobileChatOpen && activeTabId) {
                setMobileChatOpen(false);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [activeTabId, isCompact, mobileChatOpen, mobileExplorerOpen]);

    const showDesktopExplorer = !isCompact && !explorerCollapsed;
    const showMobileExplorer = isCompact && mobileExplorerOpen;
    const showChatOverlay =
        !isCompact || mobileChatOpen || !activeTabId;

    return (
        <div className="flex flex-col h-full">
            {/* Page header */}
            <PageHeader
                shrink
                breadcrumbs={[
                    {
                        label: "Projects",
                        onClick: () => router.push("/projects"),
                    },
                    project
                        ? {
                              label: project.name,
                              onClick: () =>
                                  router.push(`/projects/${projectId}/assistant`),
                              title: "Back to project",
                          }
                        : {
                              loading: true,
                              skeletonClassName: "w-32",
                              onClick: () =>
                                  router.push(`/projects/${projectId}/assistant`),
                              title: "Back to project",
                          },
                    chatLoaded
                        ? {
                              label: chatTitle ?? "Untitled New Chat",
                          }
                        : {
                              loading: true,
                              skeletonClassName: "w-40",
                          },
                ]}
                actions={[
                    {
                        type: "new",
                        onClick: handleNewChat,
                        loading: creatingChat,
                        title: "New chat",
                    },
                    {
                        type: "custom",
                        render: (
                            <HeaderActionsMenu
                                items={[
                                    {
                                        label: "Rename",
                                        icon: Pencil,
                                        onSelect: () =>
                                            void handleRenameChat(),
                                    },
                                    {
                                        label: deletingChat
                                            ? "Deleting..."
                                            : "Delete",
                                        icon: Trash2,
                                        onSelect: () =>
                                            void handleDeleteChat(),
                                        disabled: deletingChat,
                                        variant: "danger",
                                    },
                                ]}
                            />
                        ),
                    },
                ]}
            />

            {/* Three-panel body */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden border-t border-gray-200">
                {isCompact && mobileExplorerOpen && (
                    <button
                        type="button"
                        aria-label="Close explorer"
                        className="absolute inset-0 z-[45] bg-gray-900/20"
                        onClick={() => setMobileExplorerOpen(false)}
                    />
                )}
                {/* LEFT: Project Explorer */}
                {(showDesktopExplorer || showMobileExplorer) && (
                    <>
                        <div
                            style={{
                                width: isCompact
                                    ? Math.min(explorerWidth, 320)
                                    : explorerWidth,
                            }}
                            className={cn(
                                "flex shrink-0 flex-col border-r border-gray-200 bg-white",
                                isCompact &&
                                    "absolute inset-y-0 left-0 z-50 shadow-[8px_0_24px_rgba(15,23,42,0.16)]",
                            )}
                            onDragOver={(e) => {
                                e.preventDefault();
                                // Only show the upload overlay for external file drags, not internal moves
                                const isInternal =
                                    Array.from(e.dataTransfer.types).includes(
                                        "application/sterlex-doc",
                                    ) ||
                                    Array.from(e.dataTransfer.types).includes(
                                        "application/sterlex-folder",
                                    );
                                if (!isInternal) setExplorerDragOver(true);
                            }}
                            onDragLeave={(e) => {
                                if (
                                    !e.currentTarget.contains(
                                        e.relatedTarget as Node,
                                    )
                                )
                                    setExplorerDragOver(false);
                            }}
                            onDrop={handleExplorerFileDrop}
                        >
                            {/* Explorer header */}
                            <div className="h-10 flex items-center justify-between px-3 border-b border-gray-200 shrink-0">
                                <span className="text-xs text-gray-700">
                                    Explorer
                                </span>
                                <div className="flex items-center gap-1">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.docx,.doc,.xlsx,.xlsm,.xls,.pptx,.ppt"
                                        multiple
                                        className="hidden"
                                        onChange={(e) =>
                                            uploadFiles(
                                                Array.from(
                                                    e.target.files ?? [],
                                                ),
                                            )
                                        }
                                    />
                                    <button
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        disabled={uploading}
                                        title="Upload documents"
                                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
                                    >
                                        {uploading ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Upload className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() =>
                                            isCompact
                                                ? setMobileExplorerOpen(false)
                                                : setExplorerCollapsed(true)
                                        }
                                        title={
                                            isCompact
                                                ? "Close explorer"
                                                : "Collapse explorer"
                                        }
                                        className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                                    >
                                        {isCompact ? (
                                            <X className="h-3.5 w-3.5" />
                                        ) : (
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Drop overlay */}
                            <div
                                className={`flex-1 overflow-y-auto relative h-full ${explorerDragOver ? "bg-burgundy-50" : ""}`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                }}
                                onDrop={async (e) => {
                                    e.preventDefault();
                                    const docId = e.dataTransfer.getData(
                                        "application/sterlex-doc",
                                    );
                                    const folderId = e.dataTransfer.getData(
                                        "application/sterlex-folder",
                                    );
                                    if (docId) {
                                        e.stopPropagation();
                                        await handleMoveDoc(docId, null);
                                    } else if (folderId) {
                                        e.stopPropagation();
                                        await handleMoveFolder(folderId, null);
                                    }
                                    // External file drops are not stopped — they bubble to handleExplorerFileDrop
                                }}
                            >
                                {explorerDragOver && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                        <p className="text-xs text-burgundy-500 font-medium">
                                            Drop to upload
                                        </p>
                                    </div>
                                )}
                                <ProjectExplorer
                                    projectName={project?.name}
                                    documents={project?.documents ?? []}
                                    folders={project?.folders ?? []}
                                    selectedDocId={selectedDocId}
                                    onDocClick={handleDocClick}
                                    onCreateFolder={handleCreateFolder}
                                    onRenameFolder={handleRenameFolder}
                                    onDeleteFolder={handleDeleteFolder}
                                    onDeleteDoc={handleDeleteDoc}
                                    onMoveDoc={handleMoveDoc}
                                    onMoveFolder={handleMoveFolder}
                                />
                            </div>
                        </div>
                        {!isCompact && (
                            <Divider onDrag={onExplorerDividerDrag} />
                        )}
                    </>
                )}

                {/* Collapsed explorer toggle */}
                {!isCompact && explorerCollapsed && (
                    <div className="shrink-0 flex flex-col border-r border-gray-200">
                        <div className="h-10 flex items-center justify-center border-b border-gray-200 shrink-0 px-1">
                            <button
                                onClick={() => setExplorerCollapsed(false)}
                                title="Expand explorer"
                                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* CENTER: Document Panel */}
                <div className="flex min-w-0 flex-1 flex-col border-r border-gray-200">
                    {/* Tab bar */}
                    <div
                        ref={tabBarRef}
                        className="flex h-10 min-w-0 shrink-0 items-end overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {isCompact && (
                            <button
                                type="button"
                                onClick={() => setMobileExplorerOpen(true)}
                                className="flex h-full w-11 shrink-0 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                                title="Open explorer"
                                aria-label="Open explorer"
                            >
                                <Folder className="h-4 w-4" />
                            </button>
                        )}
                        {tabs.length === 0 ? (
                            <span className="px-4 self-center text-xs text-gray-700">
                                Document Viewer
                            </span>
                        ) : (
                            tabs.map((tab) => {
                                const isActive = tab.documentId === activeTabId;
                                const ext = tab.filename
                                    .split(".")
                                    .pop()
                                    ?.toLowerCase();
                                const iconColor =
                                    ext === "pdf"
                                        ? "text-red-500"
                                        : ext === "doc" || ext === "docx"
                                          ? "text-burgundy-500"
                                          : "text-gray-400";
                                // Pull the doc's latest_version_number out
                                // of the project state so the tab shows V#
                                // whenever the doc has been edited.
                                const versionNumber = (
                                    project?.documents ?? []
                                ).find((d) => d.id === tab.documentId)
                                    ?.latest_version_number as
                                    | number
                                    | null
                                    | undefined;
                                const showVersionBadge =
                                    typeof versionNumber === "number" &&
                                    Number.isFinite(versionNumber) &&
                                    versionNumber > 1;
                                return (
                                    <div
                                        key={tab.documentId}
                                        ref={(el) => {
                                            tabItemRefs.current[
                                                tab.documentId
                                            ] = el;
                                        }}
                                        onClick={() =>
                                            switchTab(tab.documentId)
                                        }
                                        className={`group flex items-center gap-1.5 px-3 h-full border-r border-gray-200 cursor-pointer shrink-0 max-w-[260px] transition-colors ${
                                            isActive
                                                ? "bg-gray-100"
                                                : "bg-white hover:bg-gray-50"
                                        }`}
                                    >
                                        <FileText
                                            className={`h-3.5 w-3.5 shrink-0 ${iconColor}`}
                                        />
                                        <span
                                            className={`text-xs truncate ${isActive ? "text-gray-900 font-medium" : "text-gray-500"}`}
                                        >
                                            {tab.filename}
                                        </span>
                                        {showVersionBadge && (
                                            <span
                                                className={`shrink-0 inline-flex items-center rounded border px-1 py-px text-[9px] font-medium ${
                                                    isActive
                                                        ? "border-gray-200 bg-white text-gray-600"
                                                        : "border-gray-200 bg-gray-50 text-gray-500"
                                                }`}
                                            >
                                                V{versionNumber}
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                closeTab(tab.documentId);
                                            }}
                                            className={`shrink-0 transition-colors ${isActive ? "text-gray-500 hover:text-gray-700" : "text-gray-300 hover:text-gray-600"}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        {activeTab ? (
                            isDocxTab(activeTab.filename) ? (
                                <DocxView
                                    key={activeTab.documentId}
                                    documentId={activeTab.documentId}
                                    versionId={activeTab.versionId}
                                    refetchKey={activeTab.refetchKey}
                                    quotes={activeQuotes ?? undefined}
                                    highlightEdit={
                                        editScrollTarget &&
                                        editScrollTarget.documentId ===
                                            activeTab.documentId
                                            ? editScrollTarget
                                            : null
                                    }
                                    onReady={() =>
                                        handleDocxReady(activeTab.documentId)
                                    }
                                    warning={activeTab.warning ?? null}
                                    onWarningDismiss={() =>
                                        dismissTabWarning(activeTab.documentId)
                                    }
                                    initialScrollTop={
                                        activeTab.scrollTop ?? null
                                    }
                                    onScrollChange={(top) =>
                                        handleTabScrollChange(
                                            activeTab.documentId,
                                            top,
                                        )
                                    }
                                    rounded={false}
                                />
                            ) : isSpreadsheetFilename(activeTab.filename) ? (
                                <SpreadsheetView
                                    key={activeTab.documentId}
                                    documentId={activeTab.documentId}
                                    versionId={activeTab.versionId}
                                    rounded={false}
                                />
                            ) : (
                                <PdfView
                                    key={activeTab.documentId}
                                    doc={{ document_id: activeTab.documentId }}
                                    quotes={activeQuotes ?? undefined}
                                    rounded={false}
                                />
                            )
                        ) : (
                            <div className="flex items-center justify-center h-full px-8 bg-gray-100">
                                <div className="text-center space-y-3">
                                    <p className="font-serif text-gray-700 text-xl">
                                        Click on a document to display here.
                                    </p>
                                    <p className="font-serif text-base text-gray-500">
                                        Pro tip: Drag a document from the
                                        Project Explorer to the Assistant to
                                        direct it to read or edit.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {!isCompact && <Divider onDrag={onChatDividerDrag} />}

                {/* RIGHT: Assistant Panel */}
                <div
                    style={isCompact ? undefined : { width: chatWidth }}
                    className={cn(
                        "relative flex flex-col bg-white",
                        isCompact
                            ? cn(
                                  "absolute inset-0 z-40",
                                  showChatOverlay ? "flex" : "hidden",
                              )
                            : "h-full min-h-0 w-auto shrink-0",
                    )}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleChatDrop}
                >
                    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-2 md:h-10 md:px-4">
                        <div className="flex min-w-0 items-center gap-1">
                            {isCompact && (
                                <button
                                    type="button"
                                    onClick={() => setMobileExplorerOpen(true)}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                                    title="Open explorer"
                                    aria-label="Open explorer"
                                >
                                    <Folder className="h-4 w-4" />
                                </button>
                            )}
                            <span className="truncate px-1 text-xs text-gray-700 md:px-0">
                                Project Assistant
                            </span>
                        </div>
                        {isCompact && activeTab && (
                            <button
                                type="button"
                                onClick={() => setMobileChatOpen(false)}
                                className="inline-flex h-11 shrink-0 items-center gap-1.5 px-2 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
                            >
                                <FileText className="h-3.5 w-3.5" />
                                Document
                            </button>
                        )}
                    </div>

                    <ProjectChatPane
                        chatLoaded={chatLoaded}
                        messages={messages}
                        isResponseLoading={isResponseLoading}
                        minHeight={minHeight}
                        projectName={project?.name}
                        projectCmNumber={project?.cm_number}
                        hideAddDocButton={!isCompact}
                        greeting={<AssistantGreeting />}
                        onSubmit={handleSubmit}
                        onCancel={cancel}
                        onCitationClick={handleCitationClick}
                        onEditViewClick={handleEditViewClick}
                        onOpenDocument={handleOpenDocument}
                        onEditResolved={handleEditResolved}
                        onEditError={handleEditError}
                        isDocReloading={(docId) => reloadingDocIds.has(docId)}
                        chatInputRef={chatInputRef}
                        latestUserMessageRef={latestUserMessageRef}
                        messagesContainerRef={messagesContainerRef}
                    />
                </div>

                {isCompact &&
                    activeTab &&
                    !mobileChatOpen &&
                    !mobileExplorerOpen && (
                        <MobileChatFab
                            onClick={() => setMobileChatOpen(true)}
                            busy={isResponseLoading}
                            className="absolute bottom-20 right-4 z-30"
                        />
                    )}
            </div>
            <OwnerOnlyPopup
                open={!!ownerOnlyAction}
                action={ownerOnlyAction ?? undefined}
                onClose={() => setOwnerOnlyAction(null)}
            />
        </div>
    );
}
