import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router";
import SiteFooter from "@/components/marketing/SiteFooter";

const EFFECTIVE_DATE = "August 17, 2026";
const VERSION = "1.2";
const SUPPORT_EMAIL = "titanosmail@protonmail.com";

const SECTIONS = [
  {
    title: "Information We Collect",
    body: `We collect information you provide directly to us, such as your name, email address, phone number, business details, work profile, skills, certifications, jobs, customers, invoices, expenses, messages, and other records you create in TitanOS. When you use location-based features, TitanOS may access precise or approximate device location to support job locations, mileage, routing, geofence proof, driver features, and work matching.`,
  },
  {
    title: "How We Use Your Information",
    body: `We use the information we collect to provide, maintain, secure, and improve TitanOS; operate job matching and field-service workflows; process transactions and subscriptions; provide AI-assisted features using account-scoped context; send technical notices and support messages; respond to questions; prevent fraud and abuse; and analyze product reliability and usage in accordance with your privacy settings.`,
  },
  {
    title: "Location Data",
    body: `TitanOS requests coarse and fine location only when location-enabled features need it. Location may be used for job locations, mileage and trip features, routing, geofence evidence, nearby work matching, and related field-service functions. TitanOS does not request Android background-location permission in the current release. You can control location permission in your device settings.`,
  },
  {
    title: "Data Storage & Security",
    body: `Your data is stored using industry-standard service providers. We use encryption in transit and at rest where supported, authentication and authorization controls, row-level data access policies, and operational safeguards. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: "Data Sharing",
    body: `We do not sell or rent your personal information. We may share information with service providers that help us operate TitanOS, such as hosting, authentication, database, email, payments, analytics, AI, mapping, and job-search providers, only as needed to provide the applicable feature and subject to their own contractual and privacy obligations. We may also disclose information when required by law or to protect users and the service.`,
  },
  {
    title: "Cookies & Tracking",
    body: `TitanOS uses cookies and similar technologies to keep you signed in, remember preferences, protect sessions, and understand product usage. Privacy controls allow you to manage optional product analytics and masked session replay where available. Disabling browser storage or cookies may affect some features.`,
  },
  {
    title: "Your Rights",
    body: `You may request access to, correction of, or deletion of your personal data, subject to applicable law and legitimate retention requirements. Privacy rights may vary by jurisdiction. To exercise a privacy right, use TitanOS account settings, visit the account-deletion page, or contact ${SUPPORT_EMAIL}.`,
  },
  {
    title: "Account Deletion & Data Retention",
    body: `You can submit an account-deletion request from within TitanOS or from our public account-deletion web page. We process verified deletion requests and delete or anonymize associated personal data within 30 days, except information we must retain for legitimate legal, tax, payment, security, fraud-prevention, dispute-resolution, or regulatory reasons. Retained records are limited to the applicable purpose and retention period.`,
  },
  {
    title: "Children's Privacy",
    body: `TitanOS is not directed to individuals under 18. We do not knowingly collect personal information from children. If you believe a child has provided personal information, contact us and we will take appropriate steps to delete it.`,
  },
  {
    title: "Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. We will post the revised policy on this page and update the effective date and version. Material changes may also be communicated through TitanOS or another appropriate channel.`,
  },
  {
    title: "Contact Us",
    body: `Questions about this Privacy Policy or a privacy request? Contact ${SUPPORT_EMAIL}.`,
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const goBack = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.state?.idx > 0) {
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
                <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Legal</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-10">
              Version {VERSION} · Effective date: {EFFECTIVE_DATE}
            </p>

            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              TitanOS (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our field-service and driver operating system. See also our{" "}
              <Link to="/terms" className="text-primary underline underline-offset-2">
                Terms of Service
              </Link>
              .
            </p>

            <p className="mb-10 text-sm text-muted-foreground">
              Need to delete your account?{" "}
              <Link to="/delete-account" className="text-primary underline underline-offset-2">
                Open the TitanOS account-deletion page
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
