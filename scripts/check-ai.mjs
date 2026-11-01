// Verifies your Gemini key and model end to end, with the same request shape the app uses.
//   GEMINI_API_KEY=... npm run check:ai
const key = process.env.GEMINI_API_KEY?.trim();
if (!key) {
  console.error("Set GEMINI_API_KEY first (https://aistudio.google.com/apikey).");
  process.exit(1);
}
const models = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite,gemini-3.6-flash").split(",").map((m) => m.trim());
const body = JSON.stringify({
  contents: [{ role: "user", parts: [{ text: "Suggest one theme for a 7th birthday party." }] }],
  generationConfig: {
    responseMimeType: "application/json",
    responseJsonSchema: { type: "object", properties: { theme: { type: "string" } }, required: ["theme"] },
    maxOutputTokens: 200,
  },
});
for (const model of models) {
  const started = performance.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body,
  });
  const ms = Math.round(performance.now() - started);
  if (response.ok) {
    const payload = await response.json();
    // eslint-disable-next-line no-console
    console.log(`OK   ${model} (${ms} ms):`, payload.candidates?.[0]?.content?.parts?.[0]?.text);
    process.exit(0);
  }
  // eslint-disable-next-line no-console
  console.log(`FAIL ${model}: HTTP ${response.status} (${ms} ms)`);
}
process.exit(1);
