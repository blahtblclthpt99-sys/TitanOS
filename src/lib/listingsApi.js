import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid, withEntityFallback } from "@/lib/localStore";
import { locationLabel } from "@/lib/platformConstants";
import { assertWithinFreeLimit, getPlanConfig } from "@/lib/plan";

const PREFIX = "titanos_listings";
const PAGE_SIZE = 12;

function normalizeListing(row) {
  if (!row) return row;
  return {
    ...row,
    images: Array.isArray(row.images) ? row.images : [],
    location_label: row.location_label || locationLabel(row.city, row.state),
    price: Number(row.price) || 0,
    rating_avg: Number(row.rating_avg) || 0,
    rating_count: Number(row.rating_count) || 0,
  };
}

export async function listMarketplaceListings({
  search = "",
  category = "All",
  state = "",
  city = "",
  status = "active",
  sellerId = null,
  page = 0,
  pageSize = PAGE_SIZE,
} = {}) {
  const remote = async () => {
    let rows = await api.entities.MarketplaceListing.list("-created_date", 200);
    rows = rows.map(normalizeListing);
    return filterListings(rows, { search, category, state, city, status, sellerId }).slice(
      page * pageSize,
      page * pageSize + pageSize
    );
  };

  const local = () => {
    const rows = readLocal(PREFIX, "global", "all", []).map(normalizeListing);
    return filterListings(rows, { search, category, state, city, status, sellerId }).slice(
      page * pageSize,
      page * pageSize + pageSize
    );
  };

  return withEntityFallback("MarketplaceListing", remote, local);
}

function filterListings(rows, { search, category, state, city, status, sellerId }) {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (sellerId && row.seller_id !== sellerId) return false;
    if (category && category !== "All" && row.category !== category) return false;
    if (state && row.state !== state) return false;
    if (city && !(row.city || "").toLowerCase().includes(city.toLowerCase())) return false;
    if (!q) return true;
    return (
      row.title?.toLowerCase().includes(q) ||
      row.description?.toLowerCase().includes(q) ||
      row.location_label?.toLowerCase().includes(q) ||
      row.seller_name?.toLowerCase().includes(q)
    );
  });
}

export async function getListing(id) {
  try {
    return normalizeListing(await api.entities.MarketplaceListing.get(id));
  } catch {
    return readLocal(PREFIX, "global", "all", []).map(normalizeListing).find((r) => r.id === id) || null;
  }
}

export async function createListing(user, data) {
  try {
    const mine = await api.entities.MarketplaceListing.filter({ seller_id: user.id, status: "active" });
    assertWithinFreeLimit(user, "listings", mine?.length || 0);
  } catch (error) {
    if (error?.message?.includes("Free plan allows")) throw error;
    const localMine = readLocal(PREFIX, "global", "all", []).filter(
      (row) => row.seller_id === user.id && row.status === "active"
    );
    assertWithinFreeLimit(user, "listings", localMine.length);
  }

  const plan = getPlanConfig(user);
  const payload = {
    seller_id: user.id,
    seller_name: user.full_name || user.username || user.email,
    seller_avatar: user.avatar_url || "",
    title: data.title.trim(),
    description: data.description?.trim() || "",
    category: data.category || "General",
    price: Number(data.price) || 0,
    price_type: data.price_type || "fixed",
    city: data.city || user.city || "",
    state: data.state || user.state || "",
    location_label: locationLabel(data.city || user.city, data.state || user.state),
    images: data.images || [],
    contact_phone: data.contact_phone || user.phone || "",
    contact_email: data.contact_email || user.email || "",
    status: data.status || "active",
    is_featured: Boolean(plan.featuredProfile && data.is_featured),
    created_by_id: user.id,
  };

  try {
    return normalizeListing(await api.entities.MarketplaceListing.create(payload));
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload, favorite_count: 0, view_count: 0, rating_avg: 0, rating_count: 0 };
    const all = readLocal(PREFIX, "global", "all", []);
    all.unshift(row);
    writeLocal(PREFIX, "global", "all", all);
    return normalizeListing(row);
  }
}

