import React, { useEffect, useState } from "react";
import { Copy, Star } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import { listReviewsForUser } from "@/lib/jobReviewsApi";
export default function Reputation() {
  const { user } = useAuth(); const [reviews, setReviews] = useState([]); const [reply, setReply] = useState("Thank you for your review! We appreciate the opportunity to serve you.");
  useEffect(() => { if (user?.id) listReviewsForUser(user.id).then(setReviews); }, [user?.id]);
  return <div className="p-4 md:p-8 max-w-5xl mx-auto"><PageHeader title="Reputation" subtitle="Review feedback and customer replies" /><div className="grid lg:grid-cols-2 gap-5"><section className="space-y-3">{reviews.map((row) => <article key={row.id} className="glass rounded-2xl p-4"><div className="flex text-titan-amber">{Array.from({ length: Number(row.rating) }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div><p className="text-white mt-2">{row.body}</p></article>)}{!reviews.length && <p className="glass rounded-2xl p-6 text-white/40">No reviews received yet.</p>}</section><section className="glass rounded-2xl p-5 h-fit"><h2 className="font-semibold text-white">AI reply draft</h2><p className="text-xs text-white/40 my-2">Personalize this before posting.</p><Textarea value={reply} onChange={(e) => setReply(e.target.value)} className="bg-white/5 border-white/10 text-white min-h-36" /><Button onClick={() => navigator.clipboard?.writeText(reply)} className="mt-3 bg-titan-cyan text-black"><Copy className="w-4 h-4" />Copy reply</Button></section></div></div>;
}
