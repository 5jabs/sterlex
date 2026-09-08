export function belongsToWorkspace(
    projectId: string | null | undefined,
    isPersonal: boolean,
    workspaceProjectIds: Set<string>,
): boolean {
    if (!projectId) return isPersonal;
    return workspaceProjectIds.has(projectId);
}

export function filterByWorkspace<T extends { project_id?: string | null }>(
    items: T[],
    isPersonal: boolean,
    workspaceProjectIds: Set<string>,
): T[] {
    return items.filter((item) =>
        belongsToWorkspace(item.project_id, isPersonal, workspaceProjectIds),
    );
}

export function stepPickerIndex(
    index: number,
    delta: number,
    length: number,
): number {
    if (length <= 0) return 0;
    return (index + delta + length) % length;
}
