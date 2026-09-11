export const PRODUCTION_MUTATION_CONFIRMATION =
  "I_UNDERSTAND_THIS_MUTATES_PRODUCTION";

export function projectRefFromSupabaseUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".supabase.co")) return null;

    const [projectRef] = host.split(".");
    return projectRef || null;
  } catch {
    return null;
  }
}

export function classifyDatabaseMutationTarget({
  url,
  productionProjectRef,
  productionConfirmation,
  approvedProductionProjectRef,
}) {
  const projectRef = projectRefFromSupabaseUrl(url);
  const canonicalProductionRef = String(productionProjectRef || "").trim();

  if (!projectRef) {
    return {
      allowed: false,
      projectRef: null,
      target: "UNKNOWN",
      reason: "invalid_or_non_supabase_url",
    };
  }

  if (!canonicalProductionRef) {
    return {
      allowed: false,
      projectRef,
      target: "UNKNOWN",
      reason: "missing_production_project_ref",
    };
  }

  if (projectRef !== canonicalProductionRef) {
    return {
      allowed: true,
      projectRef,
      target: "NON_PRODUCTION",
      reason: "non_production_target",
    };
  }

  if (productionConfirmation !== PRODUCTION_MUTATION_CONFIRMATION) {
    return {
      allowed: false,
      projectRef,
      target: "PRODUCTION",
      reason: "production_confirmation_missing",
    };
  }

  if (String(approvedProductionProjectRef || "").trim() !== projectRef) {
    return {
      allowed: false,
      projectRef,
      target: "PRODUCTION",
      reason: "approved_production_project_ref_mismatch",
    };
  }

  return {
    allowed: true,
    projectRef,
    target: "PRODUCTION",
    reason: "production_explicitly_authorized",
  };
}
