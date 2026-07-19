import React, { useState } from "react";
import { ExternalLink, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { DEAL_CATEGORIES, dealsByCategory } from "@/lib/localDeals";

export default function LocalDeals() {
  const navigate = useNavigate();
  const [category, setCategory] = useState("All");
  const deals = dealsByCategory(category);

  const open = (deal) => {
    if (deal.url.startsWith("/")) navigate(deal.url);
    else window.open(deal.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
      <PageHeader title="Local Deals" subtitle="Fuel, tools, insurance & partner savings for your crew" />
      <div className="flex gap-2 overflow-x-auto mb-5 pb-1">
        {DEAL_CATEGORIES.map((c) => (
          <Button key={c} type="button" size="sm" variant="outline" onClick={() => setCategory(c)} className={category === c ? "border-titan-cyan text-titan-cyan" : "border-border text-muted-foreground"}>
            {c}
          </Button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {deals.map((deal) => (
          <article key={deal.id} className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 text-xs text-primary font-semibold uppercase tracking-wider mb-2">
              <Tag className="w-3.5 h-3.5" />
              {deal.category}
            </div>
            <h2 className="font-semibold text-foreground">{deal.title}</h2>
            <p className="text-lg font-bold text-primary mt-1">{deal.offer}</p>
            <p className="text-sm text-muted-foreground mt-2 flex-1">{deal.blurb}</p>
            <p className="text-xs text-muted-foreground mt-3 mb-3">{deal.partner}</p>
            <Button onClick={() => open(deal)} variant="outline" className="w-full">
              <ExternalLink className="w-4 h-4" /> View deal
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
