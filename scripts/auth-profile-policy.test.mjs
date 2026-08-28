import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeActiveCompanySelection,
  normalizeActiveCompanyId,
  pickProfileUpdates,
} from "../api/functions/auth/profilePolicy.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";

function fakeAdmin({ company = null, memberships = [] } = {}) {
  return {
    from(table) {
      const filters = {};
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          filters[key] = value;
          return query;
        },
        maybeSingle() {
          if (table !== "companies") return Promise.resolve({ data: null, error: null });
          const match = company && String(company.id) === String(filters.id) ? company : null;
          return Promise.resolve({ data: match, error: null });
        },
        limit() {
          if (table !== "company_members") return Promise.resolve({ data: [], error: null });
          const rows = memberships.filter(
            (row) =>
              String(row.company_id) === String(filters.company_id) &&
              String(row.user_id) === String(filters.user_id) &&
              String(row.status) === String(filters.status),
          );
          return Promise.resolve({ data: rows.slice(0, 1), error: null });
        },
      };
      return query;
    },
  };
}

describe("auth/me profile mutation policy", () => {
  it("keeps ordinary profile fields but strips referral attribution and privilege fields", () => {
    const output = pickProfileUpdates({
      full_name: "Ada",
      referral_code: "ADA-123",
      referred_by_code: "FORGED-REF",
      active_company_id: COMPANY_ID,
      role: "admin",
      is_pro: true,
      paying_subscriber: true,
    });

    assert.equal(output.full_name, "Ada");
    assert.equal(output.referral_code, "ADA-123");
    assert.equal(output.active_company_id, COMPANY_ID);
    assert.equal(output.referred_by_code, undefined);
    assert.equal(output.role, undefined);
    assert.equal(output.is_pro, undefined);
    assert.equal(output.paying_subscriber, undefined);
  });

  it("allows clearing company context and rejects malformed company ids", () => {
    assert.equal(normalizeActiveCompanyId(""), "");
    assert.equal(normalizeActiveCompanyId(null), "");
    assert.throws(
      () => normalizeActiveCompanyId("not-a-company-id"),
      (error) => error?.code === "INVALID_COMPANY_ID" && error?.status === 400,
    );
  });

  it("allows an owner to select their company", async () => {
    const admin = fakeAdmin({
      company: { id: COMPANY_ID, owner_id: USER_ID, created_by_id: null },
    });
    assert.equal(
      await authorizeActiveCompanySelection(admin, USER_ID, COMPANY_ID),
      COMPANY_ID,
    );
  });

  it("allows an active company member to select company context", async () => {
    const admin = fakeAdmin({
      company: {
        id: COMPANY_ID,
        owner_id: "33333333-3333-4333-8333-333333333333",
        created_by_id: "33333333-3333-4333-8333-333333333333",
      },
      memberships: [
        { company_id: COMPANY_ID, user_id: USER_ID, status: "active" },
      ],
    });
    assert.equal(
      await authorizeActiveCompanySelection(admin, USER_ID, COMPANY_ID),
      COMPANY_ID,
    );
  });

  it("denies unrelated and removed members", async () => {
    const admin = fakeAdmin({
      company: {
        id: COMPANY_ID,
        owner_id: "33333333-3333-4333-8333-333333333333",
        created_by_id: "33333333-3333-4333-8333-333333333333",
      },
      memberships: [
        { company_id: COMPANY_ID, user_id: USER_ID, status: "removed" },
      ],
    });

    await assert.rejects(
      () => authorizeActiveCompanySelection(admin, USER_ID, COMPANY_ID),
      (error) => error?.code === "COMPANY_ACCESS_DENIED" && error?.status === 403,
    );
  });
});
