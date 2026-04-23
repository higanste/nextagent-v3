"use client";

import { motion } from "framer-motion";
import { Bot, Sparkles, Shield, Zap, ArrowRight, Globe } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="NextAgent Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <span className="text-xl font-bold tracking-tight">NextAgent</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/api/auth/signin?callbackUrl=/dashboard" className="px-4 py-2 text-sm font-medium hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/api/auth/signin?callbackUrl=/dashboard" className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-zinc-200 transition-all">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-8"
            >
              <Sparkles className="w-3 h-3" />
              <span>NextAgent v3 is now live</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent"
            >
              The Intelligent Edge for <br className="hidden md:block" /> AI Agent Deployment
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Deploy, scale, and manage autonomous AI agents with the performance of Cloudflare Edge and the intelligence of Llama 3 & Claude 3.5.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col md:flex-row items-center justify-center gap-4"
            >
              <Link href="/api/auth/signin?callbackUrl=/dashboard" className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all flex items-center justify-center gap-2 group">
                Start Deploying <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="https://github.com/higanste/nextagent-website" className="w-full md:w-auto px-8 py-4 bg-zinc-900 border border-white/10 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                <Globe className="w-5 h-5" /> View Source
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: "Edge Performance",
                  desc: "Running on Cloudflare Workers for sub-50ms latency globally.",
                  icon: Zap,
                  color: "text-yellow-400"
                },
                {
                  title: "Multi-Model AI",
                  desc: "Switch between Llama 3, Claude 3.5, and GPT-4o with a single API.",
                  icon: Bot,
                  color: "text-blue-400"
                },
                {
                  title: "D1 Database",
                  desc: "Fully serverless SQL storage at the edge with zero cold starts.",
                  icon: Shield,
                  color: "text-green-400"
                }
              ].map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="p-8 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-colors group"
                >
                  <f.icon className={`w-10 h-10 ${f.color} mb-6 group-hover:scale-110 transition-transform`} />
                  <h3 className="text-xl font-bold mb-4">{f.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5 text-center text-zinc-500 text-sm">
        <p>© 2026 NextAgent. Built for the Edge.</p>
      </footer>
    </div>
  );
}
