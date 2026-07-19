import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Loader2, MapPin, MessageCircle, Pencil, Search, Send, ShieldAlert, Star, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import FormField from "@/components/shared/FormField";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { useAuth } from "@/lib/AuthContext";
import MarketplaceApps from "@/pages/MarketplaceApps";
import { SERVICE_CATEGORIES, US_STATES, timeAgo } from "@/lib/platformConstants";
import { betaBadgeLabel, isMarketplaceFree, MARKETPLACE_PREMIUM } from "@/lib/plan";
import { archiveListing, createListing, createSellerReview, deleteListing, fetchFavoriteIds, getListing, listListingMessages, listMarketplaceListings, listSellerReviews, PAGE_SIZE, reportListing, sendListingMessage, toggleFavorite, updateListing } from "@/lib/listingsApi";

const blankListing = { title: "", description: "", category: "General", price: "", price_type: "fixed", city: "", state: "", contact_phone: "", contact_email: "", images: [] };
const fieldClass = "bg-titan-surface2 border-white/10 text-white rounded-xl focus:border-titan-cyan/40";

function Stars({ rating = 0, small = false }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`${small ? "w-3 h-3" : "w-4 h-4"} ${index < Math.round(rating) ? "fill-titan-amber text-titan-amber" : "text-white/15"}`} />)}</div>;
}

function priceLabel(listing) {
  if (!listing.price) return listing.price_type === "hourly" ? "Rate on request" : "Free estimate";
  return `$${Number(listing.price).toLocaleString()}${listing.price_type === "hourly" ? "/hr" : listing.price_type === "starting_at" ? "+" : ""}`;
}

function ListingCard({ listing, favorite, onFavorite, onOpen, index }) {
  return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} whileHover={{ y: -3 }} className="glass overflow-hidden rounded-2xl border border-white/8 hover:border-titan-cyan/25 transition-colors">
    {listing.images?.[0] ? <img src={listing.images[0]} alt="" className="h-36 w-full object-cover" /> : <div className="h-20 bg-gradient-to-r from-titan-cyan/15 via-titan-indigo/15 to-transparent" />}
    <div className="p-5">
      <div className="flex justify-between gap-3"><button onClick={() => onOpen(listing)} className="text-left min-w-0"><h2 className="font-semibold text-white truncate hover:text-titan-cyan">{listing.title}</h2><p className="text-xs text-white/40 mt-1">{listing.category}</p></button><button aria-label="Favorite listing" onClick={() => onFavorite(listing)} className={`shrink-0 p-2 rounded-xl ${favorite ? "text-red-400 bg-red-400/10" : "text-white/35 hover:text-red-400"}`}><Heart className={`w-4 h-4 ${favorite ? "fill-current" : ""}`} /></button></div>
      <p className="text-sm text-white/55 leading-relaxed mt-3 line-clamp-2">{listing.description}</p>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/6"><div><p className="font-bold text-titan-cyan">{priceLabel(listing)}</p><p className="text-xs text-white/35 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{listing.location_label || "Location not provided"}</p></div><div className="text-right"><p className="text-xs text-white/65">{listing.seller_name || "Service provider"}</p><div className="flex justify-end items-center gap-1 mt-1"><Stars rating={listing.rating_avg} small /><span className="text-[10px] text-white/35">({listing.rating_count || 0})</span></div></div></div>
    </div>
  </motion.article>;
}

