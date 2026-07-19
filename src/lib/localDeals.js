/** Static local partner deals — affiliate-ready placeholders. */
export const LOCAL_DEALS = [
  {
    id: "fuel-fleet",
    category: "Fuel",
    title: "Fleet fuel discount",
    offer: "Save up to 8¢/gal",
    partner: "Regional fuel network",
    blurb: "Link your business card for commercial pump discounts on diesel and gas.",
    url: "https://www.google.com/search?q=commercial+fleet+fuel+card",
  },
  {
    id: "tools-pro",
    category: "Tools",
    title: "Pro tool house account",
    offer: "10% off hand tools",
    partner: "Local tool supplier",
    blurb: "Open a trade account for contractor pricing on blades, bits, and fasteners.",
    url: "https://www.google.com/search?q=contractor+tool+supply+near+me",
  },
  {
    id: "insure-liability",
    category: "Insurance",
    title: "Liability insurance quotes",
    offer: "Compare in minutes",
    partner: "Independent agents",
    blurb: "Shop general liability and tools coverage tailored to field service trades.",
    url: "https://www.google.com/search?q=contractor+liability+insurance+quotes",
  },
  {
    id: "uniform-workwear",
    category: "Apparel",
    title: "Workwear bulk packs",
    offer: "Free logo setup over $250",
    partner: "Uniform printers",
    blurb: "Branded polos and high-vis gear that make your crew look professional on every job.",
    url: "https://www.google.com/search?q=custom+work+uniforms+contractor",
  },
  {
    id: "software-accounting",
    category: "Software",
    title: "Accounting add-ons",
    offer: "Trial + Titan tips",
    partner: "Bookkeeping tools",
    blurb: "Pair TitanOS expenses with QuickBooks-style workflows for cleaner books.",
    url: "/marketplace",
  },
  {
    id: "storage-trailer",
    category: "Equipment",
    title: "Trailer & storage rental",
    offer: "Weekend rates",
    partner: "Equipment rental yards",
    blurb: "Need overflow capacity? Rent enclosed trailers and storage containers near you.",
    url: "https://www.google.com/search?q=trailer+rental+near+me",
  },
];

export function dealsByCategory(category = "All") {
  if (!category || category === "All") return LOCAL_DEALS;
  return LOCAL_DEALS.filter((d) => d.category === category);
}

export const DEAL_CATEGORIES = ["All", ...new Set(LOCAL_DEALS.map((d) => d.category))];
