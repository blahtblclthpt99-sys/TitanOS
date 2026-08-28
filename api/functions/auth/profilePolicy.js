import { AppError } from "../../_lib/apiError.js";

export const USER_EDITABLE_PROFILE_FIELDS = Object.freeze([
  "full_name",
  "phone",
  "username",
  "avatar_url",
  "bio",
  "city",
  "state",
  "company_name",
  "company_address",
  "company_city",
  "company_state",
  "company_zip",
  "company_logo_url",
  "theme_pref",
  "notification_prefs",
  "marketing_prefs",
  "privacy_prefs",
  "professional_profile",
  "community_opt_in",
  "referral_code",
  "active_company_id",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pickProfileUpdates(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return USER_EDITABLE_PROFILE_FIELDS.reduce((acc, key) => {
    if (input[key] !== undefined) acc[key] = input[key];
    return acc;
  }, {});
}

export function normalizeActiveCompanyId(value) {
  if (value === undefined) return undefined;
  if (value === null) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  if (!UUID_RE.test(normalized)) {
    throw new AppError("Invalid company selection", {
      status: 400,
      code: "INVALID_COMPANY_ID",
      category: "auth",
    });
  }
  return normalized.toLowerCase();
}

async function loadCompany(admin, companyId) {
  const { data, error } = await admin
    .from("companies")
    .select("id, owner_id, created_by_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new AppError("Could not verify company access", {
      status: 503,
      code: "COMPANY_ACCESS_UNAVAILABLE",
      category: "auth",
      cause: error,
    });
  }
  return data || null;
}

async function hasActiveMembership(admin, userId, companyId) {
  const { data, error } = await admin
    .from("company_members")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);

  if (error) {
    throw new AppError("Could not verify company access", {
      status: 503,
      code: "COMPANY_ACCESS_UNAVAILABLE",
      category: "auth",
      cause: error,
    });
  }
  return Array.isArray(data) && data.length > 0;
}

export async function authorizeActiveCompanySelection(admin, userId, requestedValue) {
  const companyId = normalizeActiveCompanyId(requestedValue);
  if (companyId === undefined) return undefined;
  if (companyId === "") return "";

  const company = await loadCompany(admin, companyId);
  if (!company) {
    throw new AppError("Company access is not available", {
      status: 403,
      code: "COMPANY_ACCESS_DENIED",
      category: "auth",
    });
  }

  if (
    String(company.owner_id || "") === userId ||
    String(company.created_by_id || "") === userId
  ) {
    return companyId;
  }

  if (await hasActiveMembership(admin, userId, companyId)) {
    return companyId;
  }

  throw new AppError("Company access is not available", {
    status: 403,
    code: "COMPANY_ACCESS_DENIED",
    category: "auth",
  });
}
