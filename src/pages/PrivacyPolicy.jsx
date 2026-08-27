import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router";
import SiteFooter from "@/components/marketing/SiteFooter";

const EFFECTIVE_DATE = "August 26, 2026";
const VERSION = "1.3";
const SUPPORT_EMAIL = "titanosmail@protonmail.com";

const SECTIONS = [
  {
    title: "Information We Collect",
    body: `We collect information you provide directly to TitanOS, such as your name, email address, phone number, career profile, work history, skills, certifications, job preferences, saved opportunities, applications, interview and schedule information, messages, and records you create with optional work tools such as customers, estimates, invoices, expenses, or trips. We also receive limited technical information needed to operate, secure, troubleshoot, and improve the Service.`,
  },
  {
    title: "How We Use Your Information",
    body: `We use information to provide and secure TitanOS; help you discover and organize jobs and work opportunities; generate user-controlled job matches and career assistance; maintain application, interview, schedule, and work records; process subscriptions and transactions; provide customer support; prevent fraud and abuse; and improve reliability. TitanOS match scores and recommendations are assistance for the user and are not employer hiring decisions or automatic employment eligibility determinations.`,
  },
  {
    title: "Location Data",
    body: `The TitanOS career-core Android release is designed to work without background location. TitanOS may request approximate foreground location when you deliberately use a feature that benefits from location, such as nearby opportunity discovery or an active work-session tool. Location access is feature-scoped and can be denied or changed in device settings. The career-core Android release does not request precise or background location permission.`,
  },
  {
    title: "Contacts, Camera, Files & Notifications",
    body: `TitanOS does not require broad device-contact access for ordinary career use. When a feature lets you select a person, document, resume, credential, image, or other file, TitanOS should use a user-initiated picker or upload flow where available. Camera or file access is requested only after you start a feature that needs it. Notifications are used for relevant account, application, interview, scheduling, support, safety, or work updates and may be controlled through TitanOS or device settings.`,
  },
  {
    title: "Jobs, Applications & External Providers",
    body: `TitanOS may show opportunities posted directly in TitanOS and, when you enable external job search, may retrieve listings from third-party job providers. We may send limited search criteria such as job interests, skills, and general location to a configured provider to return relevant results. External-provider use is optional where presented as such. Source information is displayed when available, and third-party listings remain subject to the provider or employer's terms and privacy practices.`,
  },
  {
    title: "AI-Assisted Features",
    body: `TitanOS may use AI service providers to help with tasks such as explaining job matches, drafting or improving career materials, interview preparation, support, and organizing user-provided work information. We limit the information sent to the context reasonably needed for the requested feature. Do not provide highly sensitive information unless it is necessary for the feature you intentionally use. AI output can be incorrect and should be reviewed before you rely on or submit it.`,
  },
  {
    title: "Payments & Subscriptions",
    body: `For digital subscriptions purchased in the Android app, Google Play processes the purchase and TitanOS receives purchase and entitlement information needed to verify and maintain access. Web subscriptions may be processed by Stripe. Payment processors receive payment information under their own privacy terms; TitanOS does not need to store full payment-card numbers for these processor-hosted payment flows.`,
  },
  {
    title: "Data Storage & Security",
    body: `We use service providers and technical safeguards appropriate to the Service, including secure transport, authentication, authorization controls, restricted server-side credentials, and database access controls. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.`,
  },
  {
    title: "Data Sharing",
    body: `We do not sell or rent your personal information. We may share information with service providers that help operate TitanOS, such as hosting, authentication, database, communications, payments, AI, mapping, analytics, error monitoring, and job-search providers, only as needed for the applicable service or feature. We may also disclose information when required by law or when reasonably necessary to protect users, rights, safety, or the integrity of TitanOS.`,
  },
  {
    title: "Cookies & Product Analytics",
    body: `TitanOS may use cookies, local storage, and similar technologies to keep you signed in, remember preferences, protect sessions, and understand product reliability and usage. Optional analytics or replay features, where offered, are subject to the privacy controls presented in the product. Disabling browser storage or cookies may affect functionality.`,
  },
  {
    title: "Your Choices & Rights",
    body: `You can update many profile and preference fields in TitanOS, control device permissions through your operating system, and disable optional external job search where that control is provided. You may request access to, correction of, or deletion of personal data subject to applicable law and legitimate retention requirements. Privacy rights vary by jurisdiction. Contact ${SUPPORT_EMAIL} for assistance.`,
  },
  {
    title: "Account Deletion & Data Retention",
    body: `You can submit an account-deletion request from TitanOS or the public account-deletion page. We process verified deletion requests and delete or anonymize associated personal data within 30 days, except information we must retain for legitimate legal, tax, payment, security, fraud-prevention, dispute-resolution, or regulatory purposes. Any retained records are limited to the applicable purpose and retention period.`,
  },
  {
    title: "Children's Privacy",
    body: `TitanOS is not directed to individuals under 18. We do not knowingly collect personal information from children. If you believe a child has provided personal information, contact us and we will take appropriate steps.`,
  },
  {
    title: "Changes to This Policy",
    body: `We may update this Privacy Policy as TitanOS changes. We will post the revised policy here and update the effective date and version. Material changes may also be communicated through TitanOS or another appropriate channel.`,
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
    if (typeof window !== "undefined" && window.history.state?.idx > 0) navigate(-1);
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
                <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Legal</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-10">Version {VERSION} · Effective date: {EFFECTIVE_DATE}</p>

            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              TitanOS (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is a jobs, careers, work-opportunity, and work-organization platform. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use TitanOS. See also our{" "}
              <Link to="/terms" className="text-primary underline underline-offset-2">Terms of Service</Link>.
            </p>

            <p className="mb-10 text-sm text-muted-foreground">
              Need to delete your account?{" "}
              <Link to="/delete-account" className="text-primary underline underline-offset-2">Open the TitanOS account-deletion page</Link>.
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
