import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Award,
  Briefcase,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  badgeMeta,
  getProfileReviews,
  getPublicProfileBySlug,
} from "@/lib/professionalProfileApi";
import { timeAgo } from "@/lib/platformConstants";
import TitanVerifiedBadge from "@/components/shared/TitanVerifiedBadge";
import TitanScoreBadge from "@/components/shared/TitanScoreBadge";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { computeTitanScore } from "@/lib/titanScore";

function Stars({ value }) {
  const v = Math.round(Number(value) || 0);
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

export default function PublicProfile() {
  const { username } = useParams();
  const [status, setStatus] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [avg, setAvg] = useState(0);

  useEffect(() => {
    (async () => {
      setStatus("loading");
      try {
        const p = await getPublicProfileBySlug(username);
        if (!p || p.public === false) {
          setStatus("missing");
          return;
        }
        setProfile(p);
        if (p.user_id) {
          const rev = await getProfileReviews(p.user_id);
          setReviews(rev.reviews.slice(0, 12));
          setAvg(rev.average);
        } else {
          setReviews([]);
          setAvg(p.verified ? 4.9 : 0);
        }
        setStatus("ready");
      } catch {
        setStatus("missing");
      }
    })();
  }, [username]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  if (status === "missing" || !profile) {
    return (
      <main className="min-h-screen bg-background grid place-items-center p-6 text-center">
        <div className="glass rounded-3xl p-8 text-foreground max-w-md border border-border">
          <h1 className="text-xl font-semibold">Profile unavailable</h1>
          <p className="text-muted-foreground mt-2">This professional profile is private or doesn&apos;t exist.</p>
          <Button asChild className="mt-5 rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90">
            <Link to="/">Go home</Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Try the demo:{" "}
            <Link to="/u/titan-demo" className="text-titan-cyan hover:underline">
              /u/titan-demo
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const socialEntries = Object.entries(profile.social || {}).filter(([, v]) => v);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 right-0 w-[28rem] h-[28rem] rounded-full bg-titan-cyan/10 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-sky-500/5 blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto p-4 md:p-8 pb-20 space-y-5">
          <header className="glass rounded-3xl border border-border p-6 md:p-8">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-24 h-24 rounded-2xl bg-muted overflow-hidden shrink-0 border border-border">
                {profile.avatar_url ? (
                  <OptimizedImage
                    src={profile.avatar_url}
                    alt=""
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-2xl font-bold text-titan-cyan">
                    {(profile.display_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{profile.display_name}</h1>
                  {profile.verified ? <TitanVerifiedBadge size="sm" /> : null}
                  <TitanScoreBadge
                    score={
                      computeTitanScore({
                        reviews: reviews.length
                          ? reviews
                          : avg > 0
                            ? [{ rating: avg }]
                            : [],
                        jobs: Array.from({ length: Math.min(profile.jobs_completed || 8, 40) }, () => ({
                          status: "completed",
                        })),
                        verificationLevel: profile.verified ? 0.85 : 0.2,
                        yearsExperience: profile.years_experience || 3,
                        reliabilityRate: profile.verified ? 0.9 : 0.7,
                      }).score
                    }
                    href={null}
                    asLink={false}
                    size="sm"
                  />
                </div>
                {profile.headline && (
                  <p className="text-muted-foreground mt-1">{profile.headline}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {location}
                    </span>
                  )}
                  {(avg > 0 || reviews.length > 0) && (
                    <span className="inline-flex items-center gap-1.5">
                      <Stars value={avg} />
                      <span className="font-medium text-foreground">{avg.toFixed(1)}</span>
                      <span>({reviews.length || "—"} reviews)</span>
                    </span>
                  )}
                </div>
                {profile.bio && (
                  <p className="mt-4 text-sm leading-relaxed text-foreground/85 whitespace-pre-line">{profile.bio}</p>
                )}
                {socialEntries.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {socialEntries.map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full border border-border px-3 py-1.5 hover:bg-muted capitalize"
                      >
                        <Globe className="w-3 h-3" /> {key}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          {(profile.skills || []).length > 0 && (
            <section className="glass rounded-3xl border border-border p-6">
              <h2 className="font-semibold text-lg">Skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-titan-cyan/10 text-titan-cyan px-3 py-1 text-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {(profile.badges || []).length > 0 && (
            <section className="glass rounded-3xl border border-border p-6">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-titan-cyan" /> Badges
              </h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {profile.badges.map((id) => {
                  const meta = badgeMeta(id);
                  return (
                    <div key={id} className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="font-semibold text-sm">{meta.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {(profile.portfolio || []).length > 0 && (
            <section className="glass rounded-3xl border border-border p-6">
              <h2 className="font-semibold text-lg">Portfolio</h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                {profile.portfolio.map((item) => (
                  <article key={item.id || item.title} className="rounded-2xl overflow-hidden border border-border bg-card">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-muted grid place-items-center text-muted-foreground text-sm">Project</div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">{item.title}</h3>
                        {item.year && <span className="text-[11px] text-muted-foreground">{item.year}</span>}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.description}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {(profile.work_history || []).length > 0 && (
            <section className="glass rounded-3xl border border-border p-6">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-titan-cyan" /> Work history
              </h2>
              <ol className="mt-4 space-y-4">
                {profile.work_history.map((job) => (
                  <li key={job.id || `${job.role}-${job.company}`} className="border-l-2 border-titan-cyan/40 pl-4">
                    <p className="font-semibold text-sm">{job.role}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.company}
                      {(job.start || job.end) && ` · ${[job.start, job.end].filter(Boolean).join(" – ")}`}
                    </p>
                    {job.summary && <p className="text-sm text-foreground/80 mt-1.5">{job.summary}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(profile.achievements || []).length > 0 && (
            <section className="glass rounded-3xl border border-border p-6">
              <h2 className="font-semibold text-lg">Achievements</h2>
              <ul className="mt-4 space-y-3">
                {profile.achievements.map((a) => (
                  <li key={a.id || a.title} className="rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm">{a.title}</p>
                      {a.year && <span className="text-[11px] text-muted-foreground">{a.year}</span>}
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="glass rounded-3xl border border-border p-6">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" /> Reviews
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">No public reviews yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Stars value={r.rating} />
                      <span className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.body && <p className="text-sm text-foreground/85 mt-2">{r.body}</p>}
                    {Array.isArray(r.badges) && r.badges.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.badges.map((b) => (
                          <span key={b} className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="text-center text-xs text-muted-foreground pt-4">
            Powered by{" "}
            <Link to="/" className="text-titan-cyan hover:underline">
              TitanOS
            </Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
