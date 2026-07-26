/** Default one-time install price for every marketplace module. */
export const MODULE_PRICE = 0;
export const MODULE_PRICE_LABEL = "Free beta perk";

export const MARKETPLACE_CATEGORIES = [
  "All",
  "HVAC",
  "Cleaning",
  "Roofing",
  "Pest Control",
  "Trades",
  "Home & Lifestyle",
  "Pets & Care",
  "Creative",
  "Tech",
  "Events",
  "Legal & Security",
  "Accounting",
  "Inventory",
  "AI Agents",
  "Reports",
];

function mod(partial) {
  return {
    price: MODULE_PRICE,
    price_label: MODULE_PRICE_LABEL,
    verified: true,
    status: "available",
    route: null,
    review_count: 48,
    install_count: 120,
    rating: 4.7,
    ...partial,
  };
}

/**
 * Marketplace app catalog — every module is free during public beta.
 * Static catalog is the product source of truth (DB seed syncs from here).
 */
export const MARKETPLACE_MODULES = [
  mod({
    slug: "hvac-pro",
    name: "HVAC Pro Suite",
    description:
      "Equipment tracking, maintenance logs, refrigerant management, and seasonal scheduling for HVAC companies.",
    category: "HVAC",
    rating: 4.9,
    review_count: 312,
    icon: "🌡️",
    gradient: "from-blue-500/20 to-cyan-500/20",
    features: ["Equipment registry", "Maintenance scheduler", "Refrigerant tracker", "Warranty management"],
    install_count: 2100,
  }),
  mod({
    slug: "cleaning-workflows",
    name: "Cleaning Pro Workflows",
    description:
      "Digital checklists, room-by-room inspections, supply tracking, and client satisfaction scores.",
    category: "Cleaning",
    rating: 4.8,
    review_count: 187,
    icon: "🧹",
    gradient: "from-purple-500/20 to-pink-500/20",
    features: ["Room checklists", "Photo inspections", "Supply inventory", "Customer ratings"],
    install_count: 1400,
  }),
  mod({
    slug: "roofing-estimator",
    name: "Roofing Estimator AI",
    description:
      "AI-powered material takeoffs, pitch calculations, satellite roof measurements, and photo-based damage reports.",
    category: "Roofing",
    rating: 4.7,
    review_count: 94,
    icon: "🏠",
    gradient: "from-amber-500/20 to-orange-500/20",
    features: ["Satellite measurements", "AI material takeoffs", "Damage reports", "Manufacturer pricing"],
    install_count: 680,
    route: "/estimates",
  }),
  mod({
    slug: "pest-inspection",
    name: "Pest Control Inspector",
    description:
      "Digital inspection forms, treatment tracking, chemical logs, and compliance documentation.",
    category: "Pest Control",
    rating: 4.6,
    review_count: 58,
    icon: "🐛",
    gradient: "from-green-500/20 to-emerald-500/20",
    features: ["Inspection templates", "Chemical log", "Treatment history", "State compliance"],
    install_count: 410,
    verified: false,
  }),
  mod({
    slug: "babysitting-pro",
    name: "Babysitting, Nanny & Home Cook",
    description:
      "One care kit for sitters, nannies, and home cooks — family profiles, schedules, meal notes, emergency contacts, and activity logs.",
    category: "Pets & Care",
    rating: 4.8,
    review_count: 214,
    icon: "👶",
    gradient: "from-rose-500/20 to-pink-500/20",
    features: ["Sitter & nanny schedules", "Home-cook meal notes", "Emergency contacts", "Family messaging"],
    install_count: 1240,
  }),
  mod({
    slug: "window-installer",
    name: "Window Installer Pro",
    description:
      "Measure sheets, glass/order tracking, install checklists, sealant notes, and warranty packs for window crews.",
    category: "Trades",
    rating: 4.7,
    review_count: 91,
    icon: "🪟",
    gradient: "from-sky-500/20 to-cyan-500/20",
    features: ["Measure sheets", "Order tracking", "Install checklists", "Warranty packs"],
    install_count: 410,
  }),
  mod({
    slug: "carpet-layer",
    name: "Carpet Layer Ops",
    description:
      "Room takeoffs, pad & roll inventory, stretch/seam notes, and photo proof for carpet installers.",
    category: "Trades",
    rating: 4.6,
    review_count: 77,
    icon: "🧶",
    gradient: "from-amber-500/20 to-yellow-500/20",
    features: ["Room takeoffs", "Pad & roll inventory", "Seam notes", "Photo proof"],
    install_count: 360,
  }),
  mod({
    slug: "tile-setter",
    name: "Tile Setter Suite",
    description:
      "Layout grids, material counts, thinset/grout logs, and wet-area waterproofing checklists for tile pros.",
    category: "Trades",
    rating: 4.8,
    review_count: 128,
    icon: "🧱",
    gradient: "from-stone-500/20 to-orange-500/20",
    features: ["Layout grids", "Material counts", "Grout logs", "Waterproof checklists"],
    install_count: 540,
  }),
  mod({
    slug: "sheetrock-finisher",
    name: "Sheetrock & Drywall",
    description:
      "Board counts, hang/tape/float stages, mud coats, and sanding punch lists for drywall crews.",
    category: "Trades",
    rating: 4.7,
    review_count: 103,
    icon: "⬜",
    gradient: "from-neutral-500/20 to-slate-500/20",
    features: ["Board counts", "Hang/tape stages", "Mud coats", "Sanding punch lists"],
    install_count: 480,
  }),
  mod({
    slug: "trim-work",
    name: "Trim & Finish Carpentry",
    description:
      "Base/casing lists, miter cut sheets, paint-grade vs stain notes, and final walkthrough checklists.",
    category: "Trades",
    rating: 4.8,
    review_count: 95,
    icon: "🪵",
    gradient: "from-yellow-700/20 to-amber-500/20",
    features: ["Base & casing lists", "Miter cut sheets", "Finish notes", "Walkthrough checklists"],
    install_count: 420,
  }),
  mod({
    slug: "mobile-car-wash",
    name: "Mobile Car Wash",
    description:
      "Route booking, vehicle profiles, wash packages, before/after photos, and water/chemical logs for mobile detailers.",
    category: "Trades",
    rating: 4.8,
    review_count: 162,
    icon: "🚗",
    gradient: "from-cyan-500/20 to-blue-500/20",
    features: ["Route booking", "Wash packages", "Before/after photos", "Supply logs"],
    install_count: 710,
  }),
  mod({
    slug: "mobile-mechanic",
    name: "Mobile Mechanic",
    description:
      "On-site diagnostics, parts runs, service checklists, warranty notes, and roadside job tracking for mobile techs.",
    category: "Trades",
    rating: 4.9,
    review_count: 198,
    icon: "🔩",
    gradient: "from-red-500/20 to-orange-500/20",
    features: ["On-site diagnostics", "Parts runs", "Service checklists", "Roadside tracking"],
    install_count: 860,
    route: "/jobs",
  }),
  mod({
    slug: "christmas-light-installer",
    name: "Christmas Light Installer",
    description:
      "Seasonal routes, roof/eave measure sheets, design packages, take-down schedules, and storage inventory for holiday lighting crews.",
    category: "Trades",
    rating: 4.8,
    review_count: 143,
    icon: "🎄",
    gradient: "from-green-500/20 to-red-500/20",
    features: ["Seasonal routes", "Eave measure sheets", "Design packages", "Take-down schedules"],
    install_count: 650,
    route: "/schedule",
  }),
  mod({
    slug: "dog-walking",
    name: "Dog Walking Routes",
    description:
      "Walk routes, pet profiles, GPS check-ins, photo drop-offs, and billing for walking & pet-sitting gigs.",
    category: "Pets & Care",
    rating: 4.9,
    review_count: 241,
    icon: "🐕",
    gradient: "from-orange-500/20 to-amber-500/20",
    features: ["Route maps", "Pet profiles", "GPS check-ins", "Walk photo reports"],
    install_count: 1320,
  }),
  mod({
    slug: "art-design-studio",
    name: "Art & Design Studio",
    description:
      "Client briefs, mood boards, revision rounds, asset libraries, and delivery checklists for creatives.",
    category: "Creative",
    rating: 4.7,
    review_count: 118,
    icon: "🎨",
    gradient: "from-fuchsia-500/20 to-violet-500/20",
    features: ["Client briefs", "Mood boards", "Revision tracking", "Asset delivery"],
    install_count: 640,
  }),
  mod({
    slug: "coding-freelance",
    name: "Coding & Dev Desk",
    description:
      "Project scopes, sprint boards, bug trackers, estimate templates, and client handoff packs for freelancers.",
    category: "Tech",
    rating: 4.8,
    review_count: 203,
    icon: "💻",
    gradient: "from-sky-500/20 to-indigo-500/20",
    features: ["Sprint boards", "Bug tracker", "Scope templates", "Handoff packs"],
    install_count: 980,
    route: "/jobs",
  }),
  mod({
    slug: "home-decorating",
    name: "Home Decorating Suite",
    description:
      "Room plans, style quizzes, material lists, before/after galleries, and shopping lists for decorators.",
    category: "Home & Lifestyle",
    rating: 4.6,
    review_count: 97,
    icon: "🛋️",
    gradient: "from-teal-500/20 to-emerald-500/20",
    features: ["Room plans", "Style boards", "Material lists", "Before/after gallery"],
    install_count: 520,
  }),
  mod({
    slug: "party-planner",
    name: "Party Planner",
    description:
      "Guest lists, themes, vendor contacts, timeline builders, and day-of run-of-show for parties of any size.",
    category: "Events",
    rating: 4.8,
    review_count: 174,
    icon: "🎉",
    gradient: "from-pink-500/20 to-rose-500/20",
    features: ["Guest lists", "Theme kits", "Vendor tracker", "Day-of timeline"],
    install_count: 760,
  }),
  mod({
    slug: "event-planner",
    name: "Event Planner Pro",
    description:
      "Full event production: venues, seating charts, budgets, sponsor packets, and multi-day schedules.",
    category: "Events",
    rating: 4.9,
    review_count: 288,
    icon: "📅",
    gradient: "from-violet-500/20 to-blue-500/20",
    features: ["Venue management", "Seating charts", "Budget builder", "Sponsor packets"],
    install_count: 1100,
    route: "/schedule",
  }),
  mod({
    slug: "private-investigator",
    name: "Private Investigator Kit",
    description:
      "Case files, surveillance logs, evidence chain-of-custody notes, and secure client reporting for PIs.",
    category: "Legal & Security",
    rating: 4.7,
    review_count: 86,
    icon: "🕵️",
    gradient: "from-slate-500/20 to-zinc-500/20",
    features: ["Case files", "Surveillance logs", "Evidence notes", "Client reports"],
    install_count: 340,
  }),
  mod({
    slug: "law-advice",
    name: "Law Advice Desk",
    description:
      "Intake forms, matter notes, deadline reminders, document checklists, and referral tracking for legal advisory work. Not a substitute for a licensed attorney.",
    category: "Legal & Security",
    rating: 4.8,
    review_count: 142,
    icon: "⚖️",
    gradient: "from-amber-500/20 to-yellow-500/20",
    features: ["Client intake", "Matter notes", "Deadline reminders", "Doc checklists"],
    install_count: 610,
  }),
  mod({
    slug: "law-mastermind-ai",
    name: "Law Mastermind AI",
    description:
      "Turns Titan AI into a legal strategy mastermind — issue spotting, plain-language explanations, contract red-flag checks, and research outlines. Educational only — not legal advice or attorney representation.",
    category: "AI Agents",
    rating: 4.9,
    review_count: 319,
    icon: "🧠",
    gradient: "from-titan-cyan/20 to-titan-indigo/20",
    features: ["Legal issue spotting", "Contract red flags", "Research outlines", "Plain-language briefs"],
    install_count: 1800,
    route: "/assistant",
  }),
  mod({
    slug: "quickbooks-sync",
    name: "QuickBooks Sync",
    description:
      "Two-way sync of invoices, expenses, customers, and payments between TitanOS and QuickBooks Online.",
    category: "Accounting",
    rating: 4.8,
    review_count: 423,
    icon: "📊",
    gradient: "from-titan-green/20 to-cyan-500/20",
    features: ["Auto invoice sync", "Expense matching", "Customer merge", "Real-time updates"],
    install_count: 5200,
    route: "/finances",
  }),
  mod({
    slug: "inventory-manager",
    name: "Inventory Manager",
    description:
      "Parts and supplies tracking, low-stock alerts, PO generation, and vendor management.",
    category: "Inventory",
    rating: 4.5,
    review_count: 145,
    icon: "📦",
    gradient: "from-titan-indigo/20 to-purple-500/20",
    features: ["Parts tracking", "Low-stock alerts", "Auto PO generation", "Vendor database"],
    install_count: 920,
  }),
  mod({
    slug: "ai-follow-up",
    name: "AI Follow-Up Agent",
    description:
      "Automatically follow up with leads, send review requests, and re-engage inactive customers via SMS and email.",
    category: "AI Agents",
    rating: 4.9,
    review_count: 231,
    icon: "🤖",
    gradient: "from-cyan-500/20 to-blue-500/20",
    features: ["Lead nurturing", "Review requests", "Win-back campaigns", "Custom triggers"],
    install_count: 1650,
    route: "/assistant",
  }),
  mod({
    slug: "profit-report",
    name: "Profit & Loss Pro",
    description:
      "Detailed P&L reports, job costing, technician performance, and exportable financial statements.",
    category: "Reports",
    rating: 4.7,
    review_count: 189,
    icon: "📈",
    gradient: "from-titan-green/20 to-titan-amber/20",
    features: ["Job costing", "Tech performance", "Export to PDF/CSV", "Custom date ranges"],
    install_count: 3100,
    route: "/reports",
  }),
  mod({
    slug: "lawn-landscape",
    name: "Lawn & Landscape Ops",
    description:
      "Recurring mow routes, seasonal packages, chemical logs, and photo proof for lawn care crews.",
    category: "Home & Lifestyle",
    rating: 4.6,
    review_count: 133,
    icon: "🌿",
    gradient: "from-lime-500/20 to-green-500/20",
    features: ["Recurring routes", "Seasonal packages", "Chemical logs", "Photo proof"],
    install_count: 770,
  }),
  mod({
    slug: "handyman-toolkit",
    name: "Handyman Toolkit",
    description:
      "Punch lists, parts runs, before/after photos, and flat-rate job templates for handyman businesses.",
    category: "Home & Lifestyle",
    rating: 4.7,
    review_count: 201,
    icon: "🔧",
    gradient: "from-stone-500/20 to-orange-500/20",
    features: ["Punch lists", "Parts runs", "Photo proof", "Flat-rate templates"],
    install_count: 940,
  }),
  mod({
    slug: "photography-studio",
    name: "Photography Studio",
    description:
      "Shoot schedules, shot lists, gallery delivery, and print packages for photographers.",
    category: "Creative",
    rating: 4.8,
    review_count: 167,
    icon: "📷",
    gradient: "from-neutral-500/20 to-sky-500/20",
    features: ["Shoot schedules", "Shot lists", "Gallery delivery", "Print packages"],
    install_count: 580,
  }),
  mod({
    slug: "tutoring-desk",
    name: "Tutoring Desk",
    description:
      "Student progress notes, session plans, homework trackers, and parent updates for tutors.",
    category: "Pets & Care",
    rating: 4.7,
    review_count: 112,
    icon: "📚",
    gradient: "from-indigo-500/20 to-blue-500/20",
    features: ["Session plans", "Progress notes", "Homework tracker", "Parent updates"],
    install_count: 430,
  }),
  mod({
    slug: "moving-crew",
    name: "Moving Crew Manager",
    description:
      "Inventory sheets, crew assignments, truck loads, and damage checklists for moving companies.",
    category: "Home & Lifestyle",
    rating: 4.5,
    review_count: 79,
    icon: "🚚",
    gradient: "from-yellow-500/20 to-orange-500/20",
    features: ["Inventory sheets", "Crew assignments", "Truck loads", "Damage checklists"],
    install_count: 390,
  }),
  mod({
    slug: "security-patrol",
    name: "Security Patrol Logs",
    description:
      "Guard tours, incident reports, site maps, and client digests for private security teams.",
    category: "Legal & Security",
    rating: 4.6,
    review_count: 64,
    icon: "🛡️",
    gradient: "from-red-500/20 to-slate-500/20",
    features: ["Guard tours", "Incident reports", "Site maps", "Client digests"],
    install_count: 280,
  }),
];

