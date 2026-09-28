"use client";

import { useState } from "react";
import { SiteLogo } from "@/app/components/site-logo";
import { ChatInput } from "./ChatInput";
import { SelectAssistantProjectModal } from "./SelectAssistantProjectModal";
import { useUserProfile } from "@/app/contexts/UserProfileContext";
import { updateUserProfile } from "@/app/lib/sterlexApi";
import type { Message } from "../shared/types";

interface InitialViewProps {
    onSubmit: (message: Message) => void;
}

export function InitialView({ onSubmit }: InitialViewProps) {
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const { profile, reloadProfile } = useUserProfile();
    const showOnboarding = profile && !profile.onboardingCompleted;

    async function dismissOnboarding() {
        await updateUserProfile({ onboardingCompleted: true });
        await reloadProfile();
    }

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
            <div className="flex justify-center pt-[4vh] md:pt-[14vh]">
                <SiteLogo size="xl" className="text-3xl md:text-6xl" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="flex-col items-center w-full max-w-4xl relative px-0 xl:px-8">
                    {showOnboarding && (
                        <div className="mb-6 rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-600">
                            <p className="font-medium text-gray-900">
                                Three steps to a first answer
                            </p>
                            <ol className="mt-2 list-decimal space-y-1 pl-5">
                                <li>Upload a PDF or Word file (paperclip in the composer).</li>
                                <li>Ask a question about it.</li>
                                <li>
                                    Upgrade on{" "}
                                    <a href="/account/billing" className="underline">
                                        Billing
                                    </a>{" "}
                                    when free tokens run out.
                                </li>
                            </ol>
                            <button
                                type="button"
                                className="mt-3 text-xs text-gray-400 underline"
                                onClick={() => void dismissOnboarding()}
                            >
                                Don&apos;t show this again
                            </button>
                        </div>
                    )}
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
