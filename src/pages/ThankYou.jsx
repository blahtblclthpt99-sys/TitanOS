import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}
        className="w-24 h-24 rounded-3xl bg-titan-cyan/10 border border-titan-cyan/20 flex items-center justify-center mb-8">
        <CheckCircle className="w-12 h-12 text-titan-cyan" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 className="text-4xl font-bold text-foreground mb-3">You're in!</h1>
        <p className="text-muted-foreground text-lg max-w-sm mx-auto mb-8">
          Welcome to TitanOS Pro. Your subscription is active and every feature is unlocked.
        </p>

        <Link to="/">
          <Button className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-bold rounded-2xl h-13 px-8 text-base gap-2">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}