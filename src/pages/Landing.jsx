import React from "react";
import { Link } from "react-router";
import { ArrowRight, BriefcaseBusiness, FileText, Search, BookmarkCheck, Sparkles, ShieldCheck } from "lucide-react";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";

const FEATURES = [
  { icon: Search, title: "Search jobs", description: "Explore real opportunities with clear employer and source information." },
  { icon: FileText, title: "Build your résumé", description: "Organize experience, skills and education in a professional format." },
  { icon: Sparkles, title: "Find better matches", description: "Compare your qualifications with requirements before you apply." },
  { icon: BookmarkCheck, title: "Track applications", description: "Save roles and keep your job applications in one place." },
];

export default function Landing() {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" aria-label="TitanOS Home" className="flex items-center min-w-0"><TitanBrandLogo /></Link>
        <nav aria-label="Account navigation" className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="text-sm font-semibold px-3 py-2">Sign in</Link>
          <Link to="/register" className="min-h-11 inline-flex items-center bg-primary text-primary-foreground text-sm font-semibold rounded-lg px-4">Get started</Link>
        </nav>
      </div>
    </header>
    <main>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid lg:grid-cols-[1.2fr_.8fr] gap-10 items-center">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-primary">TitanOS • Jobs & Careers</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mt-4">Your next job starts with a stronger résumé.</h1>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-muted-foreground max-w-xl">Find opportunities, match your skills with employers, build a professional résumé and track every step of your job search in one place. No ad-watching, sponsored task rewards or distractions.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/register" className="min-h-12 rounded-lg bg-primary text-primary-foreground px-5 inline-flex items-center gap-2 font-semibold">Create free account <ArrowRight className="w-4 h-4"/></Link>
            <Link to="/login" className="min-h-12 rounded-lg border border-border bg-card px-5 inline-flex items-center font-semibold">I have an account</Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4 inline-flex gap-2 items-center"><ShieldCheck className="h-4 w-4"/> You're in control: applications are not automatically sent to employers.</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-4"><BriefcaseBusiness className="h-5 w-5 text-primary"/><h2 className="font-bold">Your career dashboard</h2></div>
          <div className="space-y-3 pt-5">
            <div className="rounded-xl bg-muted/70 p-4 flex items-center gap-3"><Search className="h-5 w-5 text-primary"/><div><strong className="text-sm block">Find your next role</strong><span className="text-xs text-muted-foreground">Search jobs by location and interest</span></div></div>
            <div className="rounded-xl bg-muted/70 p-4 flex items-center gap-3"><FileText className="h-5 w-5 text-primary"/><div><strong className="text-sm block">Résumé builder</strong><span className="text-xs text-muted-foreground">Structured editor with live preview</span></div></div>
            <div className="rounded-xl bg-muted/70 p-4 flex items-center gap-3"><Sparkles className="h-5 w-5 text-primary"/><div><strong className="text-sm block">Smarter matching</strong><span className="text-xs text-muted-foreground">See qualifications and job fit</span></div></div>
            <div className="rounded-xl bg-muted/70 p-4 flex items-center gap-3"><BookmarkCheck className="h-5 w-5 text-primary"/><div><strong className="text-sm block">Application tracking</strong><span className="text-xs text-muted-foreground">Keep saved and applied work organized</span></div></div>
          </div>
        </div>
      </section>
      <section className="border-y border-border bg-muted/30"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-14"><h2 className="text-2xl sm:text-3xl font-bold">A simpler way to find work</h2><p className="text-sm text-muted-foreground mt-2 mb-7 max-w-2xl">Everything revolves around your next opportunity—not advertising campaigns.</p><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{FEATURES.map(({icon:Icon,title,description})=><article key={title} className="rounded-xl border border-border bg-card p-5"><Icon className="h-6 w-6 text-primary" aria-hidden="true"/><h3 className="font-bold mt-4">{title}</h3><p className="text-sm mt-2 leading-relaxed text-muted-foreground">{description}</p></article>)}</div></div></section>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12"><p className="text-sm text-muted-foreground">Availability depends on connected employers and approved job sources. TitanOS does not guarantee employment or submit applications without your approval.</p></section>
    </main>
    <footer className="border-t border-border"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground"><span>© TitanOS — Jobs & Careers</span><div className="flex gap-5"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/login">Sign in</Link></div></div></footer>
  </div>;
}