export async function updateListing(id, data) {
  try {
    return normalizeListing(await api.entities.MarketplaceListing.update(id, data));
  } catch {
    const all = readLocal(PREFIX, "global", "all", []);
    const idx = all.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error("Listing not found");
    all[idx] = { ...all[idx], ...data, updated_at: new Date().toISOString() };
    writeLocal(PREFIX, "global", "all", all);
    return normalizeListing(all[idx]);
  }
}

export async function archiveListing(id) {
  return updateListing(id, { status: "archived" });
}

export async function deleteListing(id) {
  try {
    await api.entities.MarketplaceListing.delete(id);
  } catch {
    const all = readLocal(PREFIX, "global", "all", []).filter((r) => r.id !== id);
    writeLocal(PREFIX, "global", "all", all);
  }
}

export async function toggleFavorite(userId, listingId) {
  try {
    const existing = await api.entities.MarketplaceFavorite.filter({ user_id: userId, listing_id: listingId });
    if (existing.length) {
      await api.entities.MarketplaceFavorite.delete(existing[0].id);
      return false;
    }
    await api.entities.MarketplaceFavorite.create({ user_id: userId, listing_id: listingId, created_by_id: userId });
    return true;
  } catch {
    const favs = readLocal(PREFIX, userId, "favorites", []);
    const idx = favs.indexOf(listingId);
    if (idx >= 0) {
      favs.splice(idx, 1);
      writeLocal(PREFIX, userId, "favorites", favs);
      return false;
    }
    favs.push(listingId);
    writeLocal(PREFIX, userId, "favorites", favs);
    return true;
  }
}

export async function fetchFavoriteIds(userId) {
  if (!userId) return new Set();
  try {
    const rows = await api.entities.MarketplaceFavorite.filter({ user_id: userId });
    return new Set(rows.map((r) => r.listing_id));
  } catch {
    return new Set(readLocal(PREFIX, userId, "favorites", []));
  }
}

export async function reportListing(user, listingId, reason, details = "") {
  const payload = {
    reporter_id: user.id,
    listing_id: listingId,
    reason,
    details,
    status: "open",
    created_by_id: user.id,
  };
  try {
    return await api.entities.MarketplaceReport.create(payload);
  } catch {
    const rows = readLocal(PREFIX, user.id, "reports", []);
    rows.push({ id: uid(), created_at: new Date().toISOString(), ...payload });
    writeLocal(PREFIX, user.id, "reports", rows);
    return rows[rows.length - 1];
  }
}

export async function sendListingMessage(user, { listingId, recipientId, body, threadId }) {
  const { sendMessage } = await import("@/lib/messagesApi");
  return sendMessage(user, {
    threadId: threadId || `${listingId || "general"}_${[user.id, recipientId].sort().join("_")}`,
    recipientId,
    body,
    type: "text",
    listingId: listingId || null,
  });
}

export async function listListingMessages(userId, listingId) {
  try {
    const rows = await api.entities.MarketplaceMessage.filter({ listing_id: listingId });
    return rows.filter((m) => m.sender_id === userId || m.recipient_id === userId);
  } catch {
    const { listConversations, listMessages } = await import("@/lib/messagesApi");
    const threads = await listConversations(userId);
    const match = threads.find((t) => t.listing_id === listingId);
    if (match) return listMessages(userId, match.id);
    return readLocal(PREFIX, userId, "messages", []).filter((m) => m.listing_id === listingId);
  }
}

export async function listSellerReviews(sellerId) {
  try {
    return await api.entities.MarketplaceReview.filter({ seller_id: sellerId });
  } catch {
    return readLocal(PREFIX, "global", "reviews", []).filter((r) => r.seller_id === sellerId);
  }
}

export async function createSellerReview(user, { listingId, sellerId, rating, body }) {
  const payload = {
    listing_id: listingId,
    seller_id: sellerId,
    reviewer_id: user.id,
    reviewer_name: user.full_name || user.username || "User",
    rating: Number(rating),
    body: body?.trim() || "",
    status: "published",
    created_by_id: user.id,
  };
  try {
    return await api.entities.MarketplaceReview.create(payload);
  } catch {
    const rows = readLocal(PREFIX, "global", "reviews", []);
    rows.unshift({ id: uid(), created_at: new Date().toISOString(), ...payload });
    writeLocal(PREFIX, "global", "reviews", rows);
    return rows[0];
  }
}

export { PAGE_SIZE };