export const LAW_MASTERMIND_SLUG = "law-mastermind-ai";

export function formatInstallCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(count);
}

export function formatModulePrice(module) {
  const price = Number(module?.price);
  if (!Number.isFinite(price) || price <= 0) {
    return module?.price_label || MODULE_PRICE_LABEL || "Free";
  }
  const cents = Math.round(price * 100) / 100;
  const label = module?.price_label || "";
  return `$${cents.toFixed(2)}${label}`;
}

export function normalizeModule(record) {
  if (!record) return null;
  const catalog = MARKETPLACE_MODULES.find((m) => m.slug === (record.slug || record.id));
  const price = Number(record.price);
  return {
    id: record.id || record.slug,
    slug: record.slug || record.id,
    name: record.name || catalog?.name,
    description: record.description || catalog?.description,
    category: record.category || catalog?.category,
    rating: record.rating ?? catalog?.rating ?? 0,
    review_count: record.review_count ?? record.reviews ?? catalog?.review_count ?? 0,
    price: Number.isFinite(price) && price >= 0 ? price : MODULE_PRICE,
    price_label: record.price_label ?? record.priceLabel ?? MODULE_PRICE_LABEL,
    icon: record.icon ?? catalog?.icon ?? "📦",
    gradient: record.gradient ?? catalog?.gradient ?? "from-titan-indigo/20 to-purple-500/20",
    features: record.features ?? catalog?.features ?? [],
    install_count: record.install_count ?? catalog?.install_count ?? 0,
    verified: record.verified ?? catalog?.verified ?? false,
    status: record.status ?? catalog?.status ?? "available",
    route: record.route ?? catalog?.route ?? null,
  };
}

/** Prefer static catalog so new modules ship without waiting on DB seed. */
export function getCatalogModules() {
  return MARKETPLACE_MODULES.map(normalizeModule);
}
