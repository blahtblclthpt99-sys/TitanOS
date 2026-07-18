import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Download as DownloadIcon, ArrowRight, Smartphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DOWNLOAD_PACKAGES,
  TITANOS_PLAY_TESTING_URL,
  openPlayTestingOptIn,
} from "@/lib/app-download";

const STEPS = [
  "Join testing with the Google account invited in Play Console (opt-in link below)",
  "Open TitanOS on Google Play and tap Install",
  "Launch the app and create your free account (email or Google)",
  "If Play says the app isn’t available, you haven’t opted in yet — use the tester link",
];

export default function Download() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-svh bg-[#0A0A0B] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="text-titan-cyan" aria-hidden>
              ⚡
            </span>
            <span>
              Titan<span className="gradient-text">OS</span>
            </span>
          </Link>
          <Link to="/" className="text-xs text-white/40 hover:text-white">
            ← Back
          </Link>
        </div>

        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-titan-cyan/20 bg-titan-cyan/10 px-3.5 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-titan-cyan">
              Download — Free
            </span>
          </div>
          <h1 className="mb-3 text-3xl font-black">Get TitanOS</h1>
          <p className="text-sm leading-relaxed text-white/40">
            Closed testers must install from Google Play with the invited Google account — not a random APK.
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-titan-cyan/25 bg-titan-cyan/5 p-5">
          <p className="text-sm font-semibold text-white">Play testers — do this first</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            Open the opt-in page, tap Become a tester, wait ~1 minute, then install from Play.
          </p>
          <Button
            type="button"
            onClick={openPlayTestingOptIn}
            className="mt-4 h-11 w-full rounded-xl bg-titan-cyan text-sm font-bold text-black hover:bg-titan-cyan/85"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Become a tester
          </Button>
          <p className="mt-2 break-all text-[10px] text-white/25">{TITANOS_PLAY_TESTING_URL}</p>
        </div>

        <div className="mb-5 space-y-3">
          {DOWNLOAD_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-titan-cyan/10">
                  <Smartphone className="h-5 w-5 text-titan-cyan" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold">{pkg.name}</p>
                  <p className="mt-0.5 text-xs text-white/40">{pkg.desc}</p>
                  <p className="mt-1 text-[11px] text-white/25">
                    {pkg.filename} · {pkg.size}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={pkg.download}
                className={
                  pkg.primary
                    ? "h-11 w-full rounded-xl bg-titan-cyan text-sm font-bold text-black hover:bg-titan-cyan/85"
                    : "h-11 w-full rounded-xl border border-white/10 bg-transparent text-sm font-bold text-white/70 hover:bg-white/5 hover:text-white"
                }
                variant={pkg.primary ? "default" : "outline"}
              >
                {pkg.id === "play" ? (
                  <ExternalLink className="mr-2 h-4 w-4" />
                ) : (
                  <DownloadIcon className="mr-2 h-4 w-4" />
                )}
                {pkg.id === "play" ? "Open Google Play" : `Download ${pkg.label}`}
              </Button>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
            How to install (Play)
          </p>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-titan-cyan/15 text-[10px] font-black text-titan-cyan">
                  {i + 1}
                </span>
                <p className="text-xs leading-relaxed text-white/50">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <Button
          asChild
          className="mb-4 h-12 w-full rounded-2xl bg-titan-cyan text-sm font-bold text-black hover:bg-titan-cyan/90"
        >
          <Link to="/register">
            Create free account <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>

        <p className="text-center text-xs text-white/20">
          Questions?{" "}
          <Link to="/beta" className="text-titan-cyan hover:text-titan-cyan/70">
            Join the Beta Program
          </Link>{" "}
          or{" "}
          <Link to="/login" className="text-titan-cyan hover:text-titan-cyan/70">
            sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
