import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postAuthRedirectPath, withCurrentSearch } from "./postAuthRedirect";

describe("post-auth redirect", () => {
    it("sends invite tokens to the accept page", () => {
        assert.equal(
            postAuthRedirectPath("?invite=abc123"),
            "/organizations/invites/abc123",
        );
    });

    it("allows a safe next path", () => {
        assert.equal(postAuthRedirectPath("?next=/projects"), "/projects");
        assert.equal(postAuthRedirectPath("?next=https://evil.test"), "/assistant");
    });

    it("preserves the current search string on auth links", () => {
        assert.equal(
            withCurrentSearch("/signup", "?invite=abc"),
            "/signup?invite=abc",
        );
    });
});
