/**
 * Scalability regression — page budgets, indexes, caps, serverless budgets.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("scalability surfaces", () => {
  it("migration 034 adds hot indexes and driver_trips", () => {
    const sql = read("supabase/migrations/034_scalability_hot_paths.sql");
    assert.match(sql, /jobs_customer_scheduled_idx/);
    assert.match(sql, /notifications_user_unread_idx/);
    assert.match(sql, /driver_trips/);
  });

  it("core RLS migration caches request-constant auth predicates and covers payment FK lookup", () => {
    const sql = read("supabase/migrations/20260818083000_optimize_core_rls_initplans.sql");
    assert.match(sql, /idx_payments_created_by_id/);
    assert.match(sql, /idx_company_members_company_user_active/);
    assert.match(sql, /id = \(select auth\.uid\(\)\)/);
    assert.match(sql, /created_by_id = \(select auth\.uid\(\)\)/);
    assert.match(sql, /\(select public\.is_admin\(\)\)/);
    assert.match(sql, /assigned_to = \(select auth\.uid\(\)\)::text/);
    assert.match(sql, /coalesce\(status, 'pending'\) <> all/);
    assert.match(sql, /public\.is_company_member\(company_id\)/);
  });

  it("hot secondary RLS migration preserves ownership rules with init plans", () => {
    const sql = read("supabase/migrations/20260818085000_optimize_hot_secondary_rls.sql");
    assert.match(sql, /idx_notifications_created_by_id/);
    assert.match(sql, /idx_marketplace_messages_created_by_id/);
    assert.match(sql, /idx_driver_profiles_created_by_id/);
    assert.match(sql, /driver_trips_own_select/);
    assert.match(sql, /user_id = \(select auth\.uid\(\)\)/);
    assert.match(sql, /sender_id = \(select auth\.uid\(\)\)::text/);
    assert.match(sql, /recipient_id = \(select auth\.uid\(\)\)::text/);
    assert.match(sql, /created_by_id = \(select auth\.uid\(\)\)/);
    assert.match(sql, /\(select public\.is_admin\(\)\)/);
    assert.match(sql, /status = 'active'/);
    assert.match(sql, /published = true/);
    assert.match(sql, /seller_id = \(select auth\.uid\(\)\)::text/);
    assert.doesNotMatch(sql, /module_installs_all/);
  });

  it("entity adapter exposes preferred page size and filterPage", () => {
    const src = read("src/api/entityAdapter.js");
    assert.match(src, /PREFERRED_ENTITY_PAGE_SIZE\s*=\s*100/);
    assert.match(src, /async filterPage\(/);
    assert.match(src, /MAX_ENTITY_PAGE_SIZE\s*=\s*500/);
  });

  it("finances and tax do not pull 500-row working sets", () => {
    assert.doesNotMatch(read("src/pages/Finances.jsx"), /list", args: \["-created_date", 500\]/);
    assert.doesNotMatch(read("src/pages/TaxCenter.jsx"), /,\s*500\s*\]/);
    assert.match(read("src/pages/Finances.jsx"), /100/);
  });

  it("messages local store is capped", () => {
    const src = read("src/lib/messagesApi.js");
    assert.match(src, /MAX_LOCAL_MESSAGES\s*=\s*500/);
    assert.match(src, /MAX_LOCAL_THREADS\s*=\s*100/);
    assert.match(src, /slice\(0,\s*MAX_LOCAL_MESSAGES\)/);
  });

  it("vercel sets maxDuration on money and AI routes", () => {
    const cfg = JSON.parse(read("vercel.json"));
    assert.equal(cfg.functions["api/functions/stripeWebhook.js"].maxDuration, 30);
    assert.equal(cfg.functions["api/functions/titanAI.js"].maxDuration, 60);
    assert.equal(cfg.functions["api/functions/createPaymentLink.js"].maxDuration, 30);
  });

  it("rate limit supports durable Upstash async path", () => {
    const src = read("api/_lib/rateLimit.js");
    assert.match(src, /assertRateLimitAsync/);
    assert.match(src, /UPSTASH_REDIS_REST_URL/);
    assert.match(read("api/functions/createPaymentLink.js"), /assertRateLimitAsync/);
  });

  it("trip journal syncs to cloud driver_trips", () => {
    const src = read("src/lib/driverActivity/tripJournal.js");
    assert.match(src, /syncTripJournalRowToCloud/);
    assert.match(src, /driver_trips/);
  });
});
