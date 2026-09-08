export function postAuthRedirectPath(search = ""): string {
    const params = new URLSearchParams(
        search.startsWith("?") ? search.slice(1) : search,
    );
    const invite = params.get("invite")?.trim();
    if (invite) {
        return `/organizations/invites/${encodeURIComponent(invite)}`;
    }
    return "/workspaces";
}

export function withCurrentSearch(href: string, search = ""): string {
    if (!search || search === "?") return href;
    const suffix = search.startsWith("?") ? search : `?${search}`;
    return `${href}${suffix}`;
}
