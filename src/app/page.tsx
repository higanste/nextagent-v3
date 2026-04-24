"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, Loader2, ArrowRight } from "lucide-react";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Home() {
  const [dropText, setDropText] = useState("");
  const [pin, setPin] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);

  const [receivePin, setReceivePin] = useState("");
  const [receivedText, setReceivedText] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState("");

  // Auto-listen when receivePin is 4 digits
  useEffect(() => {
    if (receivePin.length === 4) {
      setIsReceiving(true);
      setReceiveError("");
      const docRef = doc(db, "drops", receivePin.toUpperCase());
      
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        setIsReceiving(false);
        if (docSnap.exists()) {
          setReceivedText(docSnap.data().content);
        } else {
          setReceivedText(null);
          setReceiveError("No drop found for this PIN.");
        }
      }, (error) => {
        setIsReceiving(false);
        console.error("Error listening to document:", error);
        setReceiveError("Connection error. Check Firebase config.");
      });

      return () => unsubscribe();
    } else {
      setReceivedText(null);
      setReceiveError("");
    }
  }, [receivePin]);

  const handleGenerate = async () => {
    if (!dropText.trim()) return;
    setIsGenerating(true);
    
    // Generate a random 4-char alphanumeric code
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    
    try {
      await setDoc(doc(db, "drops", code), {
        content: dropText,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h TTL
      });
      setGeneratedPin(code);
      setDropText("");
    } catch (e) {
      console.error(e);
      alert("Failed to generate drop. Ensure Firebase is configured correctly.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0] font-sans selection:bg-[#ff003c] selection:text-white">
      {/* Brutalist Grid Background */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-20 flex flex-col items-center">
        
        {/* Header - Hack Club / Brutalist Style */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex flex-col items-center mb-16"
        >
          <div className="flex items-center gap-4 mb-4">
            <img src="/logo.png" alt="NextAgent Logo" className="w-16 h-16 drop-shadow-[4px_4px_0px_#ff003c]" />
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase" style={{ textShadow: '4px 4px 0px #ff003c' }}>
              DROP
            </h1>
          </div>
          <p className="text-xl md:text-2xl font-mono text-zinc-400 bg-black px-4 py-2 border-2 border-zinc-700 shadow-[4px_4px_0px_#3f3f46]">
            Frictionless real-time clipboard.
          </p>
        </motion.div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-12">
          
          {/* DROP SECTION */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-black border-4 border-white p-6 shadow-[8px_8px_0px_#fff] hover:shadow-[12px_12px_0px_#ff003c] transition-all duration-300">
              <h2 className="text-3xl font-black uppercase mb-4 tracking-tight">1. Drop Text</h2>
              
              <textarea 
                value={dropText}
                onChange={(e) => setDropText(e.target.value)}
                placeholder="Paste your text, code snippet, or AI prompt here..."
                className="w-full h-48 bg-zinc-900 border-2 border-zinc-700 p-4 font-mono text-sm focus:outline-none focus:border-[#ff003c] resize-none mb-4"
              />

              <button 
                onClick={handleGenerate}
                disabled={!dropText.trim() || isGenerating}
                className="w-full py-4 bg-white text-black font-black text-xl uppercase tracking-widest border-2 border-black hover:bg-[#ff003c] hover:text-white transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="animate-spin w-6 h-6" /> : "Generate PIN"}
              </button>
            </div>

            <AnimatePresence>
              {generatedPin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#ff003c] border-4 border-white p-6 shadow-[8px_8px_0px_#fff]"
                >
                  <p className="text-white font-bold uppercase text-sm mb-2">Your Drop PIN</p>
                  <div className="flex items-center justify-between bg-black p-4 border-2 border-white">
                    <span className="text-5xl font-black font-mono tracking-widest">{generatedPin}</span>
                    <button onClick={() => copyToClipboard(generatedPin)} className="p-3 bg-white text-black hover:bg-zinc-300 transition-colors">
                      <Copy className="w-6 h-6" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* RECEIVE SECTION */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-black border-4 border-[#00ffcc] p-6 shadow-[8px_8px_0px_#00ffcc] hover:shadow-[12px_12px_0px_#00ffcc] transition-all duration-300">
              <h2 className="text-3xl font-black uppercase mb-4 tracking-tight">2. Catch Text</h2>
              
              <div className="relative mb-6">
                <input 
                  type="text"
                  maxLength={4}
                  value={receivePin}
                  onChange={(e) => setReceivePin(e.target.value.toUpperCase())}
                  placeholder="ENTER 4-DIGIT PIN"
                  className="w-full py-6 bg-zinc-900 border-2 border-zinc-700 text-center text-4xl font-black font-mono uppercase tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-[#00ffcc]"
                />
                {isReceiving && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin w-6 h-6 text-[#00ffcc]" />
                  </div>
                )}
              </div>

              <AnimatePresence mode="wait">
                {receivedText ? (
                  <motion.div 
                    key="text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative"
                  >
                    <textarea 
                      readOnly
                      value={receivedText}
                      className="w-full h-64 bg-zinc-900 border-2 border-[#00ffcc] p-4 font-mono text-sm focus:outline-none resize-none"
                    />
                    <button 
                      onClick={() => copyToClipboard(receivedText)}
                      className="absolute bottom-4 right-4 p-3 bg-[#00ffcc] text-black font-bold uppercase text-sm border-2 border-black hover:bg-white transition-colors flex items-center gap-2 shadow-[4px_4px_0px_#000]"
                    >
                      <Copy className="w-4 h-4" /> Copy
                    </button>
                  </motion.div>
                ) : receiveError ? (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-red-500/20 border-2 border-red-500 text-red-500 font-bold font-mono text-center"
                  >
                    {receiveError}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    className="h-64 flex items-center justify-center border-2 border-dashed border-zinc-700 bg-zinc-900/50"
                  >
                    <p className="text-zinc-500 font-mono font-bold uppercase flex items-center gap-2">
                      <Download className="w-5 h-5" /> Waiting for drop...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