export default function Marketplace() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [tab, setTab] = useState("listings");
  const [filters, setFilters] = useState({ search: "", category: "All", state: "", city: "" });
  const [listings, setListings] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [listingForm, setListingForm] = useState(blankListing);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState({ rating: 5, body: "" });
  const [detailData, setDetailData] = useState({ reviews: [], messages: [] });

  const myListings = tab === "mine";
  const loadListings = async (nextPage = 0, append = false) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await listMarketplaceListings({ ...filters, sellerId: myListings ? user.id : null, status: myListings ? "" : "active", page: nextPage });
      setListings(previous => append ? [...previous, ...rows] : rows);
      setPage(nextPage); setHasMore(rows.length === PAGE_SIZE);
    } catch { toast({ variant: "destructive", title: "Couldn't load listings", description: "Please try again." }); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (authChecked && user?.id && tab !== "apps") loadListings(); }, [authChecked, user?.id, tab, filters, myListings]);
  useEffect(() => { if (user?.id) fetchFavoriteIds(user.id).then(setFavorites); }, [user?.id]);

  const openDetail = async (listing) => {
    setSelected(listing); setDetailData({ reviews: [], messages: [] });
    try {
      const [full, reviews, messages] = await Promise.all([getListing(listing.id), listSellerReviews(listing.seller_id), listListingMessages(user.id, listing.id)]);
      setSelected(full || listing); setDetailData({ reviews, messages });
    } catch { toast({ variant: "destructive", title: "Couldn't load listing details" }); }
  };
  const reload = () => loadListings();
  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const editListing = (listing) => { setListingForm({ ...blankListing, ...listing, images: listing.images || [] }); setFormOpen(true); };
  const isOwner = selected?.seller_id === user?.id;

  const saveListing = async (event) => {
    event.preventDefault(); if (saving) return;
    setSaving(true);
    try {
      const data = { ...listingForm, images: listingForm.images.filter(Boolean) };
      if (listingForm.id) await updateListing(listingForm.id, data); else await createListing(user, data);
      toast({ title: listingForm.id ? "Listing updated" : "Listing published", description: "Your service listing is ready." });
      setFormOpen(false); setListingForm(blankListing); reload();
    } catch { toast({ variant: "destructive", title: "Couldn't save listing", description: "Check the details and try again." }); }
    finally { setSaving(false); }
  };
  const handleFavorite = async (listing) => {
    try { const active = await toggleFavorite(user.id, listing.id); setFavorites(old => { const next = new Set(old); active ? next.add(listing.id) : next.delete(listing.id); return next; }); }
    catch { toast({ variant: "destructive", title: "Couldn't update favorite" }); }
  };
  const remove = async (listing) => { if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return; try { await deleteListing(listing.id); toast({ title: "Listing deleted" }); setSelected(null); reload(); } catch { toast({ variant: "destructive", title: "Couldn't delete listing" }); } };
  const archive = async (listing) => { try { await archiveListing(listing.id); toast({ title: "Listing archived" }); setSelected(null); reload(); } catch { toast({ variant: "destructive", title: "Couldn't archive listing" }); } };
  const sendMessage = async (event) => { event.preventDefault(); if (saving || !message.trim()) return; setSaving(true); try { await sendListingMessage(user, { listingId: selected.id, recipientId: selected.seller_id, body: message }); setMessage(""); toast({ title: "Message sent" }); } catch { toast({ variant: "destructive", title: "Couldn't send message" }); } finally { setSaving(false); } };
  const submitReview = async (event) => { event.preventDefault(); if (saving) return; setSaving(true); try { await createSellerReview(user, { listingId: selected.id, sellerId: selected.seller_id, ...review }); setReview({ rating: 5, body: "" }); toast({ title: "Review submitted" }); setDetailData(current => ({ ...current, reviews: [...current.reviews, { ...review, reviewer_name: user.full_name }] })); } catch { toast({ variant: "destructive", title: "Couldn't submit review" }); } finally { setSaving(false); } };
  const submitReport = async () => { const reason = window.prompt("What should we review about this listing?"); if (!reason?.trim()) return; try { await reportListing(user, selected.id, reason); toast({ title: "Report received", description: "Thank you for helping keep the marketplace safe." }); } catch { toast({ variant: "destructive", title: "Couldn't submit report" }); } };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading marketplace" />;
  return <div className="relative p-4 md:p-8 max-w-7xl mx-auto min-h-full">
    <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-titan-cyan/8 blur-[100px]" /><div className="absolute top-1/2 -left-24 w-72 h-72 rounded-full bg-titan-indigo/10 blur-[90px]" /></div>
    <div className="relative"><PageHeader title="Marketplace" subtitle="Find trusted local services and share your expertise" onAdd={() => { setListingForm(blankListing); setFormOpen(true); }} addLabel="Post a Service" />
      <div className="flex gap-2 mb-6 border-b border-white/8">{[["listings", "Listings"], ["mine", "My Listings"], ["apps", "Apps"]].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === id ? "border-titan-cyan text-titan-cyan" : "border-transparent text-white/40 hover:text-white/70"}`}>{label}</button>)}</div>
      {tab === "apps" ? <MarketplaceApps /> : <>
        {betaBadgeLabel() && <div className="glass rounded-2xl mb-5 p-4 border border-titan-cyan/20 flex items-center justify-between gap-4"><div><p className="font-semibold text-white">{betaBadgeLabel()}</p><p className="text-xs text-white/40 mt-1">Post and connect with local service providers at no cost.</p></div><span className="text-xs font-medium text-titan-cyan">{isMarketplaceFree(user) ? "No fees" : MARKETPLACE_PREMIUM.enabled ? "Premium available" : ""}</span></div>}
        <div className="glass rounded-2xl p-4 mb-6 border border-white/8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-white/30" /><Input value={filters.search} onChange={e => updateFilter("search", e.target.value)} placeholder="Search services" className={`${fieldClass} pl-9`} /></div><select value={filters.category} onChange={e => updateFilter("category", e.target.value)} className={fieldClass}><option value="All">All categories</option>{SERVICE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select><select value={filters.state} onChange={e => updateFilter("state", e.target.value)} className={fieldClass}><option value="">All states</option>{US_STATES.map(value => <option key={value}>{value}</option>)}</select><Input value={filters.city} onChange={e => updateFilter("city", e.target.value)} placeholder="City" className={fieldClass} /></div>
        {loading ? <PageLoader variant="list" label="Loading listings" /> : listings.length ? <><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} index={index} favorite={favorites.has(listing.id)} onFavorite={handleFavorite} onOpen={openDetail} />)}</div>{hasMore && <div className="text-center mt-8"><Button onClick={() => loadListings(page + 1, true)} disabled={loading} variant="outline" className="border-white/15 text-white hover:bg-white/5 rounded-xl">Load more</Button></div>}</> : <div className="glass rounded-3xl p-12 text-center border border-white/8"><Store className="w-8 h-8 text-titan-cyan mx-auto mb-3" /><p className="font-semibold text-white">{myListings ? "No listings yet" : "No services found"}</p><p className="text-sm text-white/40 mt-1">{myListings ? "Post your first service to start reaching local customers." : "Try broadening your search or filters."}</p>{myListings && <Button onClick={() => setFormOpen(true)} className="mt-4 bg-titan-cyan text-black">Post a Service</Button>}</div>}
      </>}
    </div>
    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="bg-titan-surface1 border-white/10 text-white max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{listingForm.id ? "Edit service listing" : "Post a service listing"}</DialogTitle></DialogHeader><form onSubmit={saveListing} className="space-y-4"><FormField label="Service title" value={listingForm.title} onChange={e => setListingForm(x => ({ ...x, title: e.target.value }))} required /><FormField label="Description"><Textarea value={listingForm.description} onChange={e => setListingForm(x => ({ ...x, description: e.target.value }))} required rows={4} className={fieldClass} /></FormField><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FormField label="Category"><select value={listingForm.category} onChange={e => setListingForm(x => ({ ...x, category: e.target.value }))} className={fieldClass}>{SERVICE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></FormField><FormField label="Price"><Input type="number" min="0" value={listingForm.price} onChange={e => setListingForm(x => ({ ...x, price: e.target.value }))} placeholder="0" className={fieldClass} /></FormField><FormField label="Price type"><select value={listingForm.price_type} onChange={e => setListingForm(x => ({ ...x, price_type: e.target.value }))} className={fieldClass}><option value="fixed">Fixed price</option><option value="hourly">Hourly</option><option value="starting_at">Starting at</option></select></FormField><FormField label="State"><select value={listingForm.state} onChange={e => setListingForm(x => ({ ...x, state: e.target.value }))} className={fieldClass}><option value="">Select state</option>{US_STATES.map(value => <option key={value}>{value}</option>)}</select></FormField><FormField label="City" value={listingForm.city} onChange={e => setListingForm(x => ({ ...x, city: e.target.value }))} /><FormField label="Contact phone" value={listingForm.contact_phone} onChange={e => setListingForm(x => ({ ...x, contact_phone: e.target.value }))} /></div><FormField label="Contact email" type="email" value={listingForm.contact_email} onChange={e => setListingForm(x => ({ ...x, contact_email: e.target.value }))} /><FormField label="Image URL"><Input value={listingForm.images[0] || ""} onChange={e => setListingForm(x => ({ ...x, images: e.target.value ? [e.target.value] : [] }))} placeholder="https://..." className={fieldClass} /></FormField><Button type="submit" disabled={saving} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : listingForm.id ? "Save Changes" : "Publish Listing"}</Button></form></DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="bg-titan-surface1 border-white/10 text-white max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">{selected && <><DialogHeader><DialogTitle className="pr-8">{selected.title}</DialogTitle></DialogHeader>{selected.images?.[0] && <img src={selected.images[0]} alt="" className="w-full max-h-64 object-cover rounded-xl" />}<div className="flex flex-wrap gap-2 text-xs"><span className="bg-titan-cyan/10 text-titan-cyan px-2 py-1 rounded-lg">{selected.category}</span><span className="text-white/40 flex items-center gap-1"><MapPin className="w-3 h-3" />{selected.location_label}</span><span className="text-white/35">{timeAgo(selected.created_date || selected.created_at)}</span></div><p className="text-white/65 whitespace-pre-line">{selected.description}</p><div className="glass rounded-xl p-4 border border-white/8"><div className="flex justify-between"><div><p className="font-medium">{selected.seller_name}</p><div className="flex gap-2 items-center mt-1"><Stars rating={selected.rating_avg} small /><span className="text-xs text-white/35">{selected.rating_count || 0} reviews</span></div></div><p className="font-bold text-titan-cyan">{priceLabel(selected)}</p></div>{!isOwner && <div className="flex flex-wrap gap-2 mt-4">{selected.contact_phone && <a href={`tel:${selected.contact_phone}`} className="text-xs text-titan-cyan">Call {selected.contact_phone}</a>}{selected.contact_email && <a href={`mailto:${selected.contact_email}`} className="text-xs text-titan-cyan">Email seller</a>}</div>}</div>{isOwner ? <div className="flex gap-2"><Button onClick={() => { setSelected(null); editListing(selected); }} variant="outline" className="flex-1 border-white/15"><Pencil className="w-4 h-4 mr-2" />Edit</Button><Button onClick={() => archive(selected)} variant="outline" className="border-titan-amber/30 text-titan-amber">Archive</Button><Button onClick={() => remove(selected)} variant="outline" className="border-red-400/30 text-red-400"><Trash2 className="w-4 h-4" /></Button></div> : <><form onSubmit={sendMessage} className="space-y-2"><p className="text-sm font-medium flex items-center gap-2"><MessageCircle className="w-4 h-4 text-titan-cyan" />Message seller</p><Textarea value={message} onChange={e => setMessage(e.target.value)} required placeholder="Ask about this service..." className={fieldClass} /><Button disabled={saving} type="submit" className="bg-titan-cyan text-black"><Send className="w-4 h-4 mr-2" />Send message</Button></form><form onSubmit={submitReview} className="border-t border-white/8 pt-4 space-y-2"><p className="text-sm font-medium">Leave a review</p><select value={review.rating} onChange={e => setReview(x => ({ ...x, rating: Number(e.target.value) }))} className={fieldClass}>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} stars</option>)}</select><Textarea value={review.body} onChange={e => setReview(x => ({ ...x, body: e.target.value }))} placeholder="Share your experience (optional)" className={fieldClass} /><Button disabled={saving} type="submit" variant="outline" className="border-white/15">Submit review</Button></form><Button onClick={submitReport} variant="ghost" className="text-red-400 hover:text-red-300"><ShieldAlert className="w-4 h-4 mr-2" />Report listing</Button></>} {detailData.reviews.length > 0 && <div className="border-t border-white/8 pt-4"><p className="text-sm font-medium mb-2">Recent reviews</p>{detailData.reviews.slice(0, 3).map(item => <p key={item.id || item.reviewer_name} className="text-xs text-white/45 mb-2"><span className="text-white/70">{item.reviewer_name}</span> · {item.rating}/5 {item.body && `— ${item.body}`}</p>)}</div>}</>}</DialogContent></Dialog>
  </div>;
}
