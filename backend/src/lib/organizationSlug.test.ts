import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    slugifyOrganizationName,
    uniqueOrganizationSlug,
} from "./organizationSlug";

describe("organization slugs", () => {
    it("slugifies names", () => {
        assert.equal(slugifyOrganizationName("Acme LLP"), "acme-llp");
        assert.equal(slugifyOrganizationName("  Hello, World!  "), "hello-world");
    });

    it("falls back when the name has no slug characters", () => {
        assert.equal(slugifyOrganizationName("***"), "org");
    });

    it("allocates a unique slug when the base is taken", () => {
        const existing = new Set(["acme", "acme-2"]);
        assert.equal(uniqueOrganizationSlug("Acme", existing), "acme-3");
    });
});
