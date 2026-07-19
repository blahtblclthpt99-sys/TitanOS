/** Maps TitanOS entity names to Supabase table names. */
export const ENTITY_TABLES = {
  Customer: "customers",
  Job: "jobs",
  Invoice: "invoices",
  Estimate: "estimates",
  Expense: "expenses",
  Employee: "employees",
  MileageTrip: "mileage_trips",
  MarketplaceModule: "marketplace_modules",
  ModuleInstall: "module_installs",
  ModuleWaitlist: "module_waitlists",
  DeveloperApplication: "developer_applications",
  Referral: "referrals",
  BetaSignup: "beta_signups",
  BetaFeedback: "beta_feedbacks",
  PortalSession: "portal_sessions",
  MarketplaceListing: "marketplace_listings",
  MarketplaceFavorite: "marketplace_favorites",
  MarketplaceReport: "marketplace_reports",
  MarketplaceMessage: "marketplace_messages",
  MarketplaceReview: "marketplace_reviews",
  HireJob: "hire_jobs",
  HireApplication: "hire_applications",
  HireSave: "hire_saves",
  CommunityPost: "community_posts",
  CommunityLike: "community_likes",
  CommunityComment: "community_comments",
  ActivityEvent: "activity_events",
  Notification: "notifications",
  JobReview: "job_reviews",
  PriceEstimate: "price_estimates",
  CustomerCommunication: "customer_communications",
  CustomerFile: "customer_files",
  BookingPage: "booking_pages",
  BookingRequest: "booking_requests",
  AvailabilitySlot: "availability_slots",
  JobPhoto: "job_photos",
  JobCheckin: "job_checkins",
  Contract: "contracts",
  Company: "companies",
  CompanyMember: "company_members",
  PaymentAccount: "payment_accounts",
  Payment: "payments",
  ReceiptScan: "receipt_scans",
  Equipment: "equipment",
  InventoryItem: "inventory_items",
  FollowUpRule: "follow_up_rules",
  FollowUpQueue: "follow_up_queue",
  Credential: "credentials",
  LoyaltyMember: "loyalty_members",
  LoyaltyEvent: "loyalty_events",
  EmergencyJob: "emergency_jobs",
  EscrowHold: "escrow_holds",
  MarketingAsset: "marketing_assets",
  PhoneScript: "phone_scripts",
};

const META_COLUMNS = new Set(["id", "created_at", "updated_at", "created_by_id"]);

export function toEntityRow(row) {
  if (!row) return row;
  return {
    ...row,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

export function stripMetaFields(data) {
  const payload = { ...data };
  for (const key of META_COLUMNS) {
    delete payload[key];
  }
  delete payload.created_date;
  delete payload.updated_date;
  return payload;
}

/** Sort strings like "-created_date" → Supabase order column. */
export function parseSort(sort) {
  if (!sort) {
    return { column: "created_at", ascending: false };
  }
  const descending = sort.startsWith("-");
  const raw = descending ? sort.slice(1) : sort;
  const column =
    raw === "created_date"
      ? "created_at"
      : raw === "updated_date"
        ? "updated_at"
        : raw;
  return { column, ascending: !descending };
}
