import React from "react";
import { motion } from "framer-motion";
import { Rocket, Zap, Users, Shield, Star, Check, ArrowRight, Smartphone, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { openPlayStore } from "@/lib/app-download";

const FEATURES = [
  "Unlimited customers & jobs",
  "AI Assistant (Titan AI)",
  "Invoicing & estimates",
  "Expense & tax tracking",
  "Mile tracker",
  "Schedule & dispatch",
  "Fleet management",
  "Reports & analytics",
  "Mobile-first app",
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center py-12 px-4">

      {/* Beta badge */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 max-w-2xl w-full">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-titan-cyan/10 border border-titan-cyan/20 mb-6">
          <Rocket className="w-3.5 h-3.5 text-titan-cyan" />
          <span className="text-xs text-titan-cyan font-semibold uppercase tracking-wider">Public Beta</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Free During<br />
          <span className="gradient-text">Public Beta</span>
        </h1>
        <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto">
          TitanOS is completely free while we build and improve the platform together with our early users.
        </p>
      </motion.div>

      {/* Main beta card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-lg glass rounded-3xl p-6 sm:p-8 border border-titan-cyan/30 titan-glow mb-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-titan-cyan/10 flex items-center justify-center">
            <Star className="w-6 h-6 text-titan-cyan" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Everything Included</h2>
            <p className="text-xs text-white/40">All features, no restrictions</p>
          </div>
          <div className="ml-auto">
            <div className="text-right">
              <span className="text-4xl font-bold text-titan-cyan">$0</span>
              <p className="text-xs text-white/40 mt-0.5">free launch</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
          {FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-titan-cyan/15 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-titan-cyan" />
              </div>
              <span className="text-xs text-white/60">{f}</span>
            </div>
          ))}
        </div>

        <Button asChild className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-2xl h-12 text-sm gap-2">
          <Link to="/register">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </motion.div>

      {/* Android app download */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="w-full max-w-lg glass rounded-2xl p-5 border border-titan-indigo/20 mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-titan-indigo/30 to-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-titan-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white mb-0.5">TitanOS for Android</p>
            <p className="text-xs text-white/40">Install from Google Play (testers must opt in first)</p>
          </div>
          <Button
            onClick={openPlayStore}
            className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-10 px-4 gap-1.5 flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            Get App
          </Button>
        </div>
      </motion.div>

      {/* Beta messaging */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-lg glass rounded-2xl p-5 border border-white/5 mb-8"
      >
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-titan-amber flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">What happens after beta?</p>
            <p className="text-xs text-white/50 leading-relaxed">
              Premium plans and additional features will be introduced in the future. Early beta users will receive special pricing and perks. We'll give you plenty of notice before any changes.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Trust signals */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
        {[
          { Icon: Shield, label: "No credit card required" },
          { Icon: Users, label: "Join early adopters" },
          { Icon: Rocket, label: "New features weekly" },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-white/30">
            <Icon className="w-3.5 h-3.5 text-titan-cyan/60" />
            {label}
          </div>
        ))}
      </div>

      {/* Beta program CTA */}
      <div className="text-center mb-8">
        <p className="text-xs text-white/30 mb-2">Want to stay in the loop?</p>
        <Link to="/beta" className="text-xs text-titan-cyan hover:text-titan-cyan/80 transition-colors font-medium">
          Join the Beta Program →
        </Link>
      </div>

      <div className="flex gap-4">
        <Link to="/privacy-policy" className="text-xs text-white/20 hover:text-white/50 transition-colors">Privacy Policy</Link>
      </div>
    </div>
  );
}