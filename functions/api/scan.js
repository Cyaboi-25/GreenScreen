const SYSTEM_PROMPT = `You are an expert lawn care diagnostician and agronomist. You analyze photos of lawns to identify issues and provide detailed restoration plans.

The user may submit multiple photos of the same lawn/property. Treat them as ONE property and produce a single combined diagnosis covering everything you see.

For each issue, mark its location on the most relevant image(s) using normalized coordinates: x is 0 (left) to 1 (right), y is 0 (top) to 1 (bottom). Add as many markers as needed if the issue appears in multiple spots or images. imageIndex is the 0-based index of the photo the user uploaded.

You MUST respond in this exact JSON format and nothing else — no markdown, no backticks, no preamble:

{
  "overallHealth": "number 1-10",
  "grassType": "best guess of grass type based on visual",
  "issues": [
    {
      "name": "Issue name",
      "severity": "mild|moderate|severe",
      "description": "What you see and why it's a problem",
      "affectedArea": "percentage estimate of lawn affected",
      "imageMarkers": [
        {"imageIndex": 0, "x": 0.45, "y": 0.62, "label": "short tag"}
      ]
    }
  ],
  "restorationPlan": [
    {
      "phase": 1,
      "title": "Phase title",
      "timeframe": "e.g. Week 1-2",
      "tasks": [
        {
          "task": "Specific action to take",
          "details": "How to do it, products to use, etc.",
          "priority": "critical|important|recommended"
        }
      ]
    }
  ],
  "quickWins": ["Immediate simple things they can do today"],
  "seasonalNote": "Any seasonal timing advice based on what you see"
}

Be specific with product recommendations, measurements, and timing. If the image is not a lawn or is unclear, return a diagnosis explaining why with overallHealth 0 and an empty plan.`;

function err(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildGeminiPrompt(diagnosis, zipcode) {
  const issues = (diagnosis.issues || [])
    .map((i) => `${i.name} (${i.severity})`)
    .join(", ");
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return `Use Google Search to research lawn care for US ZIP code ${zipcode}.

Existing lawn diagnosis:
- Grass type: ${diagnosis.grassType || "unknown"}
- Issues: ${issues || "none specific"}

Research and return:
1. USDA hardiness zone and current climate conditions for ${zipcode}
2. Region-appropriate product recommendations for the issues above (real brand names sold locally)
3. What to do NOW (it's ${today}) vs what to wait on
4. Local concerns — water restrictions, pesticide regulations, common regional pests/weeds for this area + time of year

Respond ONLY with valid JSON in this exact format, no markdown, no backticks:
{
  "climateZone": "USDA Zone X — brief description",
  "regionalAdvice": "2-3 sentence summary of region-specific guidance",
  "productRecommendations": [
    {"name": "Brand and product name", "use": "What it treats", "where": "Where to buy"}
  ],
  "localConcerns": "Time-of-year and location-specific warnings"
}`;
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_KEY) return err(500, "Server missing ANTHROPIC_KEY");

  let payload;
  try {
    payload = await request.json();
  } catch {
    return err(400, "Invalid JSON body");
  }
  const { images, zipcode } = payload;
  if (!Array.isArray(images) || images.length === 0) {
    return err(400, "No images provided");
  }

  const userText =
    images.length === 1
      ? "Analyze this lawn photo."
      : `Analyze these ${images.length} photos of the same lawn/property.`;
  const zipText = zipcode ? ` The lawn is at US ZIP code ${zipcode}.` : "";

  const claudeBody = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mediaType,
              data: img.base64,
            },
          })),
          {
            type: "text",
            text: `${userText}${zipText} Identify all visible issues (weeds, bare spots, disease, pests, thatch, compaction, discoloration, etc.) with image markers showing where they appear. Provide a detailed phased restoration plan. Respond ONLY with valid JSON, no markdown.`,
          },
        ],
      },
    ],
  };

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(claudeBody),
  });

  const claudeData = await claudeRes.json();
  if (claudeData.error) {
    return err(claudeRes.status, claudeData.error.message || "Claude error");
  }

  const claudeText = (claudeData.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  let diagnosis;
  try {
    diagnosis = JSON.parse(claudeText.replace(/```json|```/g, "").trim());
  } catch (e) {
    return err(500, "Failed to parse Claude response: " + e.message);
  }

  if (zipcode && env.GEMINI_KEY) {
    try {
      const geminiRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_KEY,
          },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: buildGeminiPrompt(diagnosis, zipcode) }] },
            ],
            tools: [{ googleSearch: {} }],
          }),
        }
      );
      const geminiData = await geminiRes.json();
      const candidate = geminiData.candidates?.[0];
      const geminiText = (candidate?.content?.parts || [])
        .map((p) => p.text)
        .filter(Boolean)
        .join("");
      const cleaned = geminiText.replace(/```json|```/g, "").trim();
      const enriched = JSON.parse(cleaned);

      const grounding = candidate?.groundingMetadata;
      if (grounding?.groundingChunks) {
        enriched.sources = grounding.groundingChunks
          .map((c) => c.web?.uri)
          .filter(Boolean)
          .slice(0, 8);
      }
      diagnosis.regionalResearch = enriched;
    } catch (e) {
      diagnosis.regionalResearchError = e.message;
    }
  }

  return new Response(JSON.stringify(diagnosis), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
