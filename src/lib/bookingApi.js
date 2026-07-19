import { api } from "@/api/apiClient";
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { notifyUser } from "@/lib/notify";
import { brandedBookingUrl } from "@/lib/bookingSubdomain";

const PREFIX = "titanos_booking";

function slugify(text) {
  return String(text || "book")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function getOrCreateBookingPage(user) {
  try {
    const rows = await api.entities.BookingPage.filter({ owner_id: user.id });
    if (rows[0]) return rows[0];
  } catch {
    const local = readLocal(PREFIX, user.id, "page", null);
    if (local) return local;
  }

  const base = slugify(user.username || user.full_name || user.email?.split("@")[0] || "pro");
  const slug = `${base}-${String(user.id).slice(0, 6)}`;
  const payload = {
    owner_id: user.id,
    slug,
    title: `${user.full_name || "My"} Booking Page`,
    bio: user.bio || "Book a service — Free During Beta.",
    services: ["General"],
    service_area: [user.city, user.state].filter(Boolean).join(", "),
    city: user.city || "",
    state: user.state || "",
    phone: user.phone || "",
    email: user.email || "",
    avatar_url: user.avatar_url || "",
    is_published: true,
    accepts_same_day: true,
    verified_badge: Boolean(user.verified_worker),
    created_by_id: user.id,
  };

  try {
    return await api.entities.BookingPage.create(payload);
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    writeLocal(PREFIX, user.id, "page", row);
    return row;
  }
}

export async function updateBookingPage(id, data) {
  try {
    return await api.entities.BookingPage.update(id, data);
  } catch {
    const row = { id, ...data, updated_at: new Date().toISOString() };
    writeLocal(PREFIX, data.owner_id || "global", "page", row);
    return row;
  }
}

export async function getBookingPageBySlug(slug) {
  try {
    const rows = await api.entities.BookingPage.filter({ slug, is_published: true });
    return rows[0] || null;
  } catch {
    // scan local pages is limited; return null
    return null;
  }
}

export async function submitBookingRequest(page, form) {
  const payload = {
    booking_page_id: page.id,
    owner_id: page.owner_id,
    customer_name: form.customer_name.trim(),
    customer_email: form.customer_email?.trim() || "",
    customer_phone: form.customer_phone?.trim() || "",
    service: form.service || page.services?.[0] || "General",
    preferred_date: form.preferred_date || null,
    preferred_time: form.preferred_time || "",
    notes: form.notes?.trim() || "",
    urgency: form.urgency || "normal",
    is_same_day: Boolean(form.is_same_day),
    status: "new",
  };

  try {
    const row = await api.entities.BookingRequest.create(payload);
    await notifyUser(page.owner_id, {
      type: "applications",
      title: form.is_same_day ? "Same-day booking request" : "New booking request",
      body: `${payload.customer_name} requested ${payload.service}`,
      link: "/booking",
    });
    return row;
  } catch {
    const row = { id: uid(), created_at: new Date().toISOString(), ...payload };
    const all = readLocal(PREFIX, page.owner_id, "requests", []);
    all.unshift(row);
    writeLocal(PREFIX, page.owner_id, "requests", all);
    return row;
  }
}

export async function listBookingRequests(ownerId) {
  try {
    return await api.entities.BookingRequest.filter({ owner_id: ownerId });
  } catch {
    return readLocal(PREFIX, ownerId, "requests", []);
  }
}

export async function listAvailability(ownerId) {
  try {
    return await api.entities.AvailabilitySlot.filter({ owner_id: ownerId });
  } catch {
    return readLocal(PREFIX, ownerId, "availability", []);
  }
}

export async function saveAvailability(user, slots) {
  // Replace strategy: delete missing locally; for remote create/update best-effort
  const saved = [];
  for (const slot of slots) {
    const payload = {
      owner_id: user.id,
      weekday: Number(slot.weekday),
      start_time: slot.start_time,
      end_time: slot.end_time,
      is_open: slot.is_open !== false,
      created_by_id: user.id,
    };
    try {
      if (slot.id && !String(slot.id).startsWith("local_")) {
        saved.push(await api.entities.AvailabilitySlot.update(slot.id, payload));
      } else {
        saved.push(await api.entities.AvailabilitySlot.create(payload));
      }
    } catch {
      saved.push({ id: slot.id || uid(), ...payload });
    }
  }
  writeLocal(PREFIX, user.id, "availability", saved);
  return saved;
}

export function bookingPublicUrl(slug) {
  return brandedBookingUrl(slug) || `/book/${slug}`;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
