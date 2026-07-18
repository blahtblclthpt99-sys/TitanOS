import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { Link } from "react-router-dom";

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
    body: `Your data is stored securely on our servers. We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security audits. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: "Data Sharing",
    body: `We do not sell, trade, or rent your personal information to third parties. We may share your information with trusted service providers who assist us in operating our platform, conducting our business, or serving our users — provided they agree to keep your information confidential. We may also disclose information when required by law.`,
  },
  {
    title: "Cookies & Tracking",
    body: `TitanOS uses cookies and similar tracking technologies to enhance your experience. These help us understand how you use the platform, remember your preferences, and keep you logged in. You can control cookie settings through your browser, though disabling cookies may affect some features.`,
  },
  {
    title: "Your Rights",
    body: `You have the right to access, correct, or delete your personal data at any time. You may request a copy of the data we hold about you, ask us to correct inaccuracies, or request deletion of your account and associated data by contacting us. We will respond to your request within 30 days.`,
  },
  {
    title: "Data Retention",
    body: `We retain your information for as long as your account is active or as needed to provide you services. If you close your account, we will delete or anonymize your information within 90 days, unless we are required to retain it for legal or compliance purposes.`,
  },
  {
    title: "Children's Privacy",
    body: `TitanOS is not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will promptly delete it.`,
  },
  {
    title: "Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the effective date. Your continued use of TitanOS after changes become effective constitutes your acceptance of the revised policy.`,
  },
  {
    title: "Contact Us",
    body: `If you have any questions about this Privacy Policy or our data practices, please contact us at privacy@titanos.app. We take privacy seriously and are committed to addressing your concerns promptly.`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-titan-cyan" />
            </div>
            <span className="text-xs text-white/30 uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-white/30 mb-10">Effective date: June 28, 2025</p>

          <p className="text-white/60 text-sm leading-relaxed mb-10">
            TitanOS ("we", "us", or "our") is committed to protecting your privacy. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your information when you
            use our field service management platform and related services.
          </p>

          {/* Sections */}
          <div className="space-y-8">
            {SECTIONS.map((s, i) => (
              <div key={i}>
                <h2 className="text-base font-semibold text-white mb-2">
                  {i + 1}. {s.title}
                </h2>
                <p className="text-sm text-white/50 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-white/5">
            <p className="text-xs text-white/20 text-center">
              © {new Date().getFullYear()} TitanOS. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}