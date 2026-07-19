import React, { useEffect, useRef, useState } from "react";
import { Heart, ImagePlus, Loader2, MessageCircle, Send, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { useAuth } from "@/lib/AuthContext";
import { SERVICE_CATEGORIES, locationLabel, timeAgo } from "@/lib/platformConstants";
import { addComment, createCommunityPost, getCommunityPostQuota, listActivity, listActivitySince, listComments, listCommunityPosts, toggleLike } from "@/lib/communityApi";
import { COMMUNITY_POST_LIMIT } from "@/lib/contentModeration";
import { betaBadgeLabel } from "@/lib/plan";

const fieldClass = "bg-titan-surface2 border-border text-foreground rounded-xl focus:border-titan-cyan/40";
const EXAMPLE_ACTIVITY = [
  "A local pro completed an HVAC job.",
  "A plumbing professional shared a project update.",
  "A new community post was shared nearby.",
];

function activityLine(item) {
  if (item.summary && String(item.id).startsWith("example-")) return item.summary;
  const category = item.category || "service";
  const place = locationLabel(item.city, item.state);
  if (item.event_type === "job_completed") return `A local professional completed a ${category} job${place ? ` in ${place}` : ""}.`;
  return `A local professional shared a ${category} update${place ? ` in ${place}` : ""}.`;
}

export default function Community() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [posts, setPosts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [liked, setLiked] = useState(new Set());
  const [comments, setComments] = useState({});
  const [openComments, setOpenComments] = useState(new Set());
  const [drafts, setDrafts] = useState({});
  const [compose, setCompose] = useState({ category: "General", description: "", photoUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quota, setQuota] = useState({ used: 0, remaining: COMMUNITY_POST_LIMIT, limit: COMMUNITY_POST_LIMIT });
  const latestActivity = useRef(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [nextPosts, nextActivity, nextQuota] = await Promise.all([
        listCommunityPosts(),
        listActivity(),
        getCommunityPostQuota(user.id),
      ]);
      setPosts(nextPosts); setActivity(nextActivity); setQuota(nextQuota);
      latestActivity.current = nextActivity[0]?.created_at || nextActivity[0]?.created_date || new Date().toISOString();
    } catch { toast({ variant: "destructive", title: "Couldn't load community" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (authChecked && user?.id) load(); }, [authChecked, user?.id]);
  useEffect(() => {
    if (!user?.id) return undefined;
    const poll = setInterval(async () => {
      try {
        const newer = await listActivitySince(latestActivity.current);
        if (!newer.length) return;
        setActivity((current) => [...newer, ...current.filter((item) => !newer.some((next) => next.id === item.id))].slice(0, 30));
        latestActivity.current = newer[0]?.created_at || newer[0]?.created_date || latestActivity.current;
      } catch { /* keep current activity visible */ }
    }, 20000);
    return () => clearInterval(poll);
  }, [user?.id]);

  const submitPost = async (event) => {
    event.preventDefault();
    if (saving || !compose.description.trim()) return;
    if (quota.remaining <= 0) {
      toast({
        variant: "destructive",
        title: "Post limit reached",
        description: `You can share ${COMMUNITY_POST_LIMIT} posts every 12 hours.`,
      });
      return;
    }
    setSaving(true);
    try {
      const post = await createCommunityPost(user, { category: compose.category, description: compose.description, photos: compose.photoUrl ? [compose.photoUrl] : [] });
      setPosts((current) => [post, ...current]);
      setCompose({ category: "General", description: "", photoUrl: "" });
      setQuota((current) => ({
        ...current,
        used: current.used + 1,
        remaining: Math.max(0, current.remaining - 1),
      }));
      toast({ title: "Post shared", description: "Your update is visible to the community." });
    } catch (error) { toast({ variant: "destructive", title: "Couldn't share post", description: error.message || "Please try again." }); }
    finally { setSaving(false); }
  };
  const like = async (post) => {
    try {
      const active = await toggleLike(user.id, post.id);
      setLiked((current) => { const next = new Set(current); active ? next.add(post.id) : next.delete(post.id); return next; });
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, like_count: Math.max(0, (item.like_count || 0) + (active ? 1 : -1)) } : item));
    } catch { toast({ variant: "destructive", title: "Couldn't update like" }); }
  };
  const toggleComments = async (postId) => {
    const opening = !openComments.has(postId);
    setOpenComments((current) => { const next = new Set(current); opening ? next.add(postId) : next.delete(postId); return next; });
    if (opening && !comments[postId]) {
      try {
        const nextComments = await listComments(postId);
        setComments((current) => ({ ...current, [postId]: nextComments }));
      }
      catch { toast({ variant: "destructive", title: "Couldn't load comments" }); }
    }
  };
  const submitComment = async (event, post) => {
    event.preventDefault();
    const body = drafts[post.id]?.trim();
    if (saving || !body) return;
    setSaving(true);
    try {
      const comment = await addComment(user, post.id, body);
      setComments((current) => ({ ...current, [post.id]: [...(current[post.id] || []), comment] }));
      setDrafts((current) => ({ ...current, [post.id]: "" }));
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, comment_count: (item.comment_count || 0) + 1 } : item));
    } catch (error) { toast({ variant: "destructive", title: "Couldn't add comment", description: error.message || "Please try again." }); }
    finally { setSaving(false); }
  };
  const sharePost = async (post) => {
    const url = `${window.location.origin}/community#post-${post.id}`;
    const text = `Community update from @${post.author_username || "localpro"} · ${post.category || "General"}${post.city ? ` · ${post.city}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: "TitanOS Community", text, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied" });
      }
    } catch (error) {
      if (error?.name !== "AbortError") toast({ variant: "destructive", title: "Couldn't share post" });
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading community" />;
  const canCompose = user?.community_opt_in || user?.privacy_prefs?.share_completed_jobs;
  const activityItems = activity.length ? activity : EXAMPLE_ACTIVITY.map((summary, index) => ({ id: `example-${index}`, summary, created_at: null }));
  return <div className="relative p-4 md:p-8 max-w-6xl mx-auto pb-32">
    <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-titan-indigo/10 blur-[100px]" /></div>
    <div className="relative"><PageHeader title="Community" subtitle="Share professional wins with your local service network" />
      {betaBadgeLabel() && <div className="glass rounded-2xl mb-5 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">{betaBadgeLabel()}</div>}
      <div className="glass rounded-2xl p-4 border border-titan-cyan/15 flex gap-3 mb-6"><ShieldCheck className="w-5 h-5 text-titan-cyan shrink-0 mt-0.5" /><div className="text-sm text-muted-foreground space-y-1"><p>Privacy first: posts never show customer names, companies, addresses, or dollar amounts.</p><p>Keep it professional — foul language is blocked. Limit: {COMMUNITY_POST_LIMIT} posts per 12 hours.</p></div></div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
        <div className="space-y-5">
          {canCompose ? <form onSubmit={submitPost} className="glass rounded-2xl p-5 border border-border"><div className="flex items-center justify-between gap-2 mb-3"><div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-titan-cyan" /><p className="font-semibold text-foreground">Share an update</p></div><p className="text-xs text-muted-foreground">{quota.remaining}/{COMMUNITY_POST_LIMIT} left (12h)</p></div><Textarea required maxLength={500} rows={3} value={compose.description} onChange={(e) => setCompose((current) => ({ ...current, description: e.target.value }))} placeholder="Share a project win or useful tip. Keep customer details private." className={fieldClass} /><div className="grid sm:grid-cols-2 gap-3 mt-3"><select value={compose.category} onChange={(e) => setCompose((current) => ({ ...current, category: e.target.value }))} className={fieldClass}>{SERVICE_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select><div className="relative"><ImagePlus className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" /><Input type="url" value={compose.photoUrl} onChange={(e) => setCompose((current) => ({ ...current, photoUrl: e.target.value }))} placeholder="Photo URL (optional)" className={`${fieldClass} pl-9`} /></div></div><Button disabled={saving || quota.remaining <= 0} type="submit" className="mt-3 bg-titan-cyan text-black">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : quota.remaining <= 0 ? "Limit reached (12h)" : <><Send className="w-4 h-4 mr-2" />Share Post</>}</Button></form> : <div className="glass rounded-2xl p-5 border border-border"><p className="font-semibold text-foreground">Join the conversation</p><p className="text-sm text-foreground/45 mt-1">Enable Community sharing in your privacy settings to share updates.</p><Link to="/settings" className="inline-block mt-3 text-sm font-medium text-titan-cyan hover:text-foreground">Open Privacy Settings</Link></div>}
          {loading ? <PageLoader variant="list" label="Loading posts" /> : posts.length ? posts.map((post) => <article id={`post-${post.id}`} key={post.id} className="glass rounded-2xl overflow-hidden border border-border"><div className="p-5"><div className="flex justify-between gap-3"><div><p className="font-semibold text-foreground">@{post.author_username || "localpro"}</p><p className="text-xs text-muted-foreground mt-1">{locationLabel(post.city, post.state) || "Local community"} · {post.category}</p></div><span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(post.created_date || post.created_at)}</span></div><p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line mt-4">{post.description}</p></div>{post.photos?.length ? <div className="grid grid-cols-2 gap-px bg-muted">{post.photos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt="" className="w-full h-48 object-cover" />)}</div> : null}<div className="p-3 flex gap-2 border-t border-border"><button onClick={() => like(post)} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors ${liked.has(post.id) ? "bg-red-400/10 text-red-400" : "text-foreground/45 hover:bg-muted hover:text-foreground"}`}><Heart className={`w-4 h-4 ${liked.has(post.id) ? "fill-current" : ""}`} />{post.like_count || 0}</button><button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-foreground/45 hover:bg-muted hover:text-foreground"><MessageCircle className="w-4 h-4" />{post.comment_count || 0} Comments</button><button onClick={() => sharePost(post)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-foreground/45 hover:bg-muted hover:text-foreground"><Share2 className="w-4 h-4" />Share</button></div>{openComments.has(post.id) && <div className="p-4 border-t border-border bg-black/10 space-y-3">{comments[post.id]?.map((comment) => <p key={comment.id} className="text-sm text-muted-foreground"><span className="font-medium text-foreground">@{comment.author_username}</span> {comment.body}</p>)}<form onSubmit={(event) => submitComment(event, post)} className="flex gap-2"><Input value={drafts[post.id] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Add a comment…" className={fieldClass} /><Button disabled={saving} type="submit" size="icon" className="bg-titan-cyan text-black shrink-0"><Send className="w-4 h-4" /></Button></form></div>}</article>) : <div className="glass rounded-3xl p-12 text-center border border-border"><Sparkles className="w-9 h-9 text-titan-cyan mx-auto mb-3" /><p className="font-semibold text-foreground">The feed is just getting started</p><p className="text-sm text-muted-foreground mt-1">Share a privacy-safe update to start the conversation.</p></div>}
        </div>
        <aside className="glass rounded-2xl p-5 border border-border h-fit lg:sticky lg:top-20"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><h2 className="font-semibold text-foreground">Live Activity</h2></div><p className="text-xs text-muted-foreground mt-1">Updates refresh every 20 seconds.</p><div className="mt-4 space-y-4">{activityItems.map((item) => <div key={item.id} className="border-l border-titan-cyan/30 pl-3"><p className="text-sm text-muted-foreground">{activityLine(item)}</p>{item.created_at && <p className="text-xs text-muted-foreground mt-1">{timeAgo(item.created_at || item.created_date)}</p>}</div>)}</div></aside>
      </div>
    </div>
  </div>;
}
