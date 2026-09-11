import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCTION_MUTATION_CONFIRMATION,
  classifyDatabaseMutationTarget,
  projectRefFromSupabaseUrl,
} from "./db-mutation-safety.mjs";

const productionProjectRef = "prodproject123";
const productionUrl = `https://${productionProjectRef}.supabase.co`;

describe("database mutation target safety", () => {
  it("extracts only canonical Supabase project refs", () => {
    assert.equal(projectRefFromSupabaseUrl(productionUrl), productionProjectRef);
    assert.equal(projectRefFromSupabaseUrl("https://example.com"), null);
    assert.equal(projectRefFromSupabaseUrl("not-a-url"), null);
  });

  it("allows a different Supabase project as non-production", () => {
    const result = classifyDatabaseMutationTarget({
      url: "https://stagingproject456.supabase.co",
      productionProjectRef,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.target, "NON_PRODUCTION");
  });

  it("fails closed when production confirmation is missing", () => {
    const result = classifyDatabaseMutationTarget({
      url: productionUrl,
      productionProjectRef,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.target, "PRODUCTION");
    assert.equal(result.reason, "production_confirmation_missing");
  });

  it("requires the approved production project ref to match exactly", () => {
    const result = classifyDatabaseMutationTarget({
      url: productionUrl,
      productionProjectRef,
      productionConfirmation: PRODUCTION_MUTATION_CONFIRMATION,
      approvedProductionProjectRef: "wrongproject",
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, "approved_production_project_ref_mismatch");
  });

  it("allows production only after both explicit checks match", () => {
    const result = classifyDatabaseMutationTarget({
      url: productionUrl,
      productionProjectRef,
      productionConfirmation: PRODUCTION_MUTATION_CONFIRMATION,
      approvedProductionProjectRef: productionProjectRef,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.target, "PRODUCTION");
    assert.equal(result.reason, "production_explicitly_authorized");
  });

  it("fails closed when production identity is not configured", () => {
    const result = classifyDatabaseMutationTarget({
      url: "https://stagingproject456.supabase.co",
      productionProjectRef: "",
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, "missing_production_project_ref");
  });
});
