// k6 load test: users browsing AlugaTools (read-only, no login, no orders, no payments).
//
// Each virtual user repeats a browsing session like a real visitor:
//   1. opens the site (HTML + JS bundle from Vercel) and loads the catalog
//      (GET /api/companies/featured + GET /api/tools?view=list, in parallel, as the app does)
//   2. opens a company page          (GET /api/companies/:id)
//   3. opens a tool page             (GET /api/tools/:id + GET /api/tools/:id/reviews)
// with 2–6 s of "reading time" between actions. Search runs on the device, so it
// makes no request. CEP lookup is left out on purpose: the backend forwards it to a
// free third-party service that could block the server for real users.
//
// Env: SITE_URL, API_URL, VUS (users in this shard), RAMP, HOLD, SHARD.
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const SITE = (__ENV.SITE_URL || "https://aluga-tools.vercel.app").replace(/\/$/, "");
const API = (__ENV.API_URL || "https://alugatools-api.onrender.com").replace(/\/$/, "");
const VUS = Number(__ENV.VUS || 50);

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || "2m", target: VUS },
        { duration: __ENV.HOLD || "3m", target: VUS },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  // Safety: stop if the API is mostly failing (server down), instead of hammering it.
  thresholds: {
    "http_req_failed{kind:api}": [{ threshold: "rate<0.6", abortOnFail: true, delayAbortEval: "90s" }],
  },
  userAgent: "AlugaTools-loadtest/k6",
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// 429 (rate limit) is reported separately, not as a server failure.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429));

const rateLimited = new Counter("rate_limited");
const bodyBytes = new Trend("body_bytes");

const params = (name, kind, responseType = "text") => ({
  tags: { name, kind },
  timeout: "30s",
  responseType,
});

function track(res, name) {
  if (res.status === 429) rateLimited.add(1, { name });
  const len = Number(res.headers["Content-Length"]) || (res.body ? res.body.length : 0);
  if (len) bodyBytes.add(len, { name });
}

function json(res) {
  try {
    return res.json("data") || [];
  } catch (e) {
    return [];
  }
}

const pick = (list) => (list.length ? list[Math.floor(Math.random() * list.length)] : null);
const think = () => sleep(2 + Math.random() * 4);

let bundles = null;

export default function () {
  // 1. Open the site + load the catalog
  const page = http.get(`${SITE}/`, params("GET / (site)", "site"));
  track(page, "GET / (site)");
  check(page, { "site 200": (r) => r.status === 200 });
  if (bundles === null) {
    bundles = [];
    const re = /<script[^>]+src="([^"]+\.js)"/g;
    let m;
    while ((m = re.exec(String(page.body || ""))) && bundles.length < 3) bundles.push(m[1]);
  }
  for (const src of bundles) {
    const url = src.startsWith("http") ? src : `${SITE}${src.startsWith("/") ? "" : "/"}${src}`;
    const res = http.get(url, params("GET bundle.js (site)", "site", "none"));
    track(res, "GET bundle.js (site)");
  }

  const [featured, tools] = http.batch([
    ["GET", `${API}/api/companies/featured`, null, params("GET /api/companies/featured", "api")],
    ["GET", `${API}/api/tools?view=list`, null, params("GET /api/tools (catálogo)", "api")],
  ]);
  track(featured, "GET /api/companies/featured");
  track(tools, "GET /api/tools (catálogo)");
  check(featured, { "featured 200": (r) => r.status === 200 });
  check(tools, { "tools 200": (r) => r.status === 200 });
  const companyList = json(featured);
  const toolList = json(tools);
  think();

  // 2. Company page
  const company = pick(companyList);
  if (company && company.id) {
    const res = http.get(`${API}/api/companies/${company.id}`, params("GET /api/companies/:id", "api"));
    track(res, "GET /api/companies/:id");
    check(res, { "company 200": (r) => r.status === 200 });
    think();
  }

  // 3. Tool page: full tool (description, photos) + reviews, in parallel as the app does
  const tool = pick(toolList);
  if (tool && tool.id) {
    const [detail, reviews] = http.batch([
      ["GET", `${API}/api/tools/${tool.id}`, null, params("GET /api/tools/:id", "api")],
      ["GET", `${API}/api/tools/${tool.id}/reviews`, null, params("GET /api/tools/:id/reviews", "api")],
    ]);
    track(detail, "GET /api/tools/:id");
    track(reviews, "GET /api/tools/:id/reviews");
    check(detail, { "tool 200": (r) => r.status === 200 });
    check(reviews, { "reviews 200": (r) => r.status === 200 });
    think();
  }
}
