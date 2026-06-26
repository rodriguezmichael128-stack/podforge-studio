const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const root = __dirname;
loadEnv(path.join(root, ".env"));

const port = Number(process.env.PORT || 4175);
const host = process.env.HOST || "127.0.0.1";
const baseUrl = process.env.PUBLIC_BASE_URL || `http://${host}:${port}`;
const feedbackFile = path.join(root, "data", "feedback.json");
const adminDataFile = path.join(root, "data", "admin-store.json");
const adminPath = process.env.ADMIN_PATH || "/admin";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const adminLoginRequired = process.env.ADMIN_LOGIN_REQUIRED !== "false";
const adminSessionHours = Number(process.env.ADMIN_SESSION_HOURS || 12);
const adminSessions = new Map();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const liveChargesEnabled = process.env.PODFORGE_ENABLE_LIVE_CHARGES === "true";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".svg": "image/svg+xml",
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator === -1) return;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        if (separator === -1) return [cookie, ""];
        return [decodeURIComponent(cookie.slice(0, separator)), decodeURIComponent(cookie.slice(separator + 1))];
      }),
  );
}

function setCookie(response, name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  parts.push(`Max-Age=${options.maxAge || adminSessionHours * 60 * 60}`);
  parts.push("HttpOnly");
  parts.push("SameSite=Lax");
  response.setHeader("Set-Cookie", parts.join("; "));
}

function clearCookie(response, name) {
  response.setHeader("Set-Cookie", `${encodeURIComponent(name)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createAdminSession(response) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + adminSessionHours * 60 * 60 * 1000;
  adminSessions.set(token, expiresAt);
  setCookie(response, "podforge_admin", token, { maxAge: adminSessionHours * 60 * 60 });
  return { token, expiresAt };
}

function isAdminRequest(request) {
  if (!adminLoginRequired) return true;
  const token = parseCookies(request).podforge_admin;
  if (!token) return false;
  const expiresAt = adminSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(request) {
  if (!adminLoginRequired) return;
  if (isAdminRequest(request)) return;
  const error = new Error("Admin login required.");
  error.statusCode = 401;
  throw error;
}

function readFeedbackItems() {
  try {
    const items = JSON.parse(fs.readFileSync(feedbackFile, "utf8"));
    return Array.isArray(items) ? items : [];
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Feedback read failed: ${error.message}`);
    return [];
  }
}

function writeFeedbackItems(items) {
  fs.mkdirSync(path.dirname(feedbackFile), { recursive: true });
  fs.writeFileSync(feedbackFile, JSON.stringify(items, null, 2));
}

