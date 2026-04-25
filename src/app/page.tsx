"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, CheckCircle2, ArrowRight, UploadCloud, DownloadCloud, AlertCircle } from "lucide-react";
import { doc, setDoc, getDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Home() {
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [pin, setPin] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  
  const [activePin, setActivePin] = useState(""); // The PIN currently being used for sync

  // Typing debounce ref
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const generatePin = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const handleTextChange = (val: string) => {
    setText(val);
    
    if (mode === 'send') {
      if (!activePin) {
        const newPin = generatePin();
        setActivePin(newPin);
        // Create document
        setDoc(doc(db, "nextagent_drops", newPin), {
          text: val,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).catch(err => {
          console.error(err);
          // Fallback to syncscript_rooms if drops fail due to rules
          setDoc(doc(db, "syncscript_rooms", newPin), {
            text: val,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }).catch(err2 => setError("Failed to create drop. Check connection."));
        });
      } else {
        // Update document
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          updateDoc(doc(db, "nextagent_drops", activePin), {
            text: val,
            updatedAt: serverTimestamp()
          }).catch(err => {
            console.error(err);
            updateDoc(doc(db, "syncscript_rooms", activePin), {
              text: val,
              updatedAt: serverTimestamp()
            }).catch(e => setError("Failed to sync drop."));
          });
        }, 500);
      }
    }
  };

  const handleJoin = async () => {
    if (pin.length !== 4) return;
    try {
      setError("");
      // Try nextagent_drops first, then syncscript_rooms
      let docRef = doc(db, "nextagent_drops", pin.toUpperCase());
      let snap = await getDoc(docRef);
      if (!snap.exists()) {
        docRef = doc(db, "syncscript_rooms", pin.toUpperCase());
        snap = await getDoc(docRef);
      }

      if (snap.exists()) {
        setActivePin(pin.toUpperCase());
      } else {
        setError("Invalid PIN or Drop expired.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error. Please try again.");
    }
  };

  useEffect(() => {
    if (activePin) {
      // Listen to both collections to be safe
      const unsubscribe1 = onSnapshot(doc(db, "nextagent_drops", activePin), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.text !== text) setText(data.text);
        }
      });
      const unsubscribe2 = onSnapshot(doc(db, "syncscript_rooms", activePin), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.text !== text) setText(data.text);
        }
      });
      return () => {
        unsubscribe1();
        unsubscribe2();
      };
    }
  }, [activePin]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="w-full p-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <UploadCloud className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            NextAgent Drop
          </span>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto">
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-24 z-50 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl"
            >
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full">
          {/* Mode Tabs */}
          {!activePin && (
            <div className="flex bg-white/5 p-1 rounded-2xl mb-8 max-w-sm mx-auto backdrop-blur-3xl border border-white/10">
              <button
                onClick={() => setMode('send')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'send' ? 'bg-white text-black shadow-xl shadow-white/10' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <UploadCloud className="w-4 h-4" /> Drop
              </button>
              <button
                onClick={() => setMode('receive')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'receive' ? 'bg-white text-black shadow-xl shadow-white/10' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <DownloadCloud className="w-4 h-4" /> Receive
              </button>
            </div>
          )}

          {/* Active Drop Header */}
          {activePin && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-between items-center mb-6 bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl backdrop-blur-xl"
            >
              <div>
                <p className="text-indigo-400 text-sm font-semibold mb-1 uppercase tracking-wider">Your Drop PIN</p>
                <p className="text-5xl font-black tracking-widest text-white font-mono">{activePin}</p>
              </div>
              <button 
                onClick={() => { setActivePin(""); setText(""); setPin(""); }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all text-sm"
              >
                New Drop
              </button>
            </motion.div>
          )}

          {/* Content Area */}
          <motion.div 
            layout
            className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all duration-300"
          >
            {mode === 'receive' && !activePin ? (
              <div className="p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <DownloadCloud className="w-10 h-10 text-white/50" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Retrieve a Drop</h2>
                <p className="text-white/50 mb-8 max-w-md">Enter the 4-digit PIN to instantly and securely access the pasted content from another device.</p>
                
                <div className="flex gap-4 w-full max-w-sm relative">
                  <input
                    type="text"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.toUpperCase())}
                    placeholder="ENTER PIN"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center text-3xl font-mono font-black text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500 transition-colors uppercase tracking-[0.5em]"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleJoin}
                  disabled={pin.length !== 4}
                  className="mt-6 w-full max-w-sm py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:hover:bg-white flex items-center justify-center gap-2 group"
                >
                  Retrieve Content <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder={mode === 'send' ? "Paste your text, code, or links here..." : "Waiting for content..."}
                  className="w-full h-[50vh] min-h-[400px] bg-transparent p-8 text-xl text-white/90 placeholder:text-white/20 resize-none focus:outline-none font-medium leading-relaxed"
                  readOnly={mode === 'receive'}
                  autoFocus={mode === 'send'}
                />
                
                {text && (
                  <div className="absolute bottom-6 right-6">
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95"
                    >
                      {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>

        </div>
      </main>
    </div>
  );
}

