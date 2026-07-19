import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  UserPlus,
  FileText,
  Receipt,
  Calculator,
  Store,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

const actions = [
  { icon: Plus, label: "New Job", sub: "Schedule work", path: "/jobs?new=1", color: "from-titan-cyan to-cyan-400" },
  { icon: UserPlus, label: "Add Customer", sub: "New client profile", path: "/customers?new=1", color: "from-titan-indigo to-purple-400" },
  { icon: Calculator, label: "Price it", sub: "Job estimator", path: "/job-estimator", color: "from-titan-amber to-yellow-400" },
  { icon: FileText, label: "Estimate", sub: "Build a quote", path: "/estimates?new=1", color: "from-orange-500 to-amber-400" },
  { icon: Receipt, label: "Invoice", sub: "Bill completed work", path: "/invoices?new=1", color: "from-titan-green to-emerald-400" },
  { icon: Store, label: "Marketplace", sub: "Free During Beta", path: "/marketplace", color: "from-sky-500 to-blue-400" },
  { icon: UserRoundSearch, label: "Hire", sub: "Find workers", path: "/hire", color: "from-fuchsia-500 to-pink-400" },
  { icon: UsersRound, label: "Community", sub: "Live job feed", path: "/community", color: "from-emerald-500 to-teal-400" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {actions.map((action, i) => (
        <motion.div
          key={action.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04 }}
          whileTap={{ scale: 0.97 }}
        >
          <Link
            to={action.path}
            className="glass glass-hover rounded-2xl p-4 flex flex-col items-center gap-2.5 transition-all duration-200 group block text-center min-h-[108px]"
          >
            <div
              className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-lg`}
            >
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{action.label}</p>
              <p className="text-xs text-white/35 mt-0.5 leading-tight">{action.sub}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
