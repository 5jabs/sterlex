"use client";

import { useEffect, useState } from "react";
import { AccountSection } from "@/app/(pages)/account/AccountSection";
import { useOrganizationSettings } from "../OrganizationSettingsContext";
import {
    listOrganizationActivity,
    type OrganizationActivityEvent,
} from "@/app/lib/sterlexApi";
import {
    formatActivityWhen,
    organizationActivityLabel,
} from "@/app/lib/organizationActivityCopy";

export default function OrganizationActivityPage() {
    const { organization } = useOrganizationSettings();
    const [events, setEvents] = useState<OrganizationActivityEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        listOrganizationActivity(organization.id)
            .then((next) => {
                if (!cancelled) {
                    setEvents(next);
                    setError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError((err as Error).message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [organization.id]);

    return (
        <div>
            <h2 className="mb-3 font-serif text-2xl font-medium text-gray-900">
                Activity
            </h2>
            <p className="mb-4 text-sm text-gray-500">
                Member, invite, settings, API key, and project-access changes
                in {organization.name}. Project events are hidden unless you
                can already open that matter.
            </p>
            <AccountSection>
                {loading ? (
                    <p className="px-4 py-6 text-sm text-gray-500">
                        Loading activity…
                    </p>
                ) : events.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500">
                        Nothing has been recorded yet. Invites, member changes,
                        and project access updates will show up here.
                    </p>
                ) : (
                    events.map((event) => (
                        <div
                            key={event.id}
                            className="border-b border-gray-100 px-4 py-3 last:border-b-0"
                        >
                            <p className="text-sm text-gray-800">
                                {organizationActivityLabel(event)}
                            </p>
                            <p className="text-xs text-gray-500">
                                {formatActivityWhen(event.created_at)}
                            </p>
                        </div>
                    ))
                )}
            </AccountSection>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
    );
}
