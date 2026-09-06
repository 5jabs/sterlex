"use client";

import type { ReactNode, RefObject } from "react";
import { UserMessage } from "@/app/components/assistant/UserMessage";
import { AssistantMessage } from "@/app/components/assistant/AssistantMessage";
import { ChatInput } from "@/app/components/assistant/ChatInput";
import type { ChatInputHandle } from "@/app/components/assistant/ChatInput";
import type {
    Citation,
    EditAnnotation,
    Message,
} from "@/app/components/shared/types";
import { cn } from "@/app/lib/utils";

export const PROJECT_CHAT_BOTTOM_PADDING = 116;

export function ProjectChatPane({
    chatLoaded,
    messages,
    isResponseLoading,
    minHeight,
    projectName,
    projectCmNumber,
    hideAddDocButton = true,
    greeting,
    className,
    onSubmit,
    onCancel,
    onCitationClick,
    onEditViewClick,
    onOpenDocument,
    onEditResolved,
    onEditError,
    isDocReloading,
    chatInputRef,
    latestUserMessageRef,
    messagesContainerRef,
}: {
    chatLoaded: boolean;
    messages: Message[];
    isResponseLoading: boolean;
    minHeight: string;
    projectName?: string;
    projectCmNumber?: string | null;
    hideAddDocButton?: boolean;
    greeting?: ReactNode;
    className?: string;
    onSubmit: (message: Message) => void;
    onCancel: () => void;
    onCitationClick?: (citation: Citation) => void;
    onEditViewClick?: (ann: EditAnnotation, filename: string) => void;
    onOpenDocument?: (args: {
        documentId: string;
        filename: string;
        versionId: string | null;
        versionNumber: number | null;
    }) => void;
    onEditResolved?: (args: {
        editId: string;
        documentId: string;
        status: "accepted" | "rejected";
        versionId: string | null;
        downloadUrl: string | null;
    }) => void;
    onEditError?: (args: { documentId: string; message: string }) => void;
    isDocReloading?: (docId: string) => boolean;
    chatInputRef: RefObject<ChatInputHandle | null>;
    latestUserMessageRef: RefObject<HTMLDivElement | null>;
    messagesContainerRef: RefObject<HTMLDivElement | null>;
}) {
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

    return (
        <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
            {!chatLoaded ? (
                <div className="flex-1 space-y-4 px-4 py-4">
                    <div className="flex justify-end">
                        <div className="w-3/4 rounded-2xl bg-gray-100 p-4">
                            <div className="h-3 w-full animate-[shimmer_2s_ease-in-out_infinite] rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`h-3 animate-[shimmer_2s_ease-in-out_infinite] rounded bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] ${
                                    i === 3 ? "w-4/6" : "w-full"
                                }`}
                            />
                        ))}
                    </div>
                </div>
            ) : messages.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col">
                    {greeting ?? (
                        <div className="flex flex-1 items-center justify-center px-8">
                            <div className="max-w-sm space-y-2 text-center">
                                <p className="font-serif text-base text-gray-500">
                                    Use this chat to discuss and edit this
                                    project&apos;s documents — including
                                    creating new versions.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    ref={messagesContainerRef}
                    className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-6 md:space-y-8 md:pt-8"
                    style={{
                        paddingBottom: PROJECT_CHAT_BOTTOM_PADDING,
                        scrollbarGutter: "stable",
                    }}
                >
                    {messages.map((msg, i) =>
                        msg.role === "user" ? (
                            <div
                                key={i}
                                ref={
                                    i === lastUserIdx
                                        ? latestUserMessageRef
                                        : null
                                }
                            >
                                <UserMessage
                                    content={msg.content ?? ""}
                                    files={msg.files}
                                    workflow={msg.workflow}
                                />
                            </div>
                        ) : (
                            <AssistantMessage
                                key={i}
                                events={msg.events}
                                isStreaming={
                                    i === messages.length - 1 &&
                                    isResponseLoading
                                }
                                isError={!!msg.error}
                                citations={msg.citations}
                                citationStatus={msg.citationStatus}
                                onCitationClick={onCitationClick}
                                minHeight={
                                    i === lastAssistantIdx ? minHeight : "0px"
                                }
                                onEditViewClick={onEditViewClick}
                                onOpenDocument={onOpenDocument}
                                onEditResolved={onEditResolved}
                                onEditError={onEditError}
                                isDocReloading={isDocReloading}
                            />
                        ),
                    )}
                </div>
            )}

            <div className="absolute bottom-2 left-0 right-0 z-30 w-full md:bottom-3">
                <div className="pointer-events-none absolute -bottom-2 left-4 right-4 z-0 h-7 bg-white/50 backdrop-blur-[1px] md:-bottom-3" />
                <div className="relative z-20 w-full px-4">
                    <ChatInput
                        ref={chatInputRef}
                        onSubmit={onSubmit}
                        onCancel={onCancel}
                        isLoading={isResponseLoading}
                        hideAddDocButton={hideAddDocButton}
                        projectName={projectName}
                        projectCmNumber={projectCmNumber}
                    />
                </div>
            </div>
        </div>
    );
}
