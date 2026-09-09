import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    DEFAULT_CHAT_COMPOSER_RESERVE_PX,
    chatComposerReservePx,
} from "./chatLayout";

describe("chat composer reserve", () => {
    it("uses the fallback when the composer has not been measured", () => {
        assert.equal(chatComposerReservePx(0), DEFAULT_CHAT_COMPOSER_RESERVE_PX);
        assert.equal(chatComposerReservePx(-1), DEFAULT_CHAT_COMPOSER_RESERVE_PX);
    });

    it("grows with a taller mobile composer", () => {
        assert.equal(chatComposerReservePx(160), 188);
        assert.ok(chatComposerReservePx(160) > DEFAULT_CHAT_COMPOSER_RESERVE_PX);
    });

    it("never shrinks below the fallback for a short composer", () => {
        assert.equal(chatComposerReservePx(40), DEFAULT_CHAT_COMPOSER_RESERVE_PX);
    });
});
