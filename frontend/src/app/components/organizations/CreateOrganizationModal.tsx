"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/components/modals/Modal";
import { ModalFieldLabel } from "@/app/components/modals/ModalFieldLabel";
import { ModalTextInput } from "@/app/components/modals/ModalTextInput";
import { useOrganization } from "@/app/contexts/OrganizationContext";

export function CreateOrganizationModal({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const { createOrganization, enterWorkspace } = useOrganization();
    const router = useRouter();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleCreate() {
        if (!name.trim()) return;
        setLoading(true);
        setError("");
        try {
            const organization = await createOrganization(name.trim());
            await enterWorkspace(organization.id);
            setName("");
            onClose();
            router.push("/projects");
        } catch (err) {
            setError((err as Error).message || "Failed to create organization");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="sm"
            breadcrumbs={["Organizations", "New organization"]}
            primaryAction={{
                label: loading ? "Creating…" : "Create organization",
                onClick: () => void handleCreate(),
                disabled: !name.trim() || loading,
            }}
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-500">
                    Create a firm workspace to invite colleagues, share API keys,
                    and keep matters together. Your personal workspace stays
                    available.
                </p>
                <div>
                    <ModalFieldLabel htmlFor="new-organization-name">
                        Organization name
                    </ModalFieldLabel>
                    <ModalTextInput
                        id="new-organization-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Acme LLP"
                        autoFocus
                    />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
        </Modal>
    );
}
