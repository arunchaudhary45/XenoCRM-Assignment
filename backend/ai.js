import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("💎 Gemini AI initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize Gemini AI:", err.message);
  }
} else {
  console.warn("⚠️  No GEMINI_API_KEY found in .env. Falling back to heuristic mock AI responses!");
}

// Prompt for parsing natural language queries into MongoDB filters
const segmentSystemPrompt = `
You are a database query translator. Your job is to convert natural language descriptions of customer segments into MongoDB JSON query filters.
The Customer collection has these fields:
- name (string)
- email (string)
- phone (string)
- city (string)
- totalSpend (number)
- createdAt (date string)

Translate the natural language query into a valid JSON MongoDB filter object. Do not wrap it in markdown code blocks. Return ONLY the raw JSON string that can be parsed with JSON.parse.

Examples:
Query: "Show customers who spent more than 5000"
Output: {"totalSpend": {"$gt": 5000}}

Query: "Customers from Delhi or Mumbai"
Output: {"city": {"$in": ["Delhi", "Mumbai"]}}

Query: "Customers who spent less than 1000 and live in Pune"
Output: {"totalSpend": {"$lt": 1000}, "city": "Pune"}

Query: "High spenders in Delhi"
Output: {"totalSpend": {"$gte": 5000}, "city": "Delhi"}
`;

export async function parseSegmentQuery(queryText) {
  if (!genAI) {
    // Heuristic mock builder
    console.log(`[Mock AI] Parsing segment query: "${queryText}"`);
    const normalized = queryText.toLowerCase();
    
    // Heuristic matching
    const filter = {};
    
    // Spend matching
    if (normalized.includes("spend")) {
      const match = normalized.match(/(spent|spend|spenders|spending)\s*(more than|over|>|above|>=)\s*(\d+)/i);
      const matchLess = normalized.match(/(spent|spend|spenders|spending)\s*(less than|under|<|below|<=)\s*(\d+)/i);
      if (match) {
        filter.totalSpend = { $gt: parseInt(match[3], 10) };
      } else if (matchLess) {
        filter.totalSpend = { $lt: parseInt(matchLess[3], 10) };
      }
    } else if (normalized.includes(">")) {
      const match = normalized.match(/>\s*(\d+)/);
      if (match) filter.totalSpend = { $gt: parseInt(match[1], 10) };
    } else if (normalized.includes("<")) {
      const match = normalized.match(/<\s*(\d+)/);
      if (match) filter.totalSpend = { $lt: parseInt(match[1], 10) };
    }

    // City matching
    const cities = ["delhi", "mumbai", "bangalore", "pune", "chennai", "kolkata", "hyderabad", "noida", "gurgaon"];
    const foundCities = [];
    for (const c of cities) {
      if (normalized.includes(c)) {
        // Capitalize city
        foundCities.push(c.charAt(0).toUpperCase() + c.slice(1));
      }
    }
    if (foundCities.length === 1) {
      filter.city = foundCities[0];
    } else if (foundCities.length > 1) {
      filter.city = { $in: foundCities };
    }

    return filter;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `${segmentSystemPrompt}\n\nQuery: "${queryText}"\nOutput:`;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Parse the response as JSON (removing any markdown block formatting if present)
    const jsonStr = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("❌ Gemini parsing error, returning empty filter:", err.message);
    return {};
  }
}

// AI Message Copy Generation
export async function generateCampaignMessage(theme, channel) {
  if (!genAI) {
    // Heuristic mock message builder
    console.log(`[Mock AI] Generating message for theme: "${theme}"`);
    const personalized = "Hi {{name}}, ";
    if (theme.toLowerCase().includes("sale") || theme.toLowerCase().includes("discount") || theme.toLowerCase().includes("offer")) {
      return {
        subject: "🎉 Special Discount Just For You!",
        body: `${personalized}Get ready for our major event! Use code XENO20 to enjoy an exclusive 20% off on all products. Shop now at xeno.com!`,
        cta: "Shop Now",
        emojis: "🎉🛍️🔥"
      };
    }
    return {
      subject: "👋 A Special Note For You",
      body: `${personalized}We wanted to reach out and say thank you for being a valued customer. Check out our latest collection today!`,
      cta: "Explore Collection",
      emojis: "❤️✨🎁"
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are a professional marketing copywriter. Create a marketing campaign message for a ${channel} channel based on the theme: "${theme}".
Make sure to include a personalization placeholder {{name}} in the message body, which will be replaced with the customer's name later.
Keep it punchy, engaging, and suitable for the selected channel (${channel}).

Return the output as a valid JSON object. Do not wrap it in markdown code blocks. Return ONLY the raw JSON string.
Schema:
{
  "subject": "Subject line or notification header",
  "body": "The campaign message text containing {{name}}",
  "cta": "Call to action text",
  "emojis": "Recommended emojis"
}
`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const jsonStr = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("❌ Gemini generation error, returning default template:", err.message);
    return {
      subject: "Hello from Xeno!",
      body: "Hi {{name}}, thank you for being our valued customer. Check out our deals today!",
      cta: "Learn More",
      emojis: "🎉"
    };
  }
}

// AI Dashboard Insights & Recommendations
export async function generateDashboardInsights(campaignsData) {
  if (!genAI) {
    // Return heuristic insights
    return {
      insights: [
        "Campaigns sent via WhatsApp show a 24% higher click-through rate compared to SMS.",
        "Your highest converting segment represents customers with total spend exceeding ₹5,000.",
        "Active campaigns on weekends see a 15% increase in open rates compared to weekdays."
      ],
      recommendations: [
        {
          title: "Target Inactive Spenders",
          description: "Create a segment of customers in Delhi who spent > ₹5,000 but haven't ordered recently. Run a 'We Miss You' campaign.",
          suggestedQuery: "Delhi customers who spent more than 5000",
          channel: "WhatsApp"
        },
        {
          title: "Launch a Mid-Week Flash Sale",
          description: "Target all customers with a 15% discount code using Email on Wednesday afternoon.",
          suggestedQuery: "Customers from Mumbai or Pune",
          channel: "Email"
        }
      ]
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are a retail marketing analyst. Analyze the following campaigns data from our CRM and generate smart insights and next-campaign recommendations.
Campaigns Data:
${JSON.stringify(campaignsData, null, 2)}

Provide the response as a JSON object. Do not wrap in markdown code blocks. Return ONLY the raw JSON string.
Schema:
{
  "insights": [
    "Insight statement 1 based on stats",
    "Insight statement 2 based on stats"
  ],
  "recommendations": [
    {
      "title": "Short title of recommended campaign",
      "description": "Thorough description of why and who to target",
      "suggestedQuery": "A search query to type into our natural language builder, e.g. 'spent more than 5000 in Delhi'",
      "channel": "WhatsApp"
    }
  ]
}
`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const jsonStr = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("❌ Gemini insights error, returning static fallback:", err.message);
    return {
      insights: ["Dashboard metrics show consistent delivery rates across all campaign runs."],
      recommendations: [
        {
          title: "High-Value Campaign",
          description: "Target customers with high overall spend.",
          suggestedQuery: "spent more than 5000",
          channel: "WhatsApp"
        }
      ]
    };
  }
}
