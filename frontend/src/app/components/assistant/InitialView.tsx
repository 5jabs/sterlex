"use client";

import { useState } from "react";
import { SiteLogo } from "@/app/components/site-logo";
import { ChatInput } from "./ChatInput";
import { SelectAssistantProjectModal } from "./SelectAssistantProjectModal";
import type { Message } from "../shared/types";

interface InitialViewProps {
    onSubmit: (message: Message) => void;
}

export function InitialView({ onSubmit }: InitialViewProps) {
    const [projectModalOpen, setProjectModalOpen] = useState(false);

    return (
        <div className="flex flex-col h-full w-full px-6">
            <div className="flex justify-center pt-[10vh] md:pt-[14vh]">
                <SiteLogo size="xl" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="flex-col items-center w-full max-w-4xl relative px-0 xl:px-8">
                    <ChatInput
                        onSubmit={onSubmit}
                        onCancel={() => {}}
                        isLoading={false}
                        onProjectsClick={() => setProjectModalOpen(true)}
                    />

                    <div className="text-center">
                        <p className="text-xs py-3 mb-3 text-gray-500">
                            AI can make mistakes. Answers are not legal advice.
                        </p>
                    </div>
                </div>
            </div>

            <SelectAssistantProjectModal
                open={projectModalOpen}
                onClose={() => setProjectModalOpen(false)}
            />
        </div>
    );
}
