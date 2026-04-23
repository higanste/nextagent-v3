"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, FileText, X, Sparkles, Bot, User, ArrowUp, Loader2, Play } from "lucide-react";
import Image from "next/image";

export default function DashboardClient({ user, isPro }: { user: any, isPro: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, setInput } = useChat({
    api: "/api/chat",
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleCustomSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input?.trim() && !file) return;

    if (!file) {
      // Default useChat behavior
      handleSubmit(e);
      return;
    }

    // Custom behavior for file uploads using FormData
    const userMessage = { id: Date.now().toString(), role: "user" as const, content: input || "Analyzed attached file." };
    setMessages([...messages, userMessage]);
    setInput("");
    
    const formData = new FormData();
    if (input) formData.append("message", input);
    formData.append("isPro", isPro.toString());
    formData.append("file", file);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      
      const assistantMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        
        // Vercel AI SDK stream format usually starts with '0:"content"\n'
        // Let's parse the chunks crudely for the MVP
        const lines = chunkValue.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const content = JSON.parse(line.slice(2));
              setMessages((prev) => prev.map(m => m.id === assistantMessageId ? { ...m, content: m.content + content } : m));
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "Sorry, there was an error processing your file." }]);
    } finally {
      setFile(null); // Clear file after sending
    }
  };

  const handleBilling = async () => {
    try {
      const res = await fetch("/api/checkout", { method: "POST", body: JSON.stringify({ priceId: "price_dummy" }) });
      const data = await res.json();
      if (!res.ok) {
        alert("Billing error: " + (data.error || "Failed to initiate checkout"));
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      alert("Checkout failed: " + e.message);
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-500/30">
      
      {/* Sidebar - Simple & Cinematic */}
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-2xl flex flex-col justify-between p-6">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <img src="/logo.png" alt="NextAgent Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
            <span className="text-xl font-bold tracking-tight">NextAgent</span>
          </div>
          <div className="space-y-2 text-sm font-medium text-zinc-400">
            <div onClick={() => window.location.reload()} className="px-3 py-2 rounded-lg bg-white/5 text-white cursor-pointer">New Chat</div>
            <div className="px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white cursor-pointer transition-colors">History</div>
            <div onClick={handleBilling} className="px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white cursor-pointer transition-colors flex items-center justify-between">
              Billing <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full">PRO</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
            {user.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-bold truncate">{user.name}</div>
            <div className="text-xs text-zinc-400 truncate">{isPro ? "Pro Plan" : "Free Tier"}</div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth z-10">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6">
                <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.15)] mx-auto">
                  <Sparkles className="w-10 h-10 text-blue-400" />
                </div>
              </motion.div>
              <h2 className="text-3xl font-bold tracking-tight mb-3">How can I help you today?</h2>
              <p className="text-zinc-400 text-lg mb-8">Upload a PDF, Word doc, Text file, or Audio clip and let's get started.</p>
            </div>
          ) : (
            messages.map((m) => (
              <motion.div 
                key={m.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-4xl mx-auto ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center ${m.role === 'user' ? 'bg-zinc-800' : 'bg-blue-600/20 border border-blue-500/30'}`}>
                  {m.role === 'user' ? <User className="w-4 h-4 text-zinc-300" /> : <Bot className="w-4 h-4 text-blue-400" />}
                </div>
                <div className={`flex-1 space-y-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block px-5 py-3 rounded-2xl text-[15px] leading-relaxed ${m.role === 'user' ? 'bg-zinc-800/80 text-white' : 'bg-transparent text-zinc-300'}`}>
                    {m.content}
                  </div>
                </div>
              </motion.div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-4 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 md:p-8 pt-0 z-10 w-full max-w-4xl mx-auto">
          {/* File Preview */}
          <AnimatePresence>
            {file && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="mb-3 inline-flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-zinc-300 truncate max-w-[200px]">{file.name}</span>
                <button onClick={() => setFile(null)} className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleCustomSubmit} className="relative flex items-center bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden focus-within:border-blue-500/50 transition-colors">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".txt,.pdf,.docx,.mp3,.wav"
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-4 text-zinc-400 hover:text-white transition-colors"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask anything or analyze a file..."
              className="flex-1 bg-transparent border-none outline-none text-[15px] text-white placeholder:text-zinc-500 py-4 h-14"
            />
            <button 
              type="submit" 
              disabled={isLoading || (!input?.trim() && !file)}
              className="p-3 m-1 mr-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:shadow-none"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </form>
          <div className="text-center mt-3 text-xs text-zinc-500">
            NextAgent MVP powered by Groq & OpenRouter. Free tier may have rate limits.
          </div>
        </div>

        {/* Onboarding Tutorial Overlay */}
        <AnimatePresence>
          {showTutorial && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                  <Play className="w-8 h-8 text-blue-400 ml-1" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Welcome to NextAgent</h3>
                <p className="text-zinc-400 leading-relaxed mb-8">
                  Your intelligent edge assistant is ready. Click the <strong>paperclip</strong> icon to upload any document or audio file, then ask a question to analyze it instantly.
                </p>
                <button 
                  onClick={() => setShowTutorial(false)}
                  className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors"
                >
                  Get Started
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
