export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "POST only" }); return; }

  const body = req.body || {};
  const type = body.type === "lead" ? "lead" : "event";

  // trust boundary: a lead is the only record with PII — validate hard
  if (type === "lead") {
    const d = body.data || {};
    if (!d.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) {
      res.status(400).json({ ok: false, error: "valid email required" });
      return;
    }
    if (!d.name) d.name = "anonymous";
  }

  // server-side enrichment — client can't fake or forget these
  const rec = {
    type,
    sessionId: body.sessionId || null,
    data: body.data || {},
    server: {
      ts: new Date().toISOString(),
      ua: req.headers["user-agent"] || null,
      referer: req.headers["referer"] || null,
      ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null,
      country: req.headers["x-vercel-ip-country"] || null,
      city: req.headers["x-vercel-ip-city"] || null,
      device: req.headers["x-vercel-ip-connection-device-type"] || null
    }
  };

  console.log("QUIZ_" + type.toUpperCase(), JSON.stringify(rec));

  // ponytail: one file per record (blob has no append; read-modify-write races).
  // Swap for a DB when lead volume justifies it. access:'public' + unguessable
  // names; flip to token-gated reads if PII compliance ever demands it.
  let stored = "logged-only";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const dir = type === "lead" ? "leads" : "events";
      await put(`${dir}/${Date.now()}-${crypto.randomUUID()}.json`,
        JSON.stringify(rec), { access: "public", addRandomSuffix: false });
      stored = "blob";
    } catch (e) { console.error("blob store failed:", e); }
  }

  // CRM connection: ONE webhook URL = any CRM/app (Zapier, Make, HubSpot, GHL...).
  // Raw record (full answers, scores, geo, session) POSTed as JSON.
  let crm = "skipped";
  if (type === "lead" && process.env.CRM_WEBHOOK_URL) {
    try {
      const r = await fetch(process.env.CRM_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec)
      });
      crm = r.ok ? "forwarded" : "forward_failed_" + r.status;
    } catch (e) { crm = "forward_error"; console.error("crm forward failed:", e); }
  }

  res.status(200).json({ ok: true, stored, crm });
}