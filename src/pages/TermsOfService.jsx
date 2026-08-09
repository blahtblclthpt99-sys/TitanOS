import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SiteFooter from "@/components/marketing/SiteFooter";

const EFFECTIVE_DATE = "July 13, 2026";
const VERSION = "1.0";

const SECTIONS = [
  {
    title: "Agreement to Terms",
    body: `By accessing or using TitanOS ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These Terms apply to all visitors, users, and others who access or use TitanOS.`,
  },
  {
    title: "Description of Service",
    body: `TitanOS is a driver-first operating platform that helps users manage shifts, miles, expenses, profit signals, and related workflows. Features may change over time as we improve the product. Beta or preview features may be incomplete and are provided as-is.`,
  },
  {
    title: "Accounts & Eligibility",
    body: `You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Provide accurate information and notify us promptly of any unauthorized use.`,
  },
  {
    title: "Acceptable Use",
    body: `You agree not to misuse the Service, including by attempting unauthorized access, interfering with other users, uploading unlawful or harmful content, scraping without permission, or using TitanOS to violate applicable laws. We may suspend or terminate accounts that violate these Terms.`,
  },
  {
    title: "Your Content & Data",
    body: `You retain ownership of the driver and operational data you enter into TitanOS (shifts, miles, expenses, and similar records). You grant us a limited license to host, process, and display that data solely to operate and improve the Service. See our Privacy Policy for how we handle personal information.`,
  },
  {
    title: "Transactions",
    body: `When you use an integrated processor to collect customer transactions, that processor's terms and privacy practices apply. You are responsible for reviewing transaction details before confirmation and for applicable taxes.`,
  },
  {
    title: "Third-Party Services",
    body: `TitanOS may integrate with third parties (for example payment processors, maps, email, or AI providers). Their terms and privacy practices apply to their services. We are not responsible for third-party outages or policy changes beyond our reasonable control.`,
  },
  {
    title: "Disclaimers",
    body: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components.`,
  },
  {
    title: "Limitation of Liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, TITANOS AND ITS AFFILIATES SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR BUSINESS, ARISING FROM YOUR USE OF THE SERVICE. [Legal review: confirm appropriate liability limits for each launch jurisdiction.]`,
  },
  {
    title: "Termination",
    body: `You may stop using TitanOS at any time. We may suspend or terminate access if you violate these Terms or if we discontinue the Service. Upon termination, your right to use the Service ends; provisions that by nature should survive (including liability limits and intellectual property) will survive.`,
  },
  {
    title: "Changes to These Terms",
    body: `We may update these Terms from time to time. We will post the revised version on this page and update the effective date and version. Continued use after changes become effective constitutes acceptance of the revised Terms.`,
  },
  {
    title: "Contact",
    body: `Questions about these Terms? Contact us at legal@titanos.app. For privacy matters, see our Privacy Policy or email privacy@titanos.app.`,
  },
];

export default function TermsOfService() {
  const navigate = useNavigate();

  const goBack = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back
          </button>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Legal</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-2">
              Version {VERSION} · Effective date: {EFFECTIVE_DATE}
            </p>
            <p className="text-xs text-muted-foreground mb-10">
              Some sections marked for legal review are placeholders pending counsel approval.
            </p>

            <p className="text-muted-foreground text-sm leading-relaxed mb-10">
              These Terms of Service govern your use of TitanOS. Please read them carefully. By
              creating an account or using the Service, you agree to these Terms and our{" "}
              <Link to="/privacy-policy" className="text-primary underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>

            <div className="space-y-8">
              {SECTIONS.map((s, i) => (
                <div key={s.title}>
                  <h2 className="text-base font-semibold text-foreground mb-2">
                    {i + 1}. {s.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
