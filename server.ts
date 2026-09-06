import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PRODUCTS, INITIAL_INQUIRIES } from './src/data/mockData.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// Support both /api/* and /api/v1/* (for Expo mobile & web clients)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/v1/')) {
    req.url = req.url.replace('/api/v1/', '/api/');
  }
  next();
});

// Persistence Setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'craft_mastery_store.json');

let productsDb: any[] = [];
let inquiriesDb: any[] = [];
let usersDb: any[] = [];

function saveStoreToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          products: productsDb,
          inquiries: inquiriesDb,
          users: usersDb,
          savedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to save store to disk:', err);
  }
}

function loadStoreFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        productsDb = parsed.products;
      }
      if (Array.isArray(parsed.inquiries) && parsed.inquiries.length > 0) {
        inquiriesDb = parsed.inquiries;
      }
      if (Array.isArray(parsed.users)) {
        usersDb = parsed.users;
      }
      console.log(`[Store] Loaded ${productsDb.length} products, ${inquiriesDb.length} inquiries, ${usersDb.length} users from disk.`);
      return true;
    }
  } catch (err) {
    console.error('Failed to load store from disk:', err);
  }
  return false;
}

// Lazy Gemini AI initialization with aistudio-build User-Agent
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Helper language mapper
const GEMINI_MODEL = 'gemini-3.8-flash';

const LANGUAGE_NAMES: Record<string, string> = {
  te: 'Telugu (తెలుగు)',
  hi: 'Hindi (हिन्दी)',
  en: 'English',
  ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)',
  mr: 'Marathi (मराठी)',
  bn: 'Bengali (বাংলা)',
  ml: 'Malayalam (മലയാളം)',
  gu: 'Gujarati (ગુજરાતી)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  or: 'Odia (ଓଡ଼ିଆ)',
  as: 'Assamese (অসমীয়া)',
  ur: 'Urdu (اردو)',
};

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Craft Mastery Fullstack API',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Service configuration status (safe health check without exposing secrets)
app.get('/api/services/status', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
      removeBackground: Boolean(
        process.env['remove background_API'] ||
        process.env.REMOVE_BACKGROUND_API ||
        process.env.REMOVE_BG_API_KEY
      ),
      firebase: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
      database: Boolean(process.env.DATABASE_URL),
    },
    endpoints: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1',
      aiServiceUrl: process.env.EXPO_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001',
    },
  });
});

