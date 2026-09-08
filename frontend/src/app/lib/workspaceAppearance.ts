const ACCENTS = [
    { background: "#1f1e1a", color: "#f4f1ea" },
    { background: "#3f3a32", color: "#f4f1ea" },
    { background: "#5c4a3a", color: "#f7f1ea" },
    { background: "#3c4a44", color: "#eef3ef" },
    { background: "#3a4454", color: "#eef1f6" },
    { background: "#4a3d4c", color: "#f6eef4" },
] as const;

export function workspaceInitials(name: string) {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) return "S";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function workspaceAccent(key: string) {
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return ACCENTS[hash % ACCENTS.length];
}
