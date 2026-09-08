const SLUG_MAX = 48;

export function slugifyOrganizationName(name: string): string {
    const normalized = name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, SLUG_MAX);
    return normalized || "org";
}

export function uniqueOrganizationSlug(base: string, existing: Set<string>): string {
    const root = slugifyOrganizationName(base);
    if (!existing.has(root)) return root;
    for (let i = 2; i < 1000; i += 1) {
        const suffix = `-${i}`;
        const candidate = `${root.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
        if (!existing.has(candidate)) return candidate;
    }
    const entropy = Math.random().toString(36).slice(2, 8);
    return `${root.slice(0, SLUG_MAX - entropy.length - 1)}-${entropy}`;
}
