// Mock of the BE login API (Postman: INSURTECH / WEBAPI / Oauth2) and the CIAM authorize redirect.
// Runs as a Vercel function (vercel.json sends /v1/* and /ciam/* here) and locally via `npm run mock`.
// Delete once the real BE is ready.
//
// Keeps no memory between requests (Vercel may answer each one from a fresh copy),
// so everything it needs later is packed into the values it hands out.
//
// Test data:
//   OTP code                 1234
//   number ending in 0000    not registered
//   number ending in 1111    no email linked (only the phone choice shows)
//   number starting with 628 Telkomsel shape, anything else IndiHome shape (wrapped in tselID)
import crypto from "node:crypto";

const OTP_CODE = "1234";
const CLIENT_ID = "klop";
const AUTHORIZE_PATH = "/ciam/iam/v1/oauth2/realms/tsel/authorize";
const DEFAULT_MSISDN = "6281234567890";

const pack = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unpack = (text) => {
  try {
    return JSON.parse(Buffer.from(String(text || ""), "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const encrypt = (plainText) => {
  const key = crypto.createHash("sha256").update("mock-insurtech").digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}-${encrypted.toString("hex")}-${cipher.getAuthTag().toString("hex")}`;
};

const formatDate = (date) => date.toISOString().replace("T", " ").slice(0, 19);

const addReference = (masked, msisdn) => ({ masked, referenceID: pack({ masked, msisdn }) });

const send = (res, http, code, message, data = null) => {
  res.writeHead(http, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: { code, message }, timestamp: Date.now(), took: 50, data }));
};
const ok = (res, data) => send(res, 200, "OK00", "SUCCESS", data);

// Reads urlencoded, JSON and multipart/form-data text fields
const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  const type = req.headers["content-type"] || "";
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type);
  if (boundary) {
    const body = {};
    raw.split(`--${boundary[1] || boundary[2]}`).forEach((part) => {
      const field = /name="([^"]+)"\r\n\r\n([\s\S]*)\r\n$/.exec(part);
      if (field) body[field[1]] = field[2];
    });
    return body;
  }
  if (type.includes("application/json")) return raw ? JSON.parse(raw) : {};
  return Object.fromEntries(new URLSearchParams(raw));
};

const checkNumber = (res, body, type) => {
  const number = String(body.number || "").replace(/\D/g, "");
  if (!number) return send(res, 400, "ER01", "Number is required");
  if (number.endsWith("0000")) return send(res, 404, "ER04", "Number not found");

  const isTelkomsel = type === "telkomsel";
  const msisdn = isTelkomsel ? number : DEFAULT_MSISDN;
  const accounts = {
    mobile: [addReference(`+62${msisdn.slice(2, 5)}******${msisdn.slice(-2)}`, msisdn)],
    email: number.endsWith("1111") ? [] : [addReference("exa***mple@gmail.com", msisdn)],
  };
  ok(res, isTelkomsel ? accounts : { tselID: accounts });
};

const routes = {
  "POST /v1/oauth2/check-number/telkomsel": (req, res, body) => checkNumber(res, body, "telkomsel"),
  "POST /v1/oauth2/check-number/indihome": (req, res, body) => checkNumber(res, body, "indihome"),

  "POST /v1/oauth2/otp-request": (req, res, body) => {
    const ref = unpack(body.referenceID);
    if (!ref || ref.masked !== body.masked) return send(res, 400, "ER05", "Invalid reference");
    ok(res, pack({ msisdn: ref.msisdn, exp: Date.now() + 5 * 60_000 }));
  },

  "POST /v1/oauth2/otp-submit": (req, res, body) => {
    const payload = unpack(body.data);
    if (!payload?.msisdn) return send(res, 400, "ER06", "Invalid data");
    if (Date.now() > payload.exp) return send(res, 400, "ER07", "OTP expired");
    if (body.code !== OTP_CODE) return send(res, 400, "ER02", "Invalid OTP");

    const tokenId = pack({ msisdn: payload.msisdn });
    // Stands in for the SSO cookie the BE arranges for the CIAM authorize step
    res.setHeader("Set-Cookie", `iPlanetDirectoryPro=${tokenId}; Path=/; HttpOnly; SameSite=Lax`);
    ok(res, { tokenId, successUrl: "/openam/console", realm: "/sso" });
  },

  "GET /v1/oauth2/otp-session-authorization": (req, res, body, url) => {
    const access = unpack(url.searchParams.get("accessCode"));
    if (!access?.msisdn || Date.now() > access.exp) return send(res, 401, "ER03", "Invalid access code");

    const combined = `${encrypt(access.msisdn)}|${Date.now()}|CIAM-SSO|${crypto.randomUUID()}|id`;
    ok(res, {
      custParam: encrypt(combined),
      expiryDate: formatDate(new Date(Date.now() + 12 * 3600_000)),
    });
  },

  // Fake CIAM: answers with a 302 back to redirect_uri carrying ?code=
  [`* ${AUTHORIZE_PATH}`]: (req, res, body, url) => {
    const params = { ...Object.fromEntries(url.searchParams), ...body };
    if (params.client_id !== CLIENT_ID || !params.redirect_uri) {
      res.writeHead(400);
      return res.end("Bad Request");
    }
    const tokenId = /(?:^|;\s*)iPlanetDirectoryPro=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    const token = unpack(tokenId);
    if (!token) console.warn("[mock ciam] no SSO cookie, issuing a code anyway");

    const code = pack({ msisdn: token?.msisdn || DEFAULT_MSISDN, exp: Date.now() + 5 * 60_000 });
    const target = new URL(params.redirect_uri);
    target.searchParams.set("code", code);
    res.writeHead(302, { Location: target.toString() });
    res.end();
  },
};

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // Echo the origin so the app can send cookies (credentials: "include")
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // otp-request/otp-submit take phoneLoginMobile, phoneLoginIndihome or emailLoginIndihome as the last part
  const path = url.pathname.replace(/^(\/v1\/oauth2\/otp-(?:request|submit))\/\w+$/, "$1");
  const route = routes[`${req.method} ${path}`] || routes[`* ${path}`];
  console.log(req.method, url.pathname + url.search);
  if (!route) return send(res, 404, "ER99", "Not found");

  try {
    await route(req, res, await readBody(req), url);
  } catch (e) {
    console.error(e);
    send(res, 500, "ER98", "Internal Server Error (mock)");
  }
}
