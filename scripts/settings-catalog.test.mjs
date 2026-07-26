import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_PANELS,
  NOTIFICATION_OPTIONS,
  PRIVACY_OPTIONS,
  APPEARANCE_OPTIONS,
  defaultNotificationPrefs,
  defaultPrivacyPrefs,
  defaultAppearancePrefs,
  searchSettings,
  buildResetPayload,
  listSettingsSearchDocs,
} from "../src/lib/settingsCatalog.js";

describe("settings catalog", () => {
  it("has five categories and documented panels", () => {
    assert.equal(SETTINGS_CATEGORIES.length, 5);
    assert.ok(SETTINGS_PANELS.length >= 8);
    for (const p of SETTINGS_PANELS) {
      assert.ok(p.id && p.title && p.description && p.docs, `panel ${p.id} needs docs`);
      assert.ok(SETTINGS_CATEGORIES.some((c) => c.id === p.category), `panel ${p.id} category`);
    }
  });

  it("documents notification/privacy/appearance options with defaults", () => {
    for (const o of NOTIFICATION_OPTIONS) {
      assert.equal(typeof o.default, "boolean");
      assert.ok(o.docs);
    }
    for (const o of PRIVACY_OPTIONS) {
      assert.ok(typeof o.default === "boolean", `${o.key} needs boolean default`);
      assert.ok(o.docs);
    }
    assert.equal(PRIVACY_OPTIONS.find((o) => o.key === "session_replay")?.default, false);
    assert.equal(PRIVACY_OPTIONS.find((o) => o.key === "product_analytics")?.default, true);
    for (const o of APPEARANCE_OPTIONS) {
      assert.ok(o.default != null);
      assert.ok(o.docs);
    }
  });

  it("default prefs match option defaults", () => {
    const n = defaultNotificationPrefs();
    assert.equal(n.jobs, true);
    assert.equal(n.system, true);
    const p = defaultPrivacyPrefs();
    assert.equal(p.community_opt_in, false);
    assert.equal(p.privacy_prefs.show_in_community, false);
    const a = defaultAppearancePrefs();
    assert.equal(a.theme_pref, "system");
    assert.equal(a.text_scale, "md");
  });

  it("search finds panels and options", () => {
    const hit = searchSettings("theme");
    assert.ok(hit.panels.some((p) => p.id === "theme"));
    const notif = searchSettings("job updates");
    assert.ok(notif.options.some((o) => /job/i.test(o.label)));
  });

  it("reset payloads cover preference panels only", () => {
    assert.ok(buildResetPayload("notifications").notification_prefs);
    assert.ok(buildResetPayload("privacy").privacy_prefs);
    assert.ok(buildResetPayload("marketing").marketing_prefs);
    assert.equal(buildResetPayload("theme").theme_pref, "system");
    assert.equal(buildResetPayload("profile"), null);
    assert.equal(buildResetPayload("security"), null);
  });

  it("search docs cover options for global search", () => {
    const docs = listSettingsSearchDocs();
    assert.ok(docs.length > SETTINGS_PANELS.length);
    assert.ok(docs.every((d) => d.path && d.label));
  });
});