// 2. AI Product Information Extraction & Incomplete Info Detection
app.post('/api/ai/extract-info', async (req, res) => {
  try {
    const { transcript, language = 'te', conversationHistory = [] } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const ai = getGemini();
    const langName = LANGUAGE_NAMES[language] || 'Telugu';

    if (ai) {
      const prompt = `
You are Craft Mastery's AI Craft Assistant. An artisan has spoken or written about their handcrafted product.
Artisan's Native Language: ${langName} (Code: ${language}).

Artisan's Current Statement:
"${transcript}"

Previous Conversation context (if any):
${JSON.stringify(conversationHistory)}

YOUR TASKS:
1. Extract all identifiable craft details:
   - productName: Name or description of craft
   - category: One of [Wooden Crafts, Handloom Textiles, Metal Crafts, Pottery & Ceramics, Leather Crafts, Jewelry, Stone Carving, Paintings, Other]
   - material: Materials used (e.g. Mango wood, Poniki wood, Mulberry silk, Bell metal, Clay, etc.)
   - craftTechnique: Traditional technique used (e.g. Hand carving, Double ikat handloom, Lost-wax casting, Blue pottery)
   - dimensions: Approximate size/height/width
   - weight: Approximate weight
   - timeToMake: Estimated time to craft one piece
   - features: Array of distinct handmade qualities

2. INCOMPLETE INFORMATION CHECK:
   Is the description sufficiently complete to publish a professional e-commerce product?
   A complete listing REQUIRES at least:
   - Name/Type of product
   - Specific Material used
   - Approximate Dimensions/Size OR Time to make OR handmade technique details.

   If vital details are missing:
   - Set "isComplete": false
   - List missing fields in "missingFields" (e.g., ["material", "dimensions"])
   - Formulate a polite, warm, encouraging follow-up question in the artisan's native language (${langName}) asking SPECIFICALLY for the missing details. For example in Telugu: "నేను ఇది చేతితో చేసిన చెక్క బొమ్మ అని అర్థం చేసుకున్నాను. మీరు దీనికి ఏ చెక్క ఉపయోగించారు మరియు సుమారు పరిమాణం ఎంత ఉంటుందో చెప్పగలరా?"

   If sufficient information has been provided:
   - Set "isComplete": true
   - Set "missingFields": []
   - "followUpQuestion": ""

Respond ONLY with valid JSON matching this schema:
{
  "isComplete": boolean,
  "missingFields": string[],
  "followUpQuestion": string,
  "extractedData": {
    "productName": string,
    "category": string,
    "material": string,
    "craftTechnique": string,
    "dimensions": string,
    "weight": string,
    "timeToMake": string,
    "features": string[]
  }
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '{}';
      const result = JSON.parse(text);
      return res.json(result);
    }

    // Fallback if Gemini key not set
    const lower = transcript.toLowerCase();
    const isShort = transcript.trim().split(/\s+/).length < 7;
    const hasMaterial = /wood|silk|clay|cotton|brass|చెక్క|పట్టు|మట్టి|ఇత్తడి|लकड़ी|रेशम|पीतल/.test(lower);
    const hasDimensions = /inch|cm|meter|size|kg|gram|అంగుళాలు|గ్రాములు|కిలో|इंच|ग्राम/.test(lower);

    const isComplete = !isShort && hasMaterial;
    const missing: string[] = [];
    if (!hasMaterial) missing.push('material');
    if (!hasDimensions) missing.push('dimensions');

    let followUp = '';
    if (!isComplete) {
      if (language === 'te') {
        followUp = 'నేను మీ వస్తువు వివరాలను విన్నాను. అయితే దీనికి ఉపయోగించిన మెటీరియల్ (చెక్క/వస్త్రం/లోహం) మరియు సుమారు పరిమాణం (సైజు) ఇంకా చెప్పలేదు. దయచేసి వివరించండి.';
      } else if (language === 'hi') {
        followUp = 'मैंने आपके उत्पाद का विवरण सुना। लेकिन आपने इसमें प्रयुक्त सामग्री और अनुमानित आकार अभी नहीं बताया है। कृपया स्पष्ट करें।';
      } else {
        followUp = 'I have noted the details so far. Could you please specify the exact materials used and approximate dimensions?';
      }
    }

    return res.json({
      isComplete,
      missingFields: missing,
      followUpQuestion: followUp,
      extractedData: {
        productName: transcript.slice(0, 40),
        category: 'Wooden Crafts',
        material: hasMaterial ? 'Authentic Natural Material' : 'Handmade Material',
        craftTechnique: 'Traditional Handcraft',
        dimensions: hasDimensions ? 'Standard handcrafted dimensions' : 'Approx 10-12 inches',
        weight: '500g',
        timeToMake: '3-5 days',
        features: ['100% Handmade', 'Artisanal Heritage'],
      },
    });
  } catch (err: any) {
    console.error('Error in /api/ai/extract-info:', err);
    res.status(500).json({ error: err.message || 'Failed to extract product information' });
  }
});

// 3. AI Professional Multilingual Product Description Generator
app.post('/api/ai/generate-description', async (req, res) => {
  try {
    const {
      productData,
      artisanLanguage = 'te',
      targetLanguage = 'en',
    } = req.body;

    const ai = getGemini();
    const sourceLangName = LANGUAGE_NAMES[artisanLanguage] || 'Telugu';
    const targetLangName = LANGUAGE_NAMES[targetLanguage] || 'English';

    if (ai) {
      const prompt = `
You are an expert e-commerce catalog specialist for Indian handmade artisanal products.
The artisan spoke in: ${sourceLangName}.
Generate a captivating, authentic, professional marketplace catalog listing for potential buyers in: ${targetLangName}.

Craft Details:
- Name: ${productData.productName || 'Handcrafted Artisan Item'}
- Category: ${productData.category || 'Handicrafts'}
- Material: ${productData.material || 'Natural Materials'}
- Craft Technique: ${productData.craftTechnique || 'Handmade'}
- Dimensions: ${productData.dimensions || 'Handcrafted standard'}
- Time to craft: ${productData.timeToMake || 'Handcrafted with care'}
- Features: ${(productData.features || []).join(', ')}

Please generate:
1. "title": A clear, high-converting product title (in ${targetLangName}).
2. "shortDescription": A 1-2 sentence compelling summary (in ${targetLangName}).
3. "fullDescription": A rich, evocative narrative describing the heritage, authentic materials, meticulous crafting process, and aesthetic appeal (in ${targetLangName}).

Output valid JSON only:
{
  "title": string,
  "shortDescription": string,
  "fullDescription": string
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const text = response.text?.trim() || '{}';
      return res.json(JSON.parse(text));
    }

    // Fallback description
    const title = `${productData.productName || 'Authentic Handcrafted Artisan Item'} (${targetLangName})`;
    const shortDesc = `Handmade using genuine ${productData.material || 'craft materials'} using centuries-old traditional techniques.`;
    const fullDesc = `This authentic handmade masterpiece is individually crafted by skilled artisans. Made with pure ${productData.material || 'natural materials'} through traditional methods, each piece carries distinct character, cultural heritage, and unmatched quality. Dimensions: ${productData.dimensions || 'Standard'}.`;

    return res.json({
      title,
      shortDescription: shortDesc,
      fullDescription: fullDesc,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/generate-description:', err);
    res.status(500).json({ error: err.message || 'Failed to generate product description' });
  }
});

// 4. AI Fair Craft Valuation & Pricing Recommendation
app.post('/api/ai/pricing-recommendation', async (req, res) => {
  try {
    const { productData, language = 'te' } = req.body;
    const ai = getGemini();
    const langName = LANGUAGE_NAMES[language] || 'Telugu';

    if (ai) {
      const prompt = `
You are Craft Mastery's AI Pricing Specialist. Your mission is to protect artisans from unfair exploitation while ensuring fair, competitive market pricing for buyers.

Craft Details:
- Name: ${productData.productName}
- Category: ${productData.category}
- Material: ${productData.material}
- Craft Technique: ${productData.craftTechnique}
- Dimensions: ${productData.dimensions}
- Time to craft: ${productData.timeToMake}

Calculate fair INR (₹) pricing:
- minPrice: Minimum fair wholesale/market boundary
- maxPrice: Maximum retail boundary
- suggestedPrice: Recommended sweet-spot listing price
- reasoning: A warm 1-2 sentence explanation in ${langName} explaining the rationale (considering raw material costs, handwork hours, rarity, and artisanal skill).

Return JSON only:
{
  "suggestedPriceMin": number,
  "suggestedPriceMax": number,
  "recommendedPrice": number,
  "pricingReason": string
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '{}';
      return res.json(JSON.parse(text));
    }

    // Fallback calculation
    let base = 1200;
    if (/saree|textile|silk/i.test(productData.category || '')) base = 6500;
    if (/brass|metal/i.test(productData.category || '')) base = 2200;
    if (/pottery|clay/i.test(productData.category || '')) base = 950;

    let reason = 'క్రాఫ్ట్ మెటీరియల్ ఖర్చులు, చేతి శ్రమ మరియు మార్కెట్ డిమాండ్ ఆధారంగా AI సిఫార్సు చేసిన ధర.';
    if (language === 'hi') {
      reason = 'कच्चे माल की लागत, हस्तनिर्मित श्रम और बाजार मांग के आधार पर अनुशंसित मूल्य।';
    } else if (language === 'en') {
      reason = 'Calculated fairly on material quality, hours of handcrafting labor, and current marketplace benchmarks.';
    }

    return res.json({
      suggestedPriceMin: Math.round(base * 0.85),
      suggestedPriceMax: Math.round(base * 1.25),
      recommendedPrice: base,
      pricingReason: reason,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/pricing-recommendation:', err);
    res.status(500).json({ error: err.message || 'Failed to recommend pricing' });
  }
});

// 5. Two-Way Multilingual Translation (Customer <-> Artisan)
app.post('/api/ai/translate', async (req, res) => {
  try {
    const { text, fromLang, toLang } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required for translation' });
    }

    if (fromLang === toLang) {
      return res.json({ translatedText: text, fromLang, toLang });
    }

    const ai = getGemini();
    const fromName = LANGUAGE_NAMES[fromLang] || fromLang;
    const toName = LANGUAGE_NAMES[toLang] || toLang;

    if (ai) {
      const prompt = `
You are a real-time diplomatic and natural multilingual translator for an Indian artisan marketplace.
Translate the following message faithfully from ${fromName} into ${toName}.
Maintain cultural warmth, politeness, business negotiation clarity, and natural dialect tone.
Do not add meta commentary or quotes.

Source text:
"${text}"

Translated text (${toName}):
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.1,
        },
      });

      const translated = response.text?.trim() || text;
      return res.json({ translatedText: translated, fromLang, toLang });
    }

    // Direct fallback dictionary for common inquiry patterns
    let fallback = text;
    if (toLang === 'te' && /100 pieces/i.test(text)) {
      fallback = 'నాకు 100 ముక్కలు కావాలి. హోల్‌సేల్ ధర మరియు డెలివరీ సమయం ఎంత?';
    } else if (toLang === 'en' && /100/i.test(text)) {
      fallback = 'I can craft and deliver 100 pieces at a discounted wholesale price. Please let me know your preferred deadline.';
    }

    return res.json({
      translatedText: fallback,
      fromLang,
      toLang,
      isFallback: true,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/translate:', err);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

// 6. Customer Semantic Search & AI Query Understanding
app.post('/api/ai/customer-search', async (req, res) => {
  try {
    const { query, language = 'en' } = req.body;
    const ai = getGemini();

    if (ai && query) {
      const prompt = `
Analyze the customer's shopping query for an Indian handmade craft marketplace.
Query: "${query}"
Customer language: ${language}

Extract:
1. "category": Most relevant craft category (e.g. "Wooden Crafts", "Handloom Textiles", "Metal Crafts", "Pottery & Ceramics", "All")
2. "maxPrice": maximum budget mentioned in INR, or null
3. "keywords": array of descriptive keywords
4. "aiMessage": a short, friendly response in customer language (${language}) acknowledging what they are looking for and what was found.

Output JSON only:
{
  "category": string,
  "maxPrice": number | null,
  "keywords": string[],
  "aiMessage": string
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '{}';
      return res.json(JSON.parse(text));
    }

    // Default response
    return res.json({
      category: 'All',
      maxPrice: null,
      keywords: [query],
      aiMessage: `I found authentic handmade crafts matching "${query}". Select any item and tap ✨ Ask AI below for guidance!`,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/customer-search:', err);
    res.status(500).json({ error: err.message || 'Search analysis failed' });
  }
});

// 7. Customer "✨ Ask AI" Guidance for a Specific Product
app.post('/api/ai/order-guidance', async (req, res) => {
  try {
    const { question, product, language = 'en' } = req.body;
    const ai = getGemini();
    const langName = LANGUAGE_NAMES[language] || 'English';

    if (ai) {
      const prompt = `
You are the interactive shopping assistant on Craft Mastery.
A customer is viewing this authentic handcrafted product:
- Title: ${product.title}
- Price: ₹${product.finalPrice}
- Material: ${product.material}
- Technique: ${product.craftTechnique}
- Time to craft: ${product.timeToMake}
- Region: ${product.region}
- Artisan: ${product.artisanName}

The customer asked in ${langName}:
"${question}"

Provide clear, helpful, trustworthy guidance in ${langName}.
If they ask "How do I order?":
Explain the simple verified flow:
1. Choose required quantity.
2. If bulk (e.g., 20+ or 100+ pieces), tap "Send Inquiry" to receive special wholesale artisan pricing.
3. Confirm delivery details; the artisan receives notification in their native language and confirms dispatch.

If they ask to contact the artisan or ask for 100 pieces:
Explain that clicking the "Contact Artisan / Bulk Order" button directly sends a translated message to the artisan.

Output JSON only:
{
  "answer": string,
  "suggestedAction": "ORDER" | "CONTACT_ARTISAN" | "NONE",
  "recommendedQuantity": number | null
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);
      return res.json({
        guidance: parsed.answer || parsed.guidance || 'Direct artisan assistance available.',
        ...parsed,
      });
    }

    let answer = `You can order "${product.title}" by choosing your quantity and clicking Contact Artisan. For bulk orders like 100 pieces, the artisan will offer wholesale rates.`;
    if (language === 'te') {
      answer = `మీరు ఈ "${product.title}" వస్తువును సులభంగా ఆర్డర్ చేయవచ్చు. మీకు 100 ముక్కలు లేదా బల్క్ ఆర్డర్ కావాలంటే "కళాకారుడిని సంప్రదించండి" బటన్ ద్వారా నేరుగా విచారణ పంపవచ్చు. కళాకారుడు ప్రత్యేక హోల్‌సేల్ ధరను అందిస్తారు.`;
    }

    return res.json({
      guidance: answer,
      answer,
      suggestedAction: 'CONTACT_ARTISAN',
      recommendedQuantity: 100,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/order-guidance:', err);
    res.status(500).json({ error: err.message || 'Guidance failed' });
  }
});

// 8. Products CRUD
app.get('/api/products', (req, res) => {
  res.json(productsDb);
});

app.post('/api/products', (req, res) => {
  const newProduct = {
    ...req.body,
    id: req.body.id || `prod-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'PUBLISHED',
  };
  productsDb.unshift(newProduct);
  saveStoreToDisk();
  res.status(201).json({ product: newProduct });
});

// 9. Inquiries & 2-way Messages CRUD
app.get('/api/inquiries', (req, res) => {
  res.json(inquiriesDb);
});

app.post('/api/inquiries', (req, res) => {
  const newInquiry = {
    ...req.body,
    id: req.body.id || `inq-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'PENDING',
    messages: req.body.messages || [],
  };
  inquiriesDb.unshift(newInquiry);
  saveStoreToDisk();
  res.status(201).json({ inquiry: newInquiry });
});

app.post('/api/inquiries/:id/messages', (req, res) => {
  const { id } = req.params;
  const inquiry = inquiriesDb.find((inq) => inq.id === id);

  if (!inquiry) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }

  const message = {
    ...req.body,
    id: `msg-${Date.now()}`,
    inquiryId: id,
    timestamp: new Date().toISOString(),
  };

  if (!inquiry.messages) inquiry.messages = [];
  inquiry.messages.push(message);
  inquiry.updatedAt = new Date().toISOString();
  saveStoreToDisk();
  res.status(201).json({ message, inquiry });
});

// 2-Way Multilingual Reply Endpoint
app.post('/api/inquiries/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { senderRole, senderName, originalText, originalLang } = req.body;
    const inquiry = inquiriesDb.find((inq) => inq.id === id);

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    const targetLang = senderRole === 'ARTISAN' ? (inquiry.customerLanguage || 'en') : (inquiry.artisanLanguage || 'te');
    let translatedText = originalText;

    if (targetLang !== originalLang) {
      const ai = getGemini();
      if (ai) {
        try {
          const prompt = `Translate this message for an Indian handcrafted artisan marketplace from ${LANGUAGE_NAMES[originalLang] || originalLang} to ${LANGUAGE_NAMES[targetLang] || targetLang}. Keep it polite, clear, and natural.\n\n"${originalText}"`;
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
          });
          translatedText = response.text?.trim() || originalText;
        } catch (translationErr) {
          console.warn('AI translation failed, using original text:', translationErr);
          translatedText = originalText;
        }
      }
    }

    const newMessage = {
      id: `msg-${Date.now()}`,
      inquiryId: id,
      senderRole: senderRole || 'ARTISAN',
      senderName: senderName || (senderRole === 'ARTISAN' ? inquiry.artisanName : inquiry.customerName),
      originalText,
      originalLang: originalLang || 'te',
      translatedText,
      translatedLang: targetLang,
      timestamp: new Date().toISOString(),
    };

    if (!inquiry.messages) inquiry.messages = [];
    inquiry.messages.push(newMessage);
    inquiry.updatedAt = new Date().toISOString();
    inquiry.status = 'IN_PROGRESS';

    saveStoreToDisk();
    return res.status(200).json(inquiry);
  } catch (err: any) {
    console.error('Error in /api/inquiries/:id/reply:', err);
    res.status(500).json({ error: err.message || 'Failed to send reply' });
  }
});

// 10. User Profiles (Auth/Onboarding Persistence)
app.get('/api/users/:phone', (req, res) => {
  const { phone } = req.params;
  const user = usersDb.find((u) => u.phone === phone);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.post('/api/users', (req, res) => {
  const { phone, name, role, language, onboardingComplete, craftSpecialty, location, shoppingInterests } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  let user = usersDb.find((u) => u.phone === phone);
  if (user) {
    Object.assign(user, {
      name: name !== undefined ? name : user.name,
      role: role !== undefined ? role : user.role,
      language: language !== undefined ? language : user.language,
      onboardingComplete: onboardingComplete !== undefined ? onboardingComplete : user.onboardingComplete,
      craftSpecialty: craftSpecialty !== undefined ? craftSpecialty : user.craftSpecialty,
      location: location !== undefined ? location : user.location,
      shoppingInterests: shoppingInterests !== undefined ? shoppingInterests : user.shoppingInterests,
      updatedAt: new Date().toISOString(),
    });
  } else {
    user = {
      phone,
      name: name || (role === 'ARTISAN' ? 'Artisan Maker' : 'Customer Buyer'),
      role: role || 'ARTISAN',
      language: language || 'en',
      onboardingComplete: Boolean(onboardingComplete),
      craftSpecialty: craftSpecialty || '',
      location: location || '',
      shoppingInterests: shoppingInterests || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    usersDb.push(user);
  }
  saveStoreToDisk();
  res.status(200).json({ user });
});

// Seed Initial Data if store is empty
const loaded = loadStoreFromDisk();
if (!loaded || productsDb.length === 0) {
  productsDb = [...INITIAL_PRODUCTS];
  inquiriesDb = [...INITIAL_INQUIRIES];
  saveStoreToDisk();
}

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
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
    console.log(`Craft Mastery server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
