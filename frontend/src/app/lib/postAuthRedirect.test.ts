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

    it("sends everyone else to the workspace picker", () => {
        assert.equal(postAuthRedirectPath(""), "/workspaces");
        assert.equal(postAuthRedirectPath("?next=/projects"), "/workspaces");
        assert.equal(postAuthRedirectPath("?next=https://evil.test"), "/workspaces");
    });

    it("preserves the current search string on auth links", () => {
        assert.equal(
            withCurrentSearch("/signup", "?invite=abc"),
            "/signup?invite=abc",
        );
    });
});
