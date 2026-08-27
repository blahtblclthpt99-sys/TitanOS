import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router";
import SiteFooter from "@/components/marketing/SiteFooter";

const EFFECTIVE_DATE = "August 26, 2026";
const VERSION = "1.1";
const SUPPORT_EMAIL = "titanosmail@protonmail.com";

const SECTIONS = [
  {
    title: "Agreement to Terms",
    body: `By accessing or using TitanOS ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service. These Terms apply to visitors, account holders, job seekers, workers, businesses, and other users of TitanOS.`,
  },
  {
    title: "Description of Service",
    body: `TitanOS is a jobs, careers, work-opportunity, and work-organization platform. It may provide career profiles, opportunity discovery, job matching, application tracking, interview preparation, scheduling, AI-assisted career tools, and optional operational tools for work you perform. Features may change as the Service evolves, and beta or preview features may be incomplete.`,
  },
  {
    title: "Accounts & Eligibility",
    body: `You must be at least 18 years old to create an account unless TitanOS expressly provides a lawful age-appropriate experience in the future. You are responsible for accurate account information, maintaining the confidentiality of your credentials, and activity under your account. Notify us promptly if you believe your account has been compromised.`,
  },
  {
    title: "Jobs, Matches & Employment Decisions",
    body: `TitanOS may rank, organize, or explain opportunities based on information you provide, such as skills, experience, credentials, preferences, and general location. Match scores, requirement notices, readiness information, and AI suggestions are advisory tools for you. They are not promises of eligibility, interviews, hiring, employment, compensation, or employer action, and TitanOS does not make an employer's hiring decision merely because a match score is shown. You remain responsible for deciding whether, when, and where to apply.`,
  },
  {
    title: "External Opportunities & Third Parties",
    body: `Some opportunities or services may come from third-party employers, job providers, payment processors, maps, communications providers, AI providers, or other services. TitanOS may link to or display information supplied by those parties. Third-party terms and privacy practices may apply. Job availability, compensation, requirements, employer identity, and other listing details can change, so review the authoritative source before relying on or submitting information.`,
  },
  {
    title: "AI-Assisted Features",
    body: `TitanOS AI features may help explain matches, organize information, draft career materials, practice interviews, or support work-related tasks. AI output can be incomplete or incorrect and must be reviewed before use. Unless a feature clearly says otherwise and you expressly authorize it, TitanOS AI is not an employer, recruiter, legal representative, or authority making consequential employment decisions on your behalf.`,
  },
  {
    title: "Acceptable Use",
    body: `You agree not to misuse TitanOS, including attempting unauthorized access, interfering with the Service or another user, impersonating another person or employer, posting fraudulent or unlawful opportunities, uploading harmful content, scraping or automating access without permission, circumventing safeguards, or using TitanOS to violate applicable law. We may restrict or terminate accounts that violate these Terms or create material risk to users or the Service.`,
  },
  {
    title: "Your Content & Data",
    body: `You retain ownership of content and records you submit to TitanOS. You grant us a limited license to host, process, transmit, and display that information as reasonably necessary to operate, secure, support, and improve the Service and to perform features you request. Our Privacy Policy describes how personal information is handled.`,
  },
  {
    title: "Payments, Subscriptions & Billing",
    body: `Paid plans, trials, fees, renewal terms, and prices are the amounts and terms displayed to you at purchase. Digital subscriptions purchased inside the TitanOS Android app are processed through Google Play Billing when required by Google Play policy. Eligible web purchases may be processed through Stripe or another disclosed processor. Processor terms may also apply. You are responsible for applicable taxes. Cancellation, refunds, credits, renewals, and billing disputes are handled according to the purchase channel, displayed billing terms, applicable processor rules, and applicable law. TitanOS does not guarantee that a paid plan will produce employment, income, profit, or any particular business result.`,
  },
  {
    title: "Optional Work & Business Tools",
    body: `TitanOS may provide secondary tools such as work orders, routing, mileage, customers, estimates, invoices, payments, records, fleet, and reporting. You are responsible for reviewing records generated from your inputs and for complying with tax, employment, transportation, licensing, insurance, recordkeeping, and other legal obligations that apply to your work or business.`,
  },
  {
    title: "Disclaimers",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR A GUARANTEE OF EMPLOYMENT, JOB AVAILABILITY, INCOME, BUSINESS RESULTS, OR UNINTERRUPTED OPERATION. Nothing in these Terms excludes rights or warranties that cannot lawfully be excluded.`,
  },
  {
    title: "Limitation of Liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, TITANOS AND ITS AFFILIATES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR BUSINESS ARISING FROM USE OF THE SERVICE. TO THE EXTENT A LIABILITY CAP IS PERMITTED, OUR AGGREGATE LIABILITY FOR CLAIMS ARISING FROM THE SERVICE WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID TITANOS IN THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR USD $100.`,
  },
  {
    title: "Termination",
    body: `You may stop using TitanOS at any time and may request account deletion through the available account-deletion process. We may suspend or terminate access for a material violation of these Terms, fraud, security risk, legal requirement, or discontinuation of the Service. Provisions that by their nature should survive termination remain in effect.`,
  },
  {
    title: "Changes to These Terms",
    body: `We may update these Terms as TitanOS changes. We will post the revised version here and update the effective date and version. When required, material changes may also be communicated through TitanOS or another appropriate channel. Continued use after updated Terms become effective constitutes acceptance to the extent permitted by law.`,
  },
  {
    title: "Contact",
    body: `Questions about these Terms or TitanOS? Contact ${SUPPORT_EMAIL}. For privacy requests, see the Privacy Policy and account-deletion page.`,
  },
];

export default function TermsOfService() {
  const navigate = useNavigate();

  const goBack = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1 && window.history.state?.idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <button type="button" onClick={goBack} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors min-h-[44px]">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
          </button>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Legal</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-10">Version {VERSION} · Effective date: {EFFECTIVE_DATE}</p>

            <p className="text-muted-foreground text-sm leading-relaxed mb-10">
              These Terms govern your use of TitanOS. By creating an account or using the Service, you agree to these Terms and our{" "}
              <Link to="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>.
            </p>

            <div className="space-y-8">
              {SECTIONS.map((s, i) => (
                <div key={s.title}>
                  <h2 className="text-base font-semibold text-foreground mb-2">{i + 1}. {s.title}</h2>
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
