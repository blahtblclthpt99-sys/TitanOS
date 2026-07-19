import React from "react";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { SERVICE_TEMPLATES, templateToEstimatorForm } from "@/lib/serviceTemplates";
import { toast } from "@/components/ui/use-toast";

export default function ServiceTemplates() {
  const navigate = useNavigate();

  const useTemplate = (template) => {
    const form = templateToEstimatorForm(template);
    sessionStorage.setItem(
      "titanos_estimator_draft",
      JSON.stringify({
        inputs: form,
        estimate: null,
        template_id: template.id,
        created_at: new Date().toISOString(),
      })
    );
    toast({ title: `${template.name} loaded`, description: "Opening Job Estimator with defaults." });
    navigate("/job-estimator");
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Service Templates"
        subtitle="Install trade packs with default estimates, checklists, invoice items, and customer forms — faster quoting, fewer missed steps."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICE_TEMPLATES.map((t) => (
          <article key={t.id} className="glass rounded-2xl p-5 border border-border flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl" aria-hidden>{t.icon}</span>
              <div>
                <h2 className="font-semibold text-foreground">{t.name}</h2>
                <p className="text-xs text-muted-foreground">{t.default_hours}h · ${t.labor_rate}/hr baseline</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{t.checklist.length} checklist steps · {t.estimate_items.length} estimate lines</p>
            <ul className="text-xs text-foreground/80 space-y-1 mb-4 flex-1">
              {t.customer_form.slice(0, 3).map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
            <Button onClick={() => useTemplate(t)} className="w-full bg-titan-cyan text-black">
              <LayoutTemplate className="w-4 h-4 mr-2" /> Use template
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
