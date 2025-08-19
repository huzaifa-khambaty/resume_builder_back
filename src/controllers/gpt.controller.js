const logger = require("../config/logger");

// POST /api/test/gpt
// Body: { prompt: string }

const prompt = `
You are a data curator. Return employers for the following positions in Pakistan (ISO2 code: PK):

[
 "Software Engineer",
"DevOps Engineer",
"Data Analyst",
"Cybersecurity Analyst",
"Product Manager",
"QA Engineer",
"Project Manager",
"UX/UI Designer",
"Digital Marketing Specialist",
"Account Executive (Sales)",
"Customer Support Specialist",
"Accountant",
"HR Generalist",
"Supply Chain Analyst",
"Business Analyst",
"Civil Engineer",
"Electrical Engineer",
"Mechanical Engineer",
"Registered Nurse",
"Teacher / Instructor"
]

### Instructions
- Return the response in **strict JSON format** as a JSON array, where each object corresponds to a single position.
- Each position must include up to **25 plausible, mid-size or large employers** that commonly hire for the role in Pakistan.
- Exclude staffing agencies, very small companies, or irrelevant employers.
- Use official **English names** for employers.
- Ensure the response is **neutral, unbiased, and country-appropriate**.
- **Do not include markdown (e.g., \`\`\`json), explanations, or any text outside the JSON structure.**
- The response must strictly adhere to the JSON schema provided below.
- If no website, sector, city, or notes are available, set them to null.

### JSON Schema
{
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "position": { "type": "string" },
      "country_iso2": { "type": "string", "minLength": 2, "maxLength": 2 },
      "employers": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["name", "country_iso2", "confidence"],
          "properties": {
            "name": { "type": "string", "minLength": 2 },
            "website": { "type": "string", "nullable": true },
            "sector": { "type": "string", "nullable": true },
            "country_iso2": { "type": "string", "minLength": 2, "maxLength": 2 },
            "city": { "type": "string", "nullable": true },
            "notes": { "type": "string", "nullable": true },
            "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        }
      },
      "rationale": { "type": "string", "nullable": true }
    },
    "required": ["position", "country_iso2", "employers"]
  }
}
`;

async function testGpt(req, res, next) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "OPENAI_API_KEY is not configured on the server" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that responds with strict JSON only, adhering to the provided schema, with no markdown or additional text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger?.error?.("OpenAI API error", { status: response.status, errText });
      return res.status(502).json({
        error: "Failed to get response from OpenAI",
        details: errText,
      });
    }

    const data = await response.json();
    let message = data?.choices?.[0]?.message?.content || null;

    if (!message) {
      logger?.error?.("No content in OpenAI response", { data });
      return res.status(502).json({ error: "No content returned from OpenAI" });
    }

    // Attempt to clean and parse the response
    let parsedResponse;
    try {
      // Remove markdown code fences if present
      message = message.replace(/```json\n|\n```/g, "").trim();
      parsedResponse = JSON.parse(message);
    } catch (parseError) {
      logger?.error?.("Failed to parse OpenAI response as JSON", {
        message,
        parseError,
      });
      return res.status(502).json({
        error: "OpenAI response is not valid JSON",
        details: message,
      });
    }

    // Basic validation against schema
    if (!Array.isArray(parsedResponse)) {
      logger?.error?.("OpenAI response is not an array", { parsedResponse });
      return res.status(502).json({
        error:
          "OpenAI response does not match expected schema (must be an array)",
        details: message,
      });
    }

    // Validate each item in the array
    for (const item of parsedResponse) {
      if (
        !item.position ||
        !item.country_iso2 ||
        !Array.isArray(item.employers)
      ) {
        logger?.error?.("OpenAI response item does not match schema", { item });
        return res.status(502).json({
          error: "OpenAI response item does not match expected schema",
          details: message,
        });
      }
    }

    return res.json({
      prompt,
      response: parsedResponse,
      raw_response: message,
    });
  } catch (error) {
    logger?.error?.("testGpt route error", { error });
    return next(error);
  }
}

module.exports = { testGpt };
