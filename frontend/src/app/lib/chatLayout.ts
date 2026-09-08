/** Fallback when the composer has not been measured yet. */
export const DEFAULT_CHAT_COMPOSER_RESERVE_PX = 116;

/** Gap between the last message and the floating composer. */
export const CHAT_COMPOSER_GAP_PX = 28;

export function chatComposerReservePx(inputHeight: number): number {
    if (inputHeight <= 0) return DEFAULT_CHAT_COMPOSER_RESERVE_PX;
    return Math.max(
        DEFAULT_CHAT_COMPOSER_RESERVE_PX,
        Math.ceil(inputHeight) + CHAT_COMPOSER_GAP_PX,
    );
}
