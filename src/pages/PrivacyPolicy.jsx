import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SiteFooter from "@/components/marketing/SiteFooter";

const EFFECTIVE_DATE = "July 13, 2026";
const VERSION = "1.1";

const SECTIONS = [
  {
    title: "Information We Collect",
    body: `We collect information you provide directly to us, such as your name, email address, phone number, and business details when you create an account or use our services. We also collect information about your use of TitanOS, including jobs, customers, invoices, expenses, and other business records you create within the platform.`,
  },
  {
    title: "How We Use Your Information",
    body: `We use the information we collect to provide, maintain, and improve TitanOS; to process transactions and send related information; to send technical notices and support messages; to respond to your comments and questions; and to monitor and analyze trends and usage within the platform.`,
  },
  {
    title: "Data Storage & Security",
    body: `Your data is stored securely using industry-standard providers. We implement encryption in transit and at rest, access controls, and operational safeguards. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: "Data Sharing",
    body: `We do not sell, trade, or rent your personal information to third parties. We may share information with trusted service providers who assist us in operating the platform (for example hosting, email, payments, or analytics), provided they protect it appropriately. We may also disclose information when required by law.`,
  },
  {
    title: "Cookies & Tracking",
    body: `TitanOS uses cookies and similar technologies to keep you signed in, remember preferences (such as theme), and understand how the product is used. You can control cookies through your browser; disabling them may affect some features.`,
  },
  {
    title: "Your Rights",
    body: `You may request access, correction, or deletion of your personal data. Contact us and we will respond within 30 days, subject to legal retention requirements. [Legal review: add region-specific rights such as GDPR/CCPA where applicable.]`,
  },
  {
    title: "Data Retention",
    body: `We retain your information for as long as your account is active or as needed to provide the Service. If you close your account, we will delete or anonymize personal information within 90 days unless we must retain it for legal or compliance purposes.`,
  },
  {
    title: "Children's Privacy",
    body: `TitanOS is not directed to individuals under 18. We do not knowingly collect personal information from children. If you believe a child has provided personal information, contact us and we will delete it promptly.`,
  },
  {
    title: "Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. We will post the new policy on this page and update the effective date and version. Continued use after changes become effective constitutes acceptance of the revised policy.`,
  },
  {
    title: "Contact Us",
    body: `Questions about this Privacy Policy? Contact privacy@titanos.app. We take privacy seriously and will address concerns promptly.`,
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
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Legal</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-10">
              Version {VERSION} · Effective date: {EFFECTIVE_DATE}
            </p>

            <p className="text-muted-foreground text-sm leading-relaxed mb-10">
              TitanOS (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our field service management platform. See also our{" "}
              <Link to="/terms" className="text-primary underline underline-offset-2">
                Terms of Service
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
