import { NextResponse } from "next/server";
import Groq from "groq-sdk";
const pdf = require("pdf-parse");
import mammoth from "mammoth";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_1 });

const openRouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function parseFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = file.type;
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".txt") || type === "text/plain") {
      return buffer.toString("utf-8");
    } 
    
    if (name.endsWith(".pdf") || type === "application/pdf") {
      const data = await pdf(buffer);
      return data.text;
    } 
    
    if (name.endsWith(".docx") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (name.endsWith(".mp3") || name.endsWith(".wav") || type.startsWith("audio/")) {
      // Use Groq Whisper for audio transcription
      const audioFile = new File([buffer], file.name, { type: file.type });
      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-large-v3",
      });
      return transcription.text;
    }

    throw new Error("Unsupported file type");
  } catch (err: any) {
    console.error("File parsing error:", err);
    throw new Error(`Failed to parse file: ${err.message}`);
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const message = formData.get("message") as string;
    const file = formData.get("file") as File | null;
    const isPro = formData.get("isPro") === "true"; // From client

    let fileContext = "";
    if (file && file.size > 0) {
      const extractedText = await parseFile(file);
      fileContext = `\n\n--- EXTRACTED FILE CONTENT (${file.name}) ---\n${extractedText}\n-----------------------------------\n\n`;
    }

    const fullPrompt = fileContext ? `${fileContext}User Message: ${message}` : message;

    // 3-TIER ROUTING SYSTEM
    try {
      if (isPro) {
        // TIER 3: PAID (Claude 3.5 Sonnet via OpenRouter)
        const result = await streamText({
          model: openRouter.chat("anthropic/claude-3.5-sonnet"),
          messages: [{ role: "user", content: fullPrompt }],
        });
        return result.toDataStreamResponse();
      }

      // TIER 1: FAST FREE (Groq Llama 3)
      try {
        const groqCompletion = await groq.chat.completions.create({
          model: "llama3-8b-8192",
          messages: [{ role: "user", content: fullPrompt }],
          stream: true,
        });

        const stream = new ReadableStream({
          async start(controller) {
            for await (const chunk of groqCompletion) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) controller.enqueue(new TextEncoder().encode(`0:"${content.replace(/"/g, '\\"')}"\n`));
            }
            controller.close();
          }
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });

      } catch (groqError) {
        console.warn("Groq failed, falling back to OpenRouter free tier...", groqError);
        
        // TIER 2: THINK FREE (OpenRouter fallback)
        const result = await streamText({
          model: openRouter.chat("meta-llama/llama-3-8b-instruct:free"),
          messages: [{ role: "user", content: fullPrompt }],
        });
        return result.toDataStreamResponse();
      }

    } catch (routingError: any) {
      return NextResponse.json({ error: routingError.message }, { status: 500 });
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
