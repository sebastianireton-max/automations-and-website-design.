export default async function handler(req, res) {
  // CORS same-origin only by default: no origin header on same-origin fetch.
  // Vercel JSON body is pre-parsed.
  const lead = req.body || {};
  if (!lead.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) {
    res.status(400).json({ ok: false, error: "valid email required" });
    return;
  }
  if (!lead.name) lead.name = "anonymous";

  const payload = {
    name: lead.name,
    email: lead.email,
    archetype: lead.archetype || "unknown",
    archetypeName: lead.archetypeName || "",
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    submittedAt: lead.at || new Date().toISOString(),
    source: "12-builder-types-quiz"
  };

  // Store: append to a JSON blob when BLOB_READ_WRITE_TOKEN exists (Vercel default).
  // ponytail: JSON-blob append store — fine to ~10k leads, swap for a DB when volume justifies it.
  let stored = "logged-only";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put, list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: "quiz-leads.json" });
      let rows = [];
      if (blobs.length) {
        const cur = await fetch(blobs[0].url);
        if (cur.ok) rows = await cur.json();
      }
      rows.push(payload);
      await put("quiz-leads.json", JSON.stringify(rows), {
        access: "public", // private: add token-gated admin route when needed
        addRandomSuffix: false
      });
      stored = "blob";
    } catch (e) {
      console.error("blob store failed:", e);
    }
  }

  console.log("QUIZ_LEAD", JSON.stringify(payload));
  res.status(200).json({ ok: true, stored });
}