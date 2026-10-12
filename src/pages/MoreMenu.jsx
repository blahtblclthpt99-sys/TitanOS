import React from "react";
import { Link } from "react-router";
import { ArrowRight, BookmarkCheck, BriefcaseBusiness, FileText, LifeBuoy, Settings, Sparkles, Trash2, UserRound } from "lucide-react";

const links = [
  {path:"/hire",icon:BriefcaseBusiness,title:"Find Jobs",description:"Browse the jobs employers have posted in TitanOS."},
  {path:"/hire/matches",icon:Sparkles,title:"Matches & Preferences",description:"See matching work and edit the skills and credentials used for matching."},
  {path:"/resume",icon:FileText,title:"Résumé Builder",description:"Edit work history, education, skills, and export your résumé."},
  {path:"/hire?tab=saved",icon:BookmarkCheck,title:"Saved Jobs",description:"Go back to the opportunities you bookmarked."},
  {path:"/hire?tab=applications",icon:BriefcaseBusiness,title:"My Applications",description:"Review your submitted TitanOS applications."},
  {path:"/profile",icon:UserRound,title:"My Account",description:"Manage your TitanOS account and personal details."},
  {path:"/settings",icon:Settings,title:"Settings",description:"Review your app and account settings."},
  {path:"/support",icon:LifeBuoy,title:"Support",description:"Get help with your TitanOS account."},
];
export default function MoreMenu() {
  return <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 space-y-5">
    <header><p className="uppercase tracking-widest font-bold text-xs text-primary">Career workspace</p><h1 className="text-3xl font-bold mt-2">More career tools</h1><p className="text-muted-foreground text-sm mt-2">Everything you need to prepare, find work and stay organized.</p></header>
    <nav aria-label="Career tools" className="grid sm:grid-cols-2 gap-3">
      {links.map((item)=><Link to={item.path} key={item.path} className="rounded-xl border border-border bg-card p-4 flex items-center min-h-24 gap-4 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <div className="rounded-lg bg-primary/10 p-3 text-primary"><item.icon className="w-5 h-5"/></div>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">{item.title}</h2><p className="text-xs leading-relaxed text-muted-foreground mt-1">{item.description}</p></div>
        <ArrowRight className="h-4 w-4 text-primary shrink-0"/>
      </Link>)}
    </nav>
    <div className="border-t border-border pt-5"><Link to="/delete-account" className="min-h-11 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/> Account deletion & privacy</Link></div>
  </div>;
}
