/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to initialize Gemini SDK on-demand
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Analyze long-form video parameters or outline to produce high-engagement Shorts
app.post('/api/analyze-video', async (req, res) => {
  try {
    const {
      title,
      category,
      duration, // in seconds
      customGuidelines,
      voiceTone,
      transcriptionPrompt,
    } = req.body;

    // Check if the api key exists. If not, trigger fallback simulation so the application never breaks
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing. Running in premium simulated mode.");
      return res.json({
        success: true,
        simulation: true,
        shorts: getSimulatedShorts(title, category, duration, voiceTone),
      });
    }

    const ai = getGeminiClient();

    // Construct detailed prompt for viral short-form algorithm strategy
    const systemPrompt = `You are the lead engineer and algorithm specialist at "VIRAL CUAN DOLAR", the premier AI engine designed to explode long videos into high-converting, 100k+ views shorts clips (for YouTube Shorts, TikTok, Instagram Reels, Facebook Reels). 
Your job is to analyze the user's video metadata and write an exact blueprint for 3 distinct, high-impact shorts.
Each clip must be engineered specifically for viral retention:
1. An powerful hook in the first 5 seconds to maximize click-through and keep the thumb stopping.
2. A high-value density middle section.
3. A compelling loop CTA (Call to Action) that feeds back into the loop or drives massive engagement.

For each short, you must generate:
- Timestamps (start and end within the primary video)
- A highly attractive, catchy viral Title
- A Virality Score (85-99%) based on potential hook strength
- Target views (e.g., 105,000 - 250,000 views)
- Revenue potential in USD (based on typical short CPM multiplier)
- Full high-retention script (written in direct, engaging Indonesian with dynamic accents)
- A synchronized word timing bank for custom subtitle visual highlighting (generating mock word timings)
- Optimized description and hashtags
- Vibe score categorization

You must output valid JSON matching the following schema structure:
Array of objects containing:
{
  "title": "string",
  "start": "number (seconds)",
  "end": "number (seconds)",
  "viralityScore": "number (85-99)",
  "estimatedViews": "number",
  "estimatedRevenue": "number",
  "hook": "string (first 5 seconds text)",
  "ctaText": "string",
  "fullScriptText": "string",
  "subtitles": [
    { "word": "string", "start": "number (relative to segment start, e.g. 0.5)", "end": "number" }
  ],
  "description": "string (multiline, highly optimized with search tags)",
  "tags": ["string"],
  "suggestedMusic": "string (name of music style)",
  "vibes": "one of: hype, serious, mysterious, humorous, educational"
}`;

    const promptMessage = `Analyze this video content and generate 3 exceptional shorts:
- Video Title: "${title || 'Miliarder Sukses'}"
- Category: "${category || 'Financial & Productivity'}"
- Video Duration: ${duration || 600} seconds
- Voice Tone Style: "${voiceTone || 'hype'}"
- Audio/Speech Context Overview: "${transcriptionPrompt || 'Membahas cara cepat mendapatkan dollar lewat internet, tips rahasia algoritma views, serta taktik memenangkan persaingan content creator.'}"
- Custom Directives: "${customGuidelines || 'Utamakan kalimat penarik perhatian di awal (hook) dan penutup yang bersambung atau memberi rasa penasaran tinggi.'}"

Ensure the subtitle words are timed sequentially relative to the segment start (from 0 seconds to segment duration, which is end - start), with ~2 to 5 words per second. Keep scripts in highly engaging Indonesian with modern expressions (use terms like "Cuan", "Dollar", "Bongkar Rahasia", "Algoritma", "Views", "Miliarder"). Make sure the JSON output is complete and fully matches the requested schema structure.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptMessage,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              viralityScore: { type: Type.NUMBER },
              estimatedViews: { type: Type.NUMBER },
              estimatedRevenue: { type: Type.NUMBER },
              hook: { type: Type.STRING },
              ctaText: { type: Type.STRING },
              fullScriptText: { type: Type.STRING },
              subtitles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    start: { type: Type.NUMBER },
                    end: { type: Type.NUMBER }
                  },
                  required: ['word', 'start', 'end']
                }
              },
              description: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              suggestedMusic: { type: Type.STRING },
              vibes: { type: Type.STRING }
            },
            required: [
              'title', 'start', 'end', 'viralityScore', 'estimatedViews',
              'estimatedRevenue', 'hook', 'ctaText', 'fullScriptText', 'subtitles',
              'description', 'tags', 'suggestedMusic', 'vibes'
            ]
          }
        }
      }
    });

    const outputJsonString = response.text || "[]";
    const shorts = JSON.parse(outputJsonString.trim());

    res.json({
      success: true,
      simulation: false,
      shorts,
    });
  } catch (error: any) {
    console.error('Core Gemini Analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze video via AI.',
      error: error.message,
      // Provide simulated fallback to prevent app crashing for user in UI
      shorts: getSimulatedShorts(req.body.title, req.body.category, req.body.duration, req.body.voiceTone)
    });
  }
});

// Setup fallback simulated shorts data generator
function getSimulatedShorts(title: string, category: string, totalDuration: number, voiceTone: string) {
  const selectedTitle = title || "Kunci Sukses Dollar";
  const selectedCategory = category || "Business & Wealth";
  
  // Custom templates based on category to make simulation highly engaging and descriptive
  const presets: any = {
    business: [
      {
        title: "🔥 RAHASIA $10,000 SEBULAN TANPA MODAL!",
        start: 12,
        end: 48,
        viralityScore: 97,
        estimatedViews: 142000,
        estimatedRevenue: 430,
        hook: "Banyak orang mikir harus punya modal besar buat dapetin dolar,",
        ctaText: "KLIK LINK DI BIO SEKARANG JUGA!",
        fullScriptText: "Banyak orang mikir harus punya modal besar buat dapetin dolar, tapi aslinya NOL RUPIAH pun bisa! Caranya pasang AI automation di client luar negeri. Mereka bayar mahal karena malas bikin sendiri. Kerjanya cuma 15 menit, cuan melimpah tiap hari langsung masuk rekening tanpa pusing kepala! Kamu mau dibongkar caranya gratis?",
        subtitles: [
          { word: "Banyak", start: 0.1, end: 0.5 },
          { word: "orang", start: 0.6, end: 1.0 },
          { word: "mikir", start: 1.1, end: 1.5 },
          { word: "harus", start: 1.6, end: 2.0 },
          { word: "punya", start: 2.1, end: 2.4 },
          { word: "modal", start: 2.5, end: 2.9 },
          { word: "besar", start: 3.0, end: 3.4 },
          { word: "buat", start: 3.5, end: 3.8 },
          { word: "dapetin", start: 3.9, end: 4.3 },
          { word: "dolar,", start: 4.4, end: 5.0 },
          { word: "tapi", start: 5.1, end: 5.4 },
          { word: "aslinya", start: 5.5, end: 6.0 },
          { word: "NOL", start: 6.1, end: 6.5 },
          { word: "RUPIAH", start: 6.6, end: 7.2 },
          { word: "pun", start: 7.3, end: 7.6 },
          { word: "bisa!", start: 7.7, end: 8.2 },
          { word: "Caranya", start: 8.3, end: 8.9 },
          { word: "pasang", start: 9.0, end: 9.4 },
          { word: "AI", start: 9.5, end: 9.8 },
          { word: "automation", start: 9.9, end: 10.6 },
          { word: "di", start: 10.7, end: 10.9 },
          { word: "client", start: 11.0, end: 11.4 },
          { word: "luar", start: 11.5, end: 11.8 },
          { word: "negeri.", start: 11.9, end: 12.5 },
          { word: "Mereka", start: 12.6, end: 13.0 },
          { word: "bayar", start: 13.1, end: 13.5 },
          { word: "mahal", start: 13.6, end: 14.1 },
          { word: "karena", start: 14.2, end: 14.5 },
          { word: "malas", start: 14.6, end: 15.0 },
          { word: "bikin", start: 15.1, end: 15.4 },
          { word: "sendiri.", start: 15.5, end: 16.0 },
          { word: "Kerjanya", start: 16.1, end: 16.6 },
          { word: "cuma", start: 16.7, end: 17.0 },
          { word: "15", start: 17.1, end: 17.5 },
          { word: "menit,", start: 17.6, end: 18.2 },
          { word: "cuan", start: 18.3, end: 18.7 },
          { word: "melimpah", start: 18.8, end: 19.3 },
          { word: "tiap", start: 19.4, end: 19.7 },
          { word: "hari", start: 19.8, end: 20.2 },
          { word: "langsung", start: 20.3, end: 20.7 },
          { word: "masuk", start: 20.8, end: 21.2 },
          { word: "rekening!", start: 21.3, end: 22.0 },
          { word: "Kamu", start: 22.1, end: 22.5 },
          { word: "mau", start: 22.6, end: 22.9 },
          { word: "dibongkar", start: 23.0, end: 23.6 },
          { word: "caranya", start: 23.7, end: 24.1 },
          { word: "gratis?", start: 24.2, end: 25.0 }
        ],
        description: `Bongkar rahasia cuan mengalir deras pakai AI automation dari rumah! 🤑💻\n\nNonton video ini sampai habis dan temukan formula tercepat bikin passive income modal internet doang.\n\n#cuanonline #passiveincome #bisnisdigital #aikomunitas #tipssukses #kerjaonline`,
        tags: ["cuan online", "ide bisnis", "kerja dari rumah", "ai automation", "dollar internet"],
        suggestedMusic: "Epic Phonk Beat Trend",
        vibes: "hype"
      },
      {
        title: "🧠 Pola Pikir Miliarder Yang Bikin Uang nge-Kejar Kamu!",
        start: 110,
        end: 142,
        viralityScore: 94,
        estimatedViews: 118000,
        estimatedRevenue: 285,
        hook: "Miliarder itu gak pernah ngejar uang fisik, kawan.",
        ctaText: "IKUTI AKUN INI SEBELUM NYESEL!",
        fullScriptText: "Miliarder itu gak pernah ngejar uang fisik, kawan. Uang itu cuma bayangan dari nilai yang kamu berikan ke pasar. Fokus perbaiki skill, pecahkan masalah terbesar di sekitarmu, maka aliran dolar akan mengalir terus tiada henti mendatangi rekeningmu. Mulai hari ini, setop jadi budak uang, mulailah jadi magnet uang!",
        subtitles: [
          { word: "Miliarder", start: 0.1, end: 0.6 },
          { word: "itu", start: 0.7, end: 1.0 },
          { word: "gak", start: 1.1, end: 1.3 },
          { word: "pernah", start: 1.4, end: 1.7 },
          { word: "ngejar", start: 1.8, end: 2.2 },
          { word: "uang", start: 2.3, end: 2.6 },
          { word: "fisik,", start: 2.7, end: 3.1 },
          { word: "kawan.", start: 3.2, end: 3.8 },
          { word: "Uang", start: 3.9, end: 4.2 },
          { word: "itu", start: 4.3, end: 4.5 },
          { word: "cuma", start: 4.6, end: 4.9 },
          { word: "bayangan", start: 5.0, end: 5.6 },
          { word: "dari", start: 5.7, end: 6.0 },
          { word: "nilai", start: 6.1, end: 6.5 },
          { word: "yang", start: 6.6, end: 6.8 },
          { word: "kamu", start: 6.9, end: 7.2 },
          { word: "berikan", start: 7.3, end: 7.8 },
          { word: "ke", start: 7.9, end: 8.1 },
          { word: "pasar.", start: 8.2, end: 8.8 },
          { word: "Fokus", start: 8.9, end: 9.3 },
          { word: "perbaiki", start: 9.4, end: 9.9 },
          { word: "skill,", start: 10.0, end: 10.5 },
          { word: "pecahkan", start: 10.6, end: 11.2 },
          { word: "masalah", start: 11.3, end: 11.7 },
          { word: "terbesar", start: 11.8, end: 12.3 },
          { word: "di", start: 12.4, end: 12.6 },
          { word: "sekitarmu,", start: 12.7, end: 13.5 },
          { word: "maka", start: 13.6, end: 14.0 },
          { word: "aliran", start: 14.1, end: 14.5 },
          { word: "dolar", start: 14.6, end: 15.0 },
          { word: "akan", start: 15.1, end: 15.4 },
          { word: "mengalir", start: 15.5, end: 16.0 },
          { word: "terus", start: 16.1, end: 16.4 },
          { word: "tiada", start: 16.5, end: 16.9 },
          { word: "henti.", start: 17.0, end: 17.5 }
        ],
        description: `Cara melatih mindset orang terkaya sedunia biar dikejar duit! Buka kunci kekayaan lewat nilai pasar. 🚀🧠\n\n#mentalitassukses #mindsetmiliarder #motivasibisnis #suksesfinansial #pesanbijak #suksesmuda`,
        tags: ["mindset orang kaya", "motivasi sukses", "kunci kaya", "magnet uang", "miliarder muda"],
        suggestedMusic: "Cinematic Dark Ambient Deep Piano",
        vibes: "serious"
      }
    ],
    default: [
      {
        title: "⚡ Kloning Suaramu Jadi Dollar Pakai Trik AI Ini!",
        start: 5,
        end: 42,
        viralityScore: 96,
        estimatedViews: 155000,
        estimatedRevenue: 380,
        hook: "Stop rekam suaramu berulang-ulang buat bikin konten!",
        ctaText: "BURUAN SHARE KE TEMEN LU!",
        fullScriptText: "Stop rekam suaramu berulang-ulang buat bikin konten! Sekarang, ada AI gratis yang bisa kloning suaramu cuma dalam 10 detik. Hasilnya super jernih dan natural, bisa ngomong bahasa asing pula! Kloning suaramu sekali, lalu bikin ratusan reels bersponsorship dollar otomatis pas kamu lagi tidur nyenyak. Dahsyat kan?",
        subtitles: [
          { word: "Stop", start: 0.1, end: 0.5 },
          { word: "rekam", start: 0.6, end: 0.9 },
          { word: "suaramu", start: 1.0, end: 1.5 },
          { word: "berulang-ulang", start: 1.6, end: 2.4 },
          { word: "buat", start: 2.5, end: 2.8 },
          { word: "bikin", start: 2.9, end: 3.2 },
          { word: "konten!", start: 3.3, end: 3.9 },
          { word: "Sekarang,", start: 4.0, end: 4.6 },
          { word: "ada", start: 4.7, end: 5.0 },
          { word: "AI", start: 5.1, end: 5.4 },
          { word: "gratis", start: 5.5, end: 6.0 },
          { word: "yang", start: 6.1, end: 6.3 },
          { word: "bisa", start: 6.4, end: 6.7 },
          { word: "kloning", start: 6.8, end: 7.2 },
          { word: "suaramu", start: 7.3, end: 7.8 },
          { word: "cuma", start: 7.9, end: 8.2 },
          { word: "dalam", start: 8.3, end: 8.6 },
          { word: "10", start: 8.7, end: 9.1 },
          { word: "detik.", start: 9.2, end: 9.8 },
          { word: "Hasilnya", start: 9.9, end: 10.5 },
          { word: "super", start: 10.6, end: 11.0 },
          { word: "jernih", start: 11.1, end: 11.6 },
          { word: "dan", start: 11.7, end: 11.9 },
          { word: "natural!", start: 12.0, end: 12.6 }
        ],
        description: `Trik rahasia kloning suara pakai teknologi AI tercanggih gratis buat melipatgandakan video shorts dollar mu! 🎙️💸\n\nTonton tutorialnya dan amankan spot masa depanmu.\n\n#teknologiai #aicontent #suaraai #voiceclone #digitalmarketing #rahasiacuan`,
        tags: ["voice cloning", "kecerdasan buatan", "konten otomatis", "aplikasi ai", "cari dolar online"],
        suggestedMusic: "Upbeat Corporate Electro Beats",
        vibes: "hype"
      },
      {
        title: "🧠 Pola Viral 100K Views Rahasia Konten Kreator!",
        start: 75,
        end: 115,
        viralityScore: 92,
        estimatedViews: 108000,
        estimatedRevenue: 245,
        hook: "Mengapa video jelek tapi viewernya jutaan?",
        ctaText: "COBAIN DAN LIHAT HASILNYA SEKARANG!",
        fullScriptText: "Mengapa video jelek tapi viewernya jutaan? Jawabannya ada pada retensi 3 detik pertama! Algoritma platform short cuma menilai apakah penonton langsung scroll atau nunggu sebentar. Makanya, taruh hook kontroversial atau pertanyaan membingungkan langsung di awal video. Cobain resep ini dan rasakan banjiran views di akunmu!",
        subtitles: [
          { word: "Mengapa", start: 0.1, end: 0.5 },
          { word: "video", start: 0.6, end: 0.9 },
          { word: "jelek", start: 1.0, end: 1.4 },
          { word: "tapi", start: 1.5, end: 1.8 },
          { word: "viewernya", start: 1.9, end: 2.3 },
          { word: "jutaan?", start: 2.4, end: 3.1 },
          { word: "Jawabannya", start: 3.2, end: 3.9 },
          { word: "ada", start: 4.0, end: 4.3 },
          { word: "pada", start: 4.4, end: 4.7 },
          { word: "retensi", start: 4.8, end: 5.3 },
          { word: "3", start: 5.4, end: 5.7 },
          { word: "detik", start: 5.8, end: 6.1 },
          { word: "pertama!", start: 6.2, end: 6.8 }
        ],
        description: `Membedah pola kesuksesan algoritma 100K views shorts. Kunci rahasianya cuma retensi 3 detik pertama! 🤯📈\n\n#rahasiatiktok #algoritmashorts #reelsmarketing #creatorgrowth #desainkonten`,
        tags: ["trik viral", "algoritma youtube shorts", "retensi penonton", "tips konten", "trik algoritma"],
        suggestedMusic: "Cyberpunk Industrial Darkwave Synth",
        vibes: "educational"
      }
    ]
  };

  const matchedCategory = category === 'financial' || category === 'business' ? 'business' : 'default';
  const customList = presets[matchedCategory];

  // Map to adjust start times a bit to match calculated length
  return customList.map((item: any, idx: number) => {
    return {
      id: `compiled_short_${idx + 1}_${Date.now()}`,
      title: item.title.replace("Kunci Sukses Dollar", selectedTitle),
      start: item.start,
      end: item.end,
      duration: item.end - item.start,
      viralityScore: item.viralityScore,
      estimatedViews: item.estimatedViews,
      estimatedRevenue: item.estimatedRevenue,
      hook: item.hook,
      ctaText: item.ctaText,
      fullScriptText: item.fullScriptText,
      subtitles: item.subtitles,
      description: item.description,
      tags: item.tags,
      suggestedMusic: item.suggestedMusic,
      vibes: item.vibes
    };
  });
}

// Vite and static production assets pipeline setup
async function startServer() {
  // Integrate Vite dynamically for dev, or compile resources
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIRAL CUAN DOLAR Express server boot successfully on port ${PORT}`);
  });
}

startServer();