function normalizeFeedback(payload, request) {
  const note = String(payload.note || "").trim();
  if (note.length < 4) {
    const error = new Error("Add a little more detail before submitting.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  return {
    id: crypto.randomUUID(),
    page: String(payload.page || "pipeline").slice(0, 40),
    type: String(payload.type || "Idea").slice(0, 40),
    note: note.slice(0, 1200),
    contact: String(payload.contact || "").trim().slice(0, 160),
    createdAt: now.toISOString(),
    timeLabel: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    source: "shared-test-link",
    testerIp: request.socket.remoteAddress || "",
  };
}

const adminAnalyticsSeed = {
  users: [
    {
      id: "creator-michael",
      fullName: "Michael Rodriguez",
      phone: "(555) 014-8128",
      email: "rodriguezmichael128@gmail.com",
      status: "Active",
      plan: "Founder",
      role: "Creator",
      joinedAt: "2026-05-20T14:15:00.000Z",
      lastActiveAt: "2026-05-23T17:28:00.000Z",
      termsAcceptedAt: "2026-05-20T14:16:00.000Z",
      billingMandate: "Active",
      revenueSharePercent: 10,
      linkedPlatforms: ["YouTube", "Spotify", "Apple Podcasts", "Patreon"],
      uploads: 13,
      grossRevenue: 3180,
      podforgeFee: 318,
      risk: "Low",
      adminNote: "Owner test account and launch workflow reference.",
    },
    {
      id: "creator-maya",
      fullName: "Maya Chen",
      phone: "(555) 019-4412",
      email: "maya@creator.test",
      status: "Active",
      plan: "Pro",
      role: "Creator",
      joinedAt: "2026-05-12T13:30:00.000Z",
      lastActiveAt: "2026-05-23T17:22:00.000Z",
      termsAcceptedAt: "2026-05-12T13:31:00.000Z",
      billingMandate: "Active",
      revenueSharePercent: 10,
      linkedPlatforms: ["YouTube", "Spotify", "TikTok"],
      uploads: 18,
      grossRevenue: 2240,
      podforgeFee: 224,
      risk: "Low",
      adminNote: "Strong video podcast usage.",
    },
    {
      id: "creator-ari",
      fullName: "Ari Rivera",
      phone: "(555) 018-2033",
      email: "ari@creator.test",
      status: "Active",
      plan: "Studio",
      role: "Creator",
      joinedAt: "2026-05-09T09:40:00.000Z",
      lastActiveAt: "2026-05-23T16:03:00.000Z",
      termsAcceptedAt: "2026-05-09T09:42:00.000Z",
      billingMandate: "Active",
      revenueSharePercent: 10,
      linkedPlatforms: ["YouTube", "Spotify", "PodForge Sponsorships"],
      uploads: 9,
      grossRevenue: 680,
      podforgeFee: 68,
      risk: "Low",
      adminNote: "Native sponsorship collection working.",
    },
    {
      id: "creator-jordan",
      fullName: "Jordan Lee",
      phone: "(555) 015-7810",
      email: "jordan@creator.test",
      status: "Past due",
      plan: "Pro",
      role: "Creator",
      joinedAt: "2026-05-15T18:04:00.000Z",
      lastActiveAt: "2026-05-22T21:20:00.000Z",
      termsAcceptedAt: "2026-05-15T18:06:00.000Z",
      billingMandate: "Retry needed",
      revenueSharePercent: 10,
      linkedPlatforms: ["TikTok", "YouTube"],
      uploads: 7,
      grossRevenue: 410,
      podforgeFee: 41,
      risk: "High",
      adminNote: "Payment retry needed for TikTok rewards collection.",
    },
    {
      id: "creator-nina",
      fullName: "Nina Patel",
      phone: "(555) 016-9240",
      email: "nina@creator.test",
      status: "Review",
      plan: "Starter",
      role: "Creator",
      joinedAt: "2026-05-18T11:22:00.000Z",
      lastActiveAt: "2026-05-22T19:14:00.000Z",
      termsAcceptedAt: "2026-05-18T11:24:00.000Z",
      billingMandate: "Pending report",
      revenueSharePercent: 10,
      linkedPlatforms: ["Patreon", "Spotify"],
      uploads: 4,
      grossRevenue: 0,
      podforgeFee: 0,
      risk: "Medium",
      adminNote: "Waiting on Apple statement import before collection.",
    },
  ],
  creators: {
    total: 124,
    active: 38,
    trials: 17,
    termsAccepted: 124,
    mandatesActive: 29,
  },
  operations: {
    storageUsed: "218 GB",
    processingJobs: 7,
    failedJobs: 1,
    averageEditTime: "18 min",
    uptime: "99.9%",
    openSupportItems: 6,
  },
  platforms: [
    {
      id: "youtube",
      name: "YouTube",
      status: "Connected",
      connectedAccounts: 42,
      activeUploads: 18,
      grossRevenue: 8420,
      podforgeFee: 842,
      audience: "128K views",
      syncHealth: 98,
      lastSync: "Today, 10:18 AM",
    },
    {
      id: "spotify",
      name: "Spotify",
      status: "Connected",
      connectedAccounts: 33,
      activeUploads: 21,
      grossRevenue: 3910,
      podforgeFee: 391,
      audience: "41K streams",
      syncHealth: 91,
      lastSync: "Today, 9:40 AM",
    },
    {
      id: "tiktok",
      name: "TikTok",
      status: "Partial",
      connectedAccounts: 12,
      activeUploads: 9,
      grossRevenue: 1260,
      podforgeFee: 126,
      audience: "314K views",
      syncHealth: 72,
      lastSync: "Yesterday, 6:12 PM",
    },
    {
      id: "apple",
      name: "Apple Podcasts",
      status: "Statement pending",
      connectedAccounts: 7,
      activeUploads: 5,
      grossRevenue: 980,
      podforgeFee: 98,
      audience: "12K listens",
      syncHealth: 68,
      lastSync: "May 21, 2026",
    },
    {
      id: "patreon",
      name: "Patreon",
      status: "Connected",
      connectedAccounts: 4,
      activeUploads: 3,
      grossRevenue: 2140,
      podforgeFee: 214,
      audience: "312 paid members",
      syncHealth: 88,
      lastSync: "Today, 8:02 AM",
    },
    {
      id: "podforge-sponsorships",
      name: "PodForge Sponsorships",
      status: "Native",
      connectedAccounts: 9,
      activeUploads: 6,
      grossRevenue: 3650,
      podforgeFee: 365,
      audience: "9 active deals",
      syncHealth: 100,
      lastSync: "Live",
    },
  ],
  uploads: [
    {
      id: "up-1029",
      title: "Audience Q&A: Better Episodes",
      creator: "Maya Chen",
      format: "Video podcast",
      source: "Browser recording",
      uploadedAt: "2026-05-23T17:18:00.000Z",
      duration: "48:12",
      size: "2.4 GB",
      status: "Auto-editing",
      platforms: ["YouTube", "Spotify", "TikTok"],
    },
    {
      id: "up-1028",
      title: "How Indie Shows Get Sponsors",
      creator: "Michael Rodriguez",
      format: "Audio only",
      source: "Imported WAV",
      uploadedAt: "2026-05-23T16:42:00.000Z",
      duration: "36:44",
      size: "418 MB",
      status: "Ready to publish",
      platforms: ["Spotify", "Apple Podcasts", "Patreon"],
    },
    {
      id: "up-1027",
      title: "The New Creator Economy",
      creator: "Ari Rivera",
      format: "Video podcast",
      source: "Live archive",
      uploadedAt: "2026-05-23T15:35:00.000Z",
      duration: "54:08",
      size: "3.1 GB",
      status: "Published",
      platforms: ["YouTube", "Spotify", "PodForge Sponsorships"],
    },
    {
      id: "up-1026",
      title: "Solo Clip Pack: Growth Hooks",
      creator: "Jordan Lee",
      format: "Short clips",
      source: "Auto clip export",
      uploadedAt: "2026-05-22T21:15:00.000Z",
      duration: "08:30",
      size: "612 MB",
      status: "Queued",
      platforms: ["TikTok", "YouTube"],
    },
    {
      id: "up-1025",
      title: "Subscriber Bonus: Founder Notes",
      creator: "Nina Patel",
      format: "Audio only",
      source: "Remote guest room",
      uploadedAt: "2026-05-22T19:04:00.000Z",
      duration: "28:19",
      size: "236 MB",
      status: "Needs review",
      platforms: ["Patreon", "Spotify"],
    },
  ],
  collections: [
    {
      id: "col-2040",
      platform: "YouTube",
      creator: "Maya Chen",
      period: "May 1-15, 2026",
      gross: 2240,
      fee: 224,
      dueDate: "2026-05-24",
      status: "Scheduled",
      method: "ACH debit mandate",
      nextAction: "Auto-collect after statement lock",
    },
    {
      id: "col-2039",
      platform: "Spotify",
      creator: "Michael Rodriguez",
      period: "April 2026",
      gross: 920,
      fee: 92,
      dueDate: "2026-05-25",
      status: "Due soon",
      method: "Card on file",
      nextAction: "Charge after payout statement import",
    },
    {
      id: "col-2038",
      platform: "PodForge Sponsorships",
      creator: "Ari Rivera",
      period: "Creator Economy sponsor read",
      gross: 680,
      fee: 68,
      dueDate: "2026-05-23",
      status: "Collected",
      method: "Deducted at source",
      nextAction: "Creator payout queued",
    },
    {
      id: "col-2037",
      platform: "TikTok",
      creator: "Jordan Lee",
      period: "May creator rewards",
      gross: 410,
      fee: 41,
      dueDate: "2026-05-20",
      status: "Overdue",
      method: "ACH debit mandate",
      nextAction: "Retry payment and notify creator",
    },
    {
      id: "col-2036",
      platform: "Apple Podcasts",
      creator: "Nina Patel",
      period: "April 2026",
      gross: 0,
      fee: 0,
      dueDate: "2026-05-28",
      status: "Awaiting statement",
      method: "Pending report",
      nextAction: "Import financial report",
    },
  ],
  alerts: [
    {
      severity: "High",
      title: "TikTok collection overdue",
      detail: "Jordan Lee has a $41 fee due from the May creator rewards report.",
      owner: "Revenue ops",
    },
    {
      severity: "Medium",
      title: "Apple statement missing",
      detail: "Nina Patel needs an April Apple Podcasts financial report imported before collection.",
      owner: "Platform ops",
    },
    {
      severity: "Medium",
      title: "One auto-edit job failed",
      detail: "Clip export failed during caption burn-in and is ready for retry.",
      owner: "Production ops",
    },
  ],
  audienceHeatmap: {
    summary: {
      peakWindow: "Thu 7-9 PM",
      hottestSegment: "25-34 video-first listeners",
      strongestPlatform: "YouTube",
      topRegion: "US South",
      revenueLift: 28,
      conversionRate: 6.8,
    },
    slots: ["6 AM", "12 PM", "6 PM", "9 PM"],
    days: [
      {
        day: "Mon",
        values: [
          { score: 42, platform: "Spotify", segment: "Audio commuters" },
          { score: 58, platform: "YouTube", segment: "Video-first millennials" },
          { score: 74, platform: "YouTube", segment: "Video-first millennials" },
          { score: 49, platform: "TikTok", segment: "Clip discovery" },
        ],
      },
      {
        day: "Tue",
        values: [
          { score: 47, platform: "Spotify", segment: "Audio commuters" },
          { score: 61, platform: "Spotify", segment: "Audio commuters" },
          { score: 78, platform: "YouTube", segment: "Video-first millennials" },
          { score: 53, platform: "TikTok", segment: "Clip discovery" },
        ],
      },
      {
        day: "Wed",
        values: [
          { score: 50, platform: "Spotify", segment: "Audio commuters" },
          { score: 66, platform: "YouTube", segment: "Video-first millennials" },
          { score: 81, platform: "YouTube", segment: "Video-first millennials" },
          { score: 59, platform: "Patreon", segment: "Paid community" },
        ],
      },
      {
        day: "Thu",
        values: [
          { score: 56, platform: "Spotify", segment: "Audio commuters" },
          { score: 73, platform: "YouTube", segment: "Video-first millennials" },
          { score: 96, platform: "YouTube", segment: "Video-first millennials" },
          { score: 84, platform: "Patreon", segment: "Paid community" },
        ],
      },
      {
        day: "Fri",
        values: [
          { score: 52, platform: "Spotify", segment: "Audio commuters" },
          { score: 68, platform: "YouTube", segment: "Video-first millennials" },
          { score: 89, platform: "TikTok", segment: "Clip discovery" },
          { score: 91, platform: "TikTok", segment: "Clip discovery" },
        ],
      },
      {
        day: "Sat",
        values: [
          { score: 39, platform: "Spotify", segment: "Audio commuters" },
          { score: 63, platform: "YouTube", segment: "Video-first millennials" },
          { score: 86, platform: "TikTok", segment: "Clip discovery" },
          { score: 94, platform: "TikTok", segment: "Clip discovery" },
        ],
      },
      {
        day: "Sun",
        values: [
          { score: 44, platform: "Spotify", segment: "Audio commuters" },
          { score: 65, platform: "Patreon", segment: "Paid community" },
          { score: 83, platform: "Patreon", segment: "Paid community" },
          { score: 76, platform: "Spotify", segment: "Audio commuters" },
        ],
      },
    ],
    segments: [
      {
        name: "Video-first millennials",
        age: "25-34",
        region: "US South",
        platform: "YouTube",
        device: "Mobile",
        engagement: 92,
        retention: 71,
        revenuePerThousand: 14.8,
        bestWindow: "Thu 7-9 PM",
      },
      {
        name: "Audio commuters",
        age: "30-44",
        region: "US Northeast",
        platform: "Spotify",
        device: "Mobile",
        engagement: 81,
        retention: 76,
        revenuePerThousand: 9.4,
        bestWindow: "Tue 7-9 AM",
      },
      {
        name: "Clip discovery",
        age: "18-29",
        region: "US West",
        platform: "TikTok",
        device: "Mobile",
        engagement: 88,
        retention: 54,
        revenuePerThousand: 4.7,
        bestWindow: "Sat 9-11 PM",
      },
      {
        name: "Paid community",
        age: "28-42",
        region: "US Midwest",
        platform: "Patreon",
        device: "Desktop",
        engagement: 74,
        retention: 83,
        revenuePerThousand: 22.6,
        bestWindow: "Sun 6-8 PM",
      },
    ],
    recommendations: [
      "Schedule full video episodes for Thursday evening when YouTube engagement and monetized watch time overlap.",
      "Push short clips late Friday and Saturday to capture discovery traffic before the Sunday audio bump.",
      "Send Patreon bonus drops on Sunday evening when paid-community retention is highest.",
    ],
  },
  feedbackWorkflow: {},
  auditLog: [
    {
      id: "audit-1004",
      createdAt: "2026-05-23T17:40:00.000Z",
      actor: "PodForge Admin",
      action: "Admin dashboard expanded",
      target: "Admin command center",
      detail: "Added analytics, revenue, uploads, platform health, and tester feedback.",
    },
    {
      id: "audit-1003",
      createdAt: "2026-05-23T17:09:06.825Z",
      actor: "Tester",
      action: "Feedback submitted",
      target: "Plan",
      detail: "A revenue dashboard should be added.",
    },
    {
      id: "audit-1002",
      createdAt: "2026-05-23T16:42:00.000Z",
      actor: "Michael Rodriguez",
      action: "Upload created",
      target: "How Indie Shows Get Sponsors",
      detail: "Imported WAV saved and queued for publish prep.",
    },
    {
      id: "audit-1001",
      createdAt: "2026-05-23T15:35:00.000Z",
      actor: "Ari Rivera",
      action: "Live archive saved",
      target: "The New Creator Economy",
      detail: "Video podcast archive saved after live session.",
    },
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultAdminStore() {
  return {
    users: clone(adminAnalyticsSeed.users),
    creators: clone(adminAnalyticsSeed.creators),
    operations: clone(adminAnalyticsSeed.operations),
    platforms: clone(adminAnalyticsSeed.platforms),
    uploads: clone(adminAnalyticsSeed.uploads),
    collections: clone(adminAnalyticsSeed.collections),
    alerts: clone(adminAnalyticsSeed.alerts),
    audienceHeatmap: clone(adminAnalyticsSeed.audienceHeatmap),
    feedbackWorkflow: clone(adminAnalyticsSeed.feedbackWorkflow),
    auditLog: clone(adminAnalyticsSeed.auditLog),
  };
}

function normalizeAdminStore(store) {
  const fallback = defaultAdminStore();
  return {
    users: Array.isArray(store.users) ? store.users : fallback.users,
    creators: { ...fallback.creators, ...(store.creators || {}) },
    operations: { ...fallback.operations, ...(store.operations || {}) },
    platforms: Array.isArray(store.platforms) ? store.platforms : fallback.platforms,
    uploads: Array.isArray(store.uploads) ? store.uploads : fallback.uploads,
    collections: Array.isArray(store.collections) ? store.collections : fallback.collections,
    alerts: Array.isArray(store.alerts) ? store.alerts : fallback.alerts,
    audienceHeatmap: store.audienceHeatmap && typeof store.audienceHeatmap === "object" ? store.audienceHeatmap : fallback.audienceHeatmap,
    feedbackWorkflow: store.feedbackWorkflow && typeof store.feedbackWorkflow === "object" ? store.feedbackWorkflow : {},
    auditLog: Array.isArray(store.auditLog) ? store.auditLog : fallback.auditLog,
  };
}

function readAdminStore() {
  try {
    if (!fs.existsSync(adminDataFile)) {
      const store = defaultAdminStore();
      writeAdminStore(store);
      return store;
    }

    return normalizeAdminStore(JSON.parse(fs.readFileSync(adminDataFile, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Admin data read failed: ${error.message}`);
    const store = defaultAdminStore();
    writeAdminStore(store);
    return store;
  }
}

function writeAdminStore(store) {
  fs.mkdirSync(path.dirname(adminDataFile), { recursive: true });
  fs.writeFileSync(adminDataFile, JSON.stringify(normalizeAdminStore(store), null, 2));
}

function requestActor(request) {
  return adminLoginRequired ? "Authenticated admin" : "Testing admin";
}

function appendAudit(store, action, target, detail, request) {
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    actor: requestActor(request),
    action,
    target,
    detail: String(detail || "").slice(0, 500),
  };
  store.auditLog = [entry, ...(store.auditLog || [])].slice(0, 300);
  return entry;
}

function feedbackItemsWithWorkflow(store) {
  return readFeedbackItems().map((item) => ({
    status: "New",
    priority: item.type === "Bug" ? "High" : "Normal",
    owner: "Product",
    ...(store.feedbackWorkflow?.[item.id] || {}),
    ...item,
  }));
}

function moneySum(items, key, statuses) {
  return items
    .filter((item) => !statuses || statuses.includes(item.status))
    .reduce((total, item) => total + Number(item[key] || 0), 0);
}

function buildAdminAnalytics() {
  const store = readAdminStore();
  const feedbackItems = feedbackItemsWithWorkflow(store);
  const uploads = [...store.uploads].sort((left, right) => new Date(right.uploadedAt) - new Date(left.uploadedAt));
  const collections = [...store.collections].sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate));
  const platforms = store.platforms;
  const users = [...store.users].sort((left, right) => new Date(right.lastActiveAt || 0) - new Date(left.lastActiveAt || 0));
  const totalPlatformRevenue = moneySum(platforms, "grossRevenue");
  const totalPlatformFee = moneySum(platforms, "podforgeFee");
  const collected = moneySum(collections, "fee", ["Collected"]);
  const scheduled = moneySum(collections, "fee", ["Scheduled", "Due soon"]);
  const overdue = moneySum(collections, "fee", ["Overdue"]);
  const today = new Date().toISOString().slice(0, 10);
  const mandatesActive = users.filter((user) => user.billingMandate === "Active").length;
  const activeCreators = users.filter((user) => user.status === "Active").length;
  const termsAccepted = users.filter((user) => Boolean(user.termsAcceptedAt)).length;

  return {
    generatedAt: new Date().toISOString(),
    mode: !isStripeConfigured() ? "simulation" : isLiveStripeKey() ? "live" : "test",
    stripeConfigured: isStripeConfigured(),
    liveChargesEnabled,
    summary: {
      creatorsTotal: users.length,
      activeCreators,
      totalUploads: uploads.length,
      uploadsToday: uploads.filter((upload) => upload.uploadedAt.startsWith(today)).length,
      connectedPlatforms: platforms.filter((platform) => platform.status !== "Statement pending").length,
      grossRevenueTracked: totalPlatformRevenue,
      podforgeFeeTracked: totalPlatformFee,
      collected,
      scheduled,
      overdue,
      collectionSuccessRate: 94,
      feedbackTotal: feedbackItems.length,
    },
    revenue: {
      grossTracked: totalPlatformRevenue,
      feeTracked: totalPlatformFee,
      collected,
      scheduled,
      overdue,
      pendingStatement: collections.filter((collection) => collection.status === "Awaiting statement").length,
      nextCollection: collections.find((collection) => collection.status !== "Collected") || null,
    },
    creators: {
      ...store.creators,
      total: users.length,
      active: activeCreators,
      termsAccepted,
      mandatesActive,
      trials: users.filter((user) => user.plan === "Starter").length,
    },
    operations: store.operations,
    users,
    platforms,
    uploads,
    collections,
    alerts: store.alerts,
    audienceHeatmap: store.audienceHeatmap,
    auditLog: [...store.auditLog].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 50),
    feedbackSummary: {
      total: feedbackItems.length,
      latest: feedbackItems[0] || null,
    },
  };
}

function allowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function updateAdminUserStatus(userId, payload, request) {
  const store = readAdminStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const previousStatus = user.status;
  user.status = allowedValue(String(payload.status || user.status), ["Active", "Review", "Past due", "Suspended"], user.status);
  user.adminNote = String(payload.adminNote || user.adminNote || "").slice(0, 500);
  user.updatedAt = new Date().toISOString();
  const audit = appendAudit(store, "User status updated", user.fullName, `${previousStatus} -> ${user.status}`, request);
  writeAdminStore(store);
  return { user, audit };
}

function updateFeedbackWorkflow(feedbackId, payload, request) {
  const store = readAdminStore();
  const feedback = readFeedbackItems().find((item) => item.id === feedbackId);
  if (!feedback) {
    const error = new Error("Feedback item not found.");
    error.statusCode = 404;
    throw error;
  }

  const workflow = {
    ...(store.feedbackWorkflow[feedbackId] || {}),
    status: allowedValue(String(payload.status || "New"), ["New", "Reviewing", "Planned", "Fixed", "Deferred"], "New"),
    priority: allowedValue(String(payload.priority || "Normal"), ["Low", "Normal", "High", "Critical"], "Normal"),
    owner: String(payload.owner || "Product").slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
  store.feedbackWorkflow[feedbackId] = workflow;
  const audit = appendAudit(store, "Feedback workflow updated", `${feedback.type} - ${feedback.page}`, `${workflow.status} / ${workflow.priority}`, request);
  writeAdminStore(store);
  return { feedback: { ...workflow, ...feedback }, audit };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(response, filename, rows) {
  const content = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  response.end(content);
}

function exportRows(type) {
  const store = readAdminStore();
  const analytics = buildAdminAnalytics();
  const feedbackItems = feedbackItemsWithWorkflow(store);

  if (type === "users") {
    return [
      ["Name", "Email", "Phone", "Status", "Plan", "Billing mandate", "Terms accepted", "Platforms", "Uploads", "Gross revenue", "PodForge fee", "Risk", "Admin note"],
      ...analytics.users.map((user) => [
        user.fullName,
        user.email,
        user.phone,
        user.status,
        user.plan,
        user.billingMandate,
        user.termsAcceptedAt,
        (user.linkedPlatforms || []).join("; "),
        user.uploads,
        user.grossRevenue,
        user.podforgeFee,
        user.risk,
        user.adminNote,
      ]),
    ];
  }

  if (type === "uploads") {
    return [
      ["Title", "Creator", "Format", "Source", "Uploaded at", "Duration", "Size", "Status", "Platforms"],
      ...analytics.uploads.map((upload) => [
        upload.title,
        upload.creator,
        upload.format,
        upload.source,
        upload.uploadedAt,
        upload.duration,
        upload.size,
        upload.status,
        (upload.platforms || []).join("; "),
      ]),
    ];
  }

  if (type === "revenue") {
    return [
      ["Platform", "Creator", "Period", "Gross", "PodForge fee", "Due date", "Status", "Method", "Next action"],
      ...analytics.collections.map((collection) => [
        collection.platform,
        collection.creator,
        collection.period,
        collection.gross,
        collection.fee,
        collection.dueDate,
        collection.status,
        collection.method,
        collection.nextAction,
      ]),
    ];
  }

  if (type === "feedback") {
    return [
      ["Type", "Page", "Status", "Priority", "Owner", "Note", "Contact", "Created at", "Tester IP"],
      ...feedbackItems.map((item) => [item.type, item.page, item.status, item.priority, item.owner, item.note, item.contact, item.createdAt, item.testerIp]),
    ];
  }

  if (type === "audit") {
    return [
      ["Created at", "Actor", "Action", "Target", "Detail"],
      ...analytics.auditLog.map((item) => [item.createdAt, item.actor, item.action, item.target, item.detail]),
    ];
  }

  const error = new Error("Unknown export type.");
  error.statusCode = 400;
  throw error;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function readJson(request) {
  const body = await readBody(request);
  if (!body) return {};
  return JSON.parse(body);
}

function isStripeConfigured() {
  return /^sk_(test|live)_/.test(stripeSecretKey);
}

function isLiveStripeKey() {
  return stripeSecretKey.startsWith("sk_live_");
}

function assertChargeAllowed() {
  if (isLiveStripeKey() && !liveChargesEnabled) {
    const error = new Error("Live charges are disabled. Set PODFORGE_ENABLE_LIVE_CHARGES=true only after legal and Stripe review.");
    error.statusCode = 403;
    throw error;
  }
}

function stripeRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams();
    flattenParams(payload, body);

    const request = https.request(
      {
        method,
        hostname: "api.stripe.com",
        path: endpoint,
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload.toString()),
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          let parsed = {};
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (error) {
            parsed = { raw: data };
          }

          if (response.statusCode >= 400) {
            const error = new Error(parsed.error?.message || "Stripe request failed");
            error.statusCode = response.statusCode;
            error.details = parsed;
            reject(error);
            return;
          }

          resolve(parsed);
        });
      },
    );

    request.on("error", reject);
    request.write(payload.toString());
    request.end();
  });
}

function flattenParams(payload, value, prefix = "") {
  Object.entries(value || {}).forEach(([key, current]) => {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (current === undefined || current === null) return;
    if (Array.isArray(current)) {
      current.forEach((item, index) => flattenParams(payload, { [index]: item }, name));
      return;
    }
    if (typeof current === "object") {
      flattenParams(payload, current, name);
      return;
    }
    payload.append(name, String(current));
  });
}

function cents(amount) {
  return Math.max(50, Math.round(Number(amount || 0) * 100));
}

function mockId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function paymentMethodTypes(billingMethod) {
  if (billingMethod === "ACH debit") return ["us_bank_account", "card"];
  if (billingMethod === "Card on file") return ["card"];
  return ["card"];
}

async function createMandateSetup(payload) {
  const billingMethod = payload.billingMethod || "ACH debit";
  const email = payload.email || "creator@podforge.test";

  if (!isStripeConfigured()) {
    return {
      mode: "simulation",
      checkoutUrl: `${baseUrl}/#revenue`,
      stripeCustomerId: mockId("cus_test"),
      stripeSessionId: mockId("cs_test"),
      billingMethod,
      message: "Stripe is not configured yet, so PodForge simulated the mandate setup.",
    };
  }

  assertChargeAllowed();
  const customer =
    payload.stripeCustomerId ||
    (
      await stripeRequest("POST", "/v1/customers", {
        email,
        name: payload.fullName || payload.creatorName || "PodForge Creator",
        metadata: {
          podforge_creator_id: payload.creatorId || "prototype-creator",
        },
      })
    ).id;

  const session = await stripeRequest("POST", "/v1/checkout/sessions", {
    mode: "setup",
    customer,
    payment_method_types: paymentMethodTypes(billingMethod),
    success_url: `${baseUrl}/#revenue?mandate=success`,
    cancel_url: `${baseUrl}/#revenue?mandate=cancelled`,
    metadata: {
      podforge_creator_id: payload.creatorId || "prototype-creator",
      billing_method: billingMethod,
      revenue_share_percent: "10",
    },
  });

  return {
    mode: isLiveStripeKey() ? "live" : "test",
    checkoutUrl: session.url,
    stripeCustomerId: customer,
    stripeSessionId: session.id,
    billingMethod,
    message: "Stripe mandate setup session created.",
  };
}

async function collectPlatformFee(payload) {
  const amount = Number(payload.amount || payload.fee || 0);
  const feeAmount = cents(amount);
  const email = payload.email || "creator@podforge.test";

  if (!isStripeConfigured()) {
    return {
      mode: "simulation",
      invoiceId: mockId("in_test"),
      paymentIntentId: mockId("pi_test"),
      status: "simulated_paid",
      fee: feeAmount / 100,
      message: "Stripe is not configured yet, so PodForge simulated the 10% fee collection.",
    };
  }

  assertChargeAllowed();
  const customer =
    payload.stripeCustomerId ||
    (
      await stripeRequest("POST", "/v1/customers", {
        email,
        name: payload.fullName || payload.creatorName || "PodForge Creator",
        metadata: {
          podforge_creator_id: payload.creatorId || "prototype-creator",
        },
      })
    ).id;

  await stripeRequest("POST", "/v1/invoiceitems", {
    customer,
    amount: feeAmount,
    currency: "usd",
    description: `PodForge 10% platform fee - ${payload.platform || "Platform"} ${payload.period || "current period"}`,
    metadata: {
      podforge_creator_id: payload.creatorId || "prototype-creator",
      platform: payload.platform || "Unknown",
      period: payload.period || "current",
      gross_revenue: String(payload.gross || ""),
      podforge_fee_percent: "10",
    },
  });

  const invoice = await stripeRequest("POST", "/v1/invoices", {
    customer,
    collection_method: "charge_automatically",
    auto_advance: true,
    description: "PodForge revenue-share fee",
    metadata: {
      podforge_creator_id: payload.creatorId || "prototype-creator",
      podforge_collection_type: "external_platform_fee",
    },
  });

  return {
    mode: isLiveStripeKey() ? "live" : "test",
    invoiceId: invoice.id,
    status: invoice.status,
    fee: feeAmount / 100,
    stripeCustomerId: customer,
    message: "Stripe invoice created for automatic collection.",
  };
}

function verifyStripeWebhookSignature(rawBody, signatureHeader) {
  if (!stripeWebhookSecret) return { verified: false, reason: "No webhook secret configured" };
  if (!signatureHeader) return { verified: false, reason: "Missing Stripe-Signature header" };

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", stripeWebhookSecret).update(signedPayload).digest("hex");
  const verified =
    typeof parts.v1 === "string" &&
    expected.length === parts.v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));

  return { verified, reason: verified ? "" : "Signature mismatch" };
}

async function handleApi(request, response, url) {
  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    if (!adminLoginRequired) {
      sendJson(response, 200, { ok: true, adminPath, loginRequired: false });
      return true;
    }

    const payload = await readJson(request);
    if (!adminPassword) {
      sendJson(response, 503, { error: "Admin password is not configured." });
      return true;
    }
    if (!safeCompare(payload.password, adminPassword)) {
      sendJson(response, 401, { error: "Incorrect admin password." });
      return true;
    }

    const session = createAdminSession(response);
    sendJson(response, 200, {
      ok: true,
      adminPath,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    const token = parseCookies(request).podforge_admin;
    if (token) adminSessions.delete(token);
    clearCookie(response, "podforge_admin");
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/me") {
    sendJson(response, isAdminRequest(request) ? 200 : 401, {
      ok: isAdminRequest(request),
      adminPath,
      loginRequired: adminLoginRequired,
      sessionHours: adminSessionHours,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/feedback") {
    requireAdmin(request);
    const store = readAdminStore();
    const items = feedbackItemsWithWorkflow(store);
    sendJson(response, 200, {
      items,
      total: items.length,
      latest: items[0] || null,
    });
    return true;
  }

  const feedbackStatusMatch = url.pathname.match(/^\/api\/admin\/feedback\/([^/]+)\/status$/);
  if (request.method === "POST" && feedbackStatusMatch) {
    requireAdmin(request);
    const payload = await readJson(request);
    sendJson(response, 200, updateFeedbackWorkflow(decodeURIComponent(feedbackStatusMatch[1]), payload, request));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/analytics") {
    requireAdmin(request);
    sendJson(response, 200, buildAdminAnalytics());
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/users") {
    requireAdmin(request);
    const analytics = buildAdminAnalytics();
    sendJson(response, 200, {
      users: analytics.users,
      total: analytics.users.length,
    });
    return true;
  }

  const userStatusMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
  if (request.method === "POST" && userStatusMatch) {
    requireAdmin(request);
    const payload = await readJson(request);
    sendJson(response, 200, updateAdminUserStatus(decodeURIComponent(userStatusMatch[1]), payload, request));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/export") {
    requireAdmin(request);
    const type = String(url.searchParams.get("type") || "users");
    sendCsv(response, `podforge-${type}.csv`, exportRows(type));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/feedback") {
    sendJson(response, 405, { error: "Feedback inbox is admin-only." });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/feedback") {
    const feedback = normalizeFeedback(await readJson(request), request);
    const items = [feedback, ...readFeedbackItems()].slice(0, 500);
    writeFeedbackItems(items);
    sendJson(response, 201, { feedback, items });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/revenue/config") {
    sendJson(response, 200, {
      mode: !isStripeConfigured() ? "simulation" : isLiveStripeKey() ? "live" : "test",
      stripeConfigured: isStripeConfigured(),
      webhookConfigured: Boolean(stripeWebhookSecret),
      liveChargesEnabled,
      baseUrl,
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/revenue/setup-mandate") {
    const payload = await readJson(request);
    sendJson(response, 200, await createMandateSetup(payload));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/revenue/collect-fee") {
    const payload = await readJson(request);
    sendJson(response, 200, await collectPlatformFee(payload));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/revenue/platform-sync") {
    const payload = await readJson(request);
    sendJson(response, 200, {
      mode: "simulation",
      platform: payload.platform || "Platform",
      importedRows: 1,
      message: "Real platform revenue sync will use OAuth APIs or approved statement imports.",
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/revenue/webhook") {
    const rawBody = await readBody(request);
    const verification = verifyStripeWebhookSignature(rawBody, request.headers["stripe-signature"]);
    let event = {};
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid webhook JSON" });
      return true;
    }

    const handled = ["checkout.session.completed", "invoice.payment_succeeded", "invoice.payment_failed"].includes(event.type);
    sendJson(response, 200, {
      received: true,
      handled,
      verified: verification.verified,
      verificationNote: verification.reason,
      eventType: event.type,
    });
    return true;
  }

  return false;
}

function serveFile(response, filePath) {
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(normalized, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": types[path.extname(normalized)] || "application/octet-stream" });
    response.end(content);
  });
}

function serveStatic(response, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const privatePath =
    requested.startsWith("/.") ||
    requested.startsWith("/data/") ||
    requested.startsWith("/cloudflared-") ||
    requested === "/admin.html";

  if (privatePath) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  serveFile(response, path.join(root, requested));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/") && (await handleApi(request, response, url))) return;
    if (url.pathname === adminPath || url.pathname === `${adminPath}/`) {
      serveFile(response, path.join(root, "admin.html"));
      return;
    }
    serveStatic(response, url);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Server error",
      details: error.details || undefined,
    });
  }
});

server.listen(port, host, () => {
  console.log(`PodForge Studio running at http://${host}:${port}`);
});
