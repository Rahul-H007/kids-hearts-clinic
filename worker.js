// Serves the static site and handles the appointment form (POST /api/contact):
// checks the request, verifies Cloudflare Turnstile, then emails the clinic through Resend.
// Secrets (Cloudflare dashboard, never in this public repo): RESEND_API_KEY, TURNSTILE_SECRET.

const CLINIC_EMAIL = "drmanvi@kidsheartsclinic.com";
const FROM = "Kids Heart Clinic Website <website@send.kidsheartsclinic.com>";
const ALLOWED_ORIGINS = ["https://kidsheartsclinic.com", "https://www.kidsheartsclinic.com"];
const VISIT_TYPES = [
  "Initial Consultation & Echo",
  "Newborn Heart Screening / Murmur Check",
  "Second Opinion on Previous Echo",
  "Post-Procedure / Annual Follow-up",
  "Sports Fitness Cardiac Clearance",
];

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// One line of plain text: no control characters, trimmed, capped
const clean = (value, max) =>
  typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "";

async function verifyTurnstile(token, ip, secret) {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

async function handleContact(request, env) {
  if (!ALLOWED_ORIGINS.includes(request.headers.get("origin"))) return json(403, { ok: false });
  if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET) return json(503, { ok: false });

  const ip = request.headers.get("cf-connecting-ip") || "";
  if (env.CONTACT_LIMITER) {
    const { success } = await env.CONTACT_LIMITER.limit({ key: ip || "unknown" });
    if (!success) return json(429, { ok: false });
  }

  const text = await request.text();
  if (text.length > 10000) return json(413, { ok: false });
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return json(400, { ok: false });
  }

  // Hidden field people never see; bots fill it in
  if (clean(data.website, 200)) return json(200, { ok: true });

  const name = clean(data.name, 100);
  const child = clean(data.child, 100);
  const phone = clean(data.phone, 30);
  const type = VISIT_TYPES.includes(data.type) ? data.type : VISIT_TYPES[0];
  const notes = typeof data.notes === "string" ? data.notes.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 2000) : "";
  if (!name || !child || !/^[\d\s+\-()]{8,30}$/.test(phone)) return json(400, { ok: false });

  if (!(await verifyTurnstile(clean(data.turnstileToken, 2048), ip, env.TURNSTILE_SECRET))) {
    return json(403, { ok: false });
  }

  const received = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const body = [
    "New appointment request from kidsheartsclinic.com",
    "",
    `Parent / guardian: ${name}`,
    `Child's name and age: ${child}`,
    `Phone: ${phone}`,
    `Type of visit: ${type}`,
    `Notes: ${notes || "(none)"}`,
    "",
    `Received: ${received} (India time)`,
    "Please call or WhatsApp the parent to fix a time.",
  ].join("\n");

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [CLINIC_EMAIL],
      subject: `Appointment request: ${name} (${type})`,
      text: body,
    }),
  });
  if (!sent.ok) return json(502, { ok: false });
  return json(200, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") return json(405, { ok: false });
      try {
        return await handleContact(request, env);
      } catch {
        return json(500, { ok: false });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
