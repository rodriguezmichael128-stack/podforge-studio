const state = {
  mode: "video",
  stream: null,
  recorder: null,
  chunks: [],
  isRecording: false,
  isLive: false,
  assets: [],
  episodes: [],
  feedback: [],
  feedbackLoaded: false,
  selectedEpisodeId: "",
  pipelineSearch: "",
  pipelineStageFilter: "All",
  revenue: null,
  editRun: 0,
  audioContext: null,
  analyser: null,
  animationId: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const cameraPreview = $("#cameraPreview");
const previewPlaceholder = $("#previewPlaceholder");
const sessionStatus = $("#sessionStatus");
const recordButton = $("#recordButton");
const deviceButton = $("#deviceButton");
const liveButton = $("#liveButton");
const importInput = $("#importInput");
const assetList = $("#assetList");
const recentRecordingsList = $("#recentRecordingsList");
const assetCount = $("#assetCount");
const packageSummary = $("#packageSummary");
const publishStatus = $("#publishStatus");
const toast = $("#toast");
const audioMeter = $("#audioMeter");
const meterContext = audioMeter.getContext("2d");
const reviewScore = $("#reviewScore");
const accountStorageKey = "podforgeAccount";
const feedbackStorageKey = "podforgeFeedback";
const episodeStorageKey = "podforgeEpisodes";
const revenueStorageKey = "podforgeRevenue";
const pipelineStages = ["Idea", "Script", "Record", "Edit", "Review", "Publish", "Analyze"];
const stageActions = {
  Idea: "Shape the angle",
  Script: "Lock the rundown",
  Record: "Run the session",
  Edit: "Build the package",
  Review: "Collect approval",
  Publish: "Schedule release",
  Analyze: "Review performance",
};
const stageDeadlines = {
  Idea: "Draft target by Friday",
  Script: "Rundown due tomorrow",
  Record: "Session window today",
  Edit: "First cut due in 24 hours",
  Review: "Approval needed before publish",
  Publish: "Release desk is ready",
  Analyze: "Check the first 48 hours",
};

const defaultEpisodes = [
  {
    id: "creator-economy",
    title: "The New Creator Economy",
    status: "Recording today",
    format: "Interview",
    type: "video",
    audience: "indie creators and podcasters",
    goal: "Interview format with two short vertical clips and an audio-only master.",
    guest: "Ari Rivera",
    target: "Everywhere package",
    stage: "Record",
  },
  {
    id: "indie-sponsors",
    title: "How Indie Shows Get Sponsors",
    status: "Script draft",
    format: "Solo commentary",
    type: "audio",
    audience: "indie hosts looking for sponsors",
    goal: "Solo breakdown with sponsor-read blocks, examples, and monetization checklist.",
    guest: "",
    target: "Spotify first",
    stage: "Script",
  },
  {
    id: "audience-qa",
    title: "Audience Q&A: Better Episodes",
    status: "Review",
    format: "Roundtable",
    type: "video",
    audience: "existing listeners",
    goal: "Roundtable edit waiting on captions, thumbnail, and publish approval.",
    guest: "Kai Morgan",
    target: "YouTube first",
    stage: "Review",
  },
];

const defaultRevenueState = {
  mandateActive: false,
  billingMethod: "ACH debit",
  sources: [
    {
      id: "youtube",
      code: "YT",
      name: "YouTube",
      connected: true,
      dataAccess: "Analytics revenue metrics",
      payoutControl: "Creator AdSense payout",
      collection: "PodForge billing mandate",
      sync: "Estimated revenue synced",
    },
    {
      id: "spotify",
      code: "SP",
      name: "Spotify",
      connected: true,
      dataAccess: "Creator statement import",
      payoutControl: "Creator Spotify Payouts",
      collection: "PodForge billing mandate",
      sync: "Monthly report pending",
    },
    {
      id: "apple",
      code: "AP",
      name: "Apple Podcasts",
      connected: false,
      dataAccess: "Financial report import",
      payoutControl: "Creator Apple payout",
      collection: "PodForge billing mandate",
      sync: "Needs connection",
    },
    {
      id: "tiktok",
      code: "TT",
      name: "TikTok",
      connected: false,
      dataAccess: "Dashboard or report import",
      payoutControl: "Creator TikTok payout",
      collection: "PodForge billing mandate",
      sync: "Needs connection",
    },
    {
      id: "patreon",
      code: "PA",
      name: "Patreon",
      connected: false,
      dataAccess: "API and payout report",
      payoutControl: "Creator Patreon payout",
      collection: "PodForge billing mandate",
      sync: "Needs connection",
    },
    {
      id: "podforge",
      code: "PF",
      name: "PodForge Sponsorships",
      connected: true,
      dataAccess: "Native transaction ledger",
      payoutControl: "PodForge-controlled payout",
      collection: "Deducted at source",
      sync: "Fee collected automatically",
    },
  ],
  ledger: [
    {
      id: "yt-apr-2026",
      platform: "YouTube",
      period: "Apr 2026",
      gross: 1850,
      fee: 185,
      creator: 1665,
      source: "API estimate",
      status: "Scheduled",
    },
    {
      id: "sp-apr-2026",
      platform: "Spotify",
      period: "Apr 2026",
      gross: 920,
      fee: 92,
      creator: 828,
      source: "Statement import",
      status: "Awaiting final",
    },
    {
      id: "pf-apr-2026",
      platform: "PodForge Sponsorships",
      period: "Apr 2026",
      gross: 650,
      fee: 65,
      creator: 585,
      source: "Native payment",
      status: "Collected",
    },
  ],
};

const audienceHeatmapData = {
  peak: "Thu 7 PM",
  cells: [
    {
      day: "Mon",
      values: [
        { score: 34, platform: "Spotify" },
        { score: 48, platform: "YouTube" },
        { score: 61, platform: "YouTube" },
        { score: 42, platform: "TikTok" },
      ],
    },
    {
      day: "Tue",
      values: [
        { score: 41, platform: "Spotify" },
        { score: 57, platform: "Spotify" },
        { score: 69, platform: "YouTube" },
        { score: 50, platform: "TikTok" },
      ],
    },
    {
      day: "Wed",
      values: [
        { score: 46, platform: "Spotify" },
        { score: 62, platform: "YouTube" },
        { score: 74, platform: "YouTube" },
        { score: 56, platform: "TikTok" },
      ],
    },
    {
      day: "Thu",
      values: [
        { score: 52, platform: "Spotify" },
        { score: 71, platform: "YouTube" },
        { score: 92, platform: "YouTube" },
        { score: 67, platform: "Patreon" },
      ],
    },
    {
      day: "Fri",
      values: [
        { score: 49, platform: "Spotify" },
        { score: 64, platform: "YouTube" },
        { score: 84, platform: "TikTok" },
        { score: 73, platform: "TikTok" },
      ],
    },
    {
      day: "Sat",
      values: [
        { score: 38, platform: "Spotify" },
        { score: 58, platform: "YouTube" },
        { score: 79, platform: "TikTok" },
        { score: 88, platform: "TikTok" },
      ],
    },
    {
      day: "Sun",
      values: [
        { score: 44, platform: "Spotify" },
        { score: 63, platform: "Patreon" },
        { score: 81, platform: "Patreon" },
        { score: 70, platform: "Spotify" },
      ],
    },
  ],
  slots: ["Morning", "Midday", "Evening", "Late"],
  insights: [
    ["Best release window", "YouTube Thu 6-9 PM"],
    ["Strongest audio slot", "Spotify Tue morning"],
    ["Clip opportunity", "TikTok Sat late posts"],
  ],
};

const pageCopy = {
  pipeline: {
    title: "Move each episode from idea to revenue.",
    copy: "Track shows, draft episodes, production status, and what needs attention next.",
  },
  planning: {
    title: "Plan the episode before anyone hits record.",
    copy: "Build the rundown, sponsor blocks, guest prep, and creative angle in one place.",
  },
  studio: {
    title: "Record live, remote, video, or audio-only.",
    copy: "Capture raw material directly in the browser, then save and send it into the edit queue.",
  },
  devices: {
    title: "Check every device before the session starts.",
    copy: "Select camera, microphone, speakers, permissions, signal quality, storage, and live readiness.",
  },
  editor: {
    title: "Turn raw recordings into finished packages.",
    copy: "Run smart cuts, captions, sound effects, cleanup, and platform versions.",
  },
  results: {
    title: "Review every output the auto-editor created.",
    copy: "See masters, clips, captions, chapters, thumbnails, and audio polish in one package.",
  },
  transcript: {
    title: "Find the moments worth clipping.",
    copy: "Review transcript highlights, create short clips, and build a social clip queue.",
  },
  brand: {
    title: "Package every episode in the show's identity.",
    copy: "Apply cover art, caption styles, thumbnails, colors, and lower-third direction.",
  },
  library: {
    title: "Keep raw and finished assets organized.",
    copy: "Review recordings, imports, finished masters, clips, and export packages.",
  },
  review: {
    title: "Approve the episode before it goes public.",
    copy: "Check captions, loudness, releases, thumbnails, metadata, and monetization safety.",
  },
  share: {
    title: "Send a private review page before publishing.",
    copy: "Give guests and collaborators one place to watch, comment, and approve the episode.",
  },
  platforms: {
    title: "Make every platform publish-ready.",
    copy: "Check titles, thumbnails, captions, clips, monetization, metadata, and scheduling.",
  },
  revenue: {
    title: "Collect the PodForge fee every pay period.",
    copy: "Link monetized platforms for revenue tracking, activate billing mandates, and reconcile the 10% PodForge share.",
  },
  publish: {
    title: "Upload everywhere from one release desk.",
    copy: "Queue the finished package for monetizable platforms and social clip channels.",
  },
  analytics: {
    title: "Learn what worked after publishing.",
    copy: "Track projected reach, retention, revenue signals, tester notes, and next changes.",
  },
  account: {
    title: "Manage your creator account.",
    copy: "Update profile information, confirm accepted terms, and manage this prototype account.",
  },
  backend: {
    title: "Map the production backend.",
    copy: "Track the services needed for real accounts, media storage, processing jobs, publishing, and revenue.",
  },
};

const validPages = Object.keys(pageCopy);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function getStoredFeedback() {
  if (state.feedbackLoaded) return state.feedback;

  try {
    return JSON.parse(localStorage.getItem(feedbackStorageKey)) || [];
  } catch (error) {
    return [];
  }
}

function saveStoredFeedback(items) {
  state.feedback = Array.isArray(items) ? items : [];
  state.feedbackLoaded = true;
  localStorage.setItem(feedbackStorageKey, JSON.stringify(items));
}

function getStoredEpisodes() {
  try {
    const episodes = JSON.parse(localStorage.getItem(episodeStorageKey));
    return Array.isArray(episodes) && episodes.length ? episodes : defaultEpisodes;
  } catch (error) {
    return defaultEpisodes;
  }
}

function saveStoredEpisodes() {
  localStorage.setItem(episodeStorageKey, JSON.stringify(state.episodes));
}

function stageToStatus(stage) {
  const labels = {
    Idea: "New idea",
    Script: "Script draft",
    Record: "Recording today",
    Edit: "Editing",
    Review: "Review",
    Publish: "Publish ready",
    Analyze: "Published",
  };
  return labels[stage] || "New idea";
}

function statusClass(status) {
  if (status.includes("Script") || status.includes("Editing")) return "teal";
  if (status.includes("Review") || status.includes("Published")) return "violet";
  return "";
}

function selectedEpisode() {
  return state.episodes.find((episode) => episode.id === state.selectedEpisodeId) || state.episodes[0];
}

function stageIndex(stage) {
  return Math.max(0, pipelineStages.indexOf(stage));
}

function episodeProgress(episode) {
  if (!episode) return 0;
  return Math.min(100, Math.round(((stageIndex(episode.stage) + 1) / pipelineStages.length) * 100));
}

function episodeReadiness(episode) {
  if (!episode) return 0;
  const base = episodeProgress(episode);
  const detailBonus = [episode.guest, episode.audience, episode.target, episode.goal]
    .filter((item) => String(item || "").trim().length > 2).length * 4;
  return Math.min(100, base + detailBonus);
}

function episodeOpenTaskCount(episode) {
  if (!episode) return 0;
  return Math.max(0, pipelineStages.length - stageIndex(episode.stage) - 1);
}

function nextPipelineStage(stage) {
  return pipelineStages[Math.min(pipelineStages.length - 1, stageIndex(stage) + 1)];
}

function episodeSearchText(episode) {
  return [episode.title, episode.status, episode.format, episode.type, episode.audience, episode.goal, episode.guest, episode.target, episode.stage]
    .join(" ")
    .toLowerCase();
}

function visibleEpisodes() {
  const search = state.pipelineSearch.trim().toLowerCase();
  return state.episodes.filter((episode) => {
    const stageMatch = state.pipelineStageFilter === "All" || episode.stage === state.pipelineStageFilter;
    const searchMatch = !search || episodeSearchText(episode).includes(search);
    return stageMatch && searchMatch;
  });
}

function renderStudioMetrics() {
  const activeCount = state.episodes.length;
  const readyCount = state.episodes.filter((episode) => ["Publish", "Analyze"].includes(episode.stage)).length;
  const openTasks = state.episodes.reduce((total, episode) => total + episodeOpenTaskCount(episode), 0);
  const totals = state.revenue ? revenueTotals() : { gross: 0 };

  $("#activeEpisodeMetric").textContent = String(activeCount);
  $("#readyEpisodeMetric").textContent = String(readyCount);
  $("#openTaskMetric").textContent = String(openTasks);
  $("#trackedRevenueMetric").textContent = formatCurrency(totals.gross || 0);
}

function renderPipelineSummary() {
  const episode = selectedEpisode();
  const readiness = episodeReadiness(episode);
  const readinessBar = $("#activeEpisodeReadinessBar");

  $("#activeEpisodeTitle").textContent = episode?.title || "No episode selected";
  $("#activeEpisodeSummary").textContent = episode
    ? `${episode.format} for ${episode.audience || "your audience"} with ${episode.target || "a platform target"}.`
    : "Create or select an episode to build its production package.";
  $("#activeEpisodeAction").textContent = episode ? stageActions[episode.stage] || "Choose a next step" : "Choose a show";
  $("#activeEpisodeDeadline").textContent = episode ? stageDeadlines[episode.stage] || "Pipeline status is current." : "Pipeline status will appear here.";
  $("#activeEpisodeReadiness").textContent = `${readiness}%`;
  readinessBar.style.width = `${readiness}%`;
}

function renderPipelineControls() {
  const searchInput = $("#episodeSearchInput");
  const stageFilter = $("#episodeStageFilter");
  if (searchInput && document.activeElement !== searchInput) searchInput.value = state.pipelineSearch;
  if (stageFilter) stageFilter.value = state.pipelineStageFilter;
}

function pageLabel(page) {
  const labels = {
    pipeline: "Pipeline",
    planning: "Plan",
    studio: "Studio",
    devices: "Devices",
    editor: "Auto Edit",
    results: "Results",
    transcript: "Transcript",
    brand: "Brand",
    library: "Library",
    review: "Review",
    share: "Share Review",
    platforms: "Platforms",
    revenue: "Revenue",
    publish: "Publish",
    analytics: "Analytics",
    backend: "Backend",
    account: "Account",
  };
  return labels[page] || "Pipeline";
}

function currentPageName() {
  return document.body.dataset.currentPage || window.location.hash.replace("#", "") || "pipeline";
}

function openFeedbackModal() {
  $("#feedbackPage").value = validPages.includes(currentPageName()) ? currentPageName() : "pipeline";
  $("#feedbackText").value = "";
  $("#feedbackContact").value = "";
  $("#feedbackError").textContent = "";
  $("#feedbackModal").hidden = false;
  $("#feedbackText").focus();
}

function closeFeedbackModal() {
  $("#feedbackModal").hidden = true;
}

function renderFeedbackSummary() {
  const feedbackItems = getStoredFeedback();
  const latest = feedbackItems[0];
  $("#notesMetric").textContent = feedbackItems.length || "0";
  $("#feedbackNote").textContent = latest
    ? `${latest.type} on ${pageLabel(latest.page)}: ${latest.note}`
    : "Tester feedback is sent privately to the admin portal.";

  const inbox = $("#feedbackInbox");
  if (!feedbackItems.length) {
    inbox.innerHTML = '<div class="empty-state compact-empty">Shared tester feedback is visible in the admin portal only.</div>';
    return;
  }

  inbox.innerHTML = feedbackItems
    .slice(0, 5)
    .map(
      (item) => `
        <article class="feedback-item">
          <strong><span>${escapeHtml(item.type)} - ${escapeHtml(pageLabel(item.page))}</span><span>${escapeHtml(item.timeLabel)}</span></strong>
          <p>${escapeHtml(item.note)}</p>
          ${item.contact ? `<small>${escapeHtml(item.contact)}</small>` : ""}
        </article>
      `,
    )
    .join("");
}

async function loadSharedFeedback() {
  renderFeedbackSummary();
}

function cloneDefaultRevenueState() {
  return JSON.parse(JSON.stringify(defaultRevenueState));
}

function getStoredRevenue() {
  const fallback = cloneDefaultRevenueState();
  try {
    const stored = JSON.parse(localStorage.getItem(revenueStorageKey));
    if (!stored || !Array.isArray(stored.sources) || !Array.isArray(stored.ledger)) return fallback;

    return {
      ...fallback,
      ...stored,
      sources: fallback.sources.map((source) => ({
        ...source,
        ...(stored.sources.find((item) => item.id === source.id) || {}),
      })),
      ledger: stored.ledger.length ? stored.ledger : fallback.ledger,
    };
  } catch (error) {
    return fallback;
  }
}

function saveRevenueState() {
  localStorage.setItem(revenueStorageKey, JSON.stringify(state.revenue));
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Revenue service request failed.");
  return payload;
}

function creatorPayload() {
  const account = getStoredAccount() || {};
  return {
    creatorId: account.id || account.email || "prototype-creator",
    fullName: account.fullName || "Prototype Creator",
    email: account.email || "creator@podforge.test",
    billingMethod: state.revenue.billingMethod,
    revenueSharePercent: 10,
    stripeCustomerId: state.revenue.stripeCustomerId || "",
  };
}

function renderRevenueIntegrationStatus() {
  const status = $("#revenueIntegrationStatus");
  if (!status || !state.revenue) return;
  const integration = state.revenue.integration || {};
  const modeLabel = integration.mode ? integration.mode.toUpperCase() : "SIMULATION";
  const stripeClass = integration.stripeConfigured ? "ready" : "warn";
  const webhookClass = integration.webhookConfigured ? "ready" : "warn";
  const liveClass = integration.liveChargesEnabled ? "warn" : "ready";

  status.innerHTML = `
    <span class="${stripeClass}">Stripe ${integration.stripeConfigured ? "configured" : "simulation"}</span>
    <span class="${webhookClass}">Webhook ${integration.webhookConfigured ? "ready" : "not set"}</span>
    <span class="${liveClass}">${modeLabel} mode</span>
    <span>Server collection route active</span>
  `;
}

async function loadRevenueBackendConfig() {
  try {
    state.revenue.integration = await apiJson("/api/revenue/config");
  } catch (error) {
    state.revenue.integration = {
      mode: "offline",
      stripeConfigured: false,
      webhookConfigured: false,
      liveChargesEnabled: false,
    };
  }
  renderRevenueIntegrationStatus();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function revenueTotals() {
  return state.revenue.ledger.reduce(
    (totals, row) => ({
      gross: totals.gross + row.gross,
      fee: totals.fee + row.fee,
      creator: totals.creator + row.creator,
    }),
    { gross: 0, fee: 0, creator: 0 },
  );
}

function renderRevenueCollection() {
  const sourceGrid = $("#revenueSourceGrid");
  if (!sourceGrid || !state.revenue) return;

  const totals = revenueTotals();
  $("#trackedGrossMetric").textContent = formatCurrency(totals.gross);
  $("#podforgeFeeMetric").textContent = formatCurrency(totals.fee);
  $("#creatorShareMetric").textContent = formatCurrency(totals.creator);
  $("#collectionStatusMetric").textContent = state.revenue.mandateActive ? "Auto-collect active" : "Mandate needed";
  $("#collectionStatusHelp").textContent = state.revenue.mandateActive
    ? `${state.revenue.billingMethod} will be charged after each statement closes.`
    : "Connected platforms report revenue; the billing mandate collects the fee.";
  $("#mandateStatusPill").textContent = state.revenue.mandateActive ? "Active" : "Not active";
  $("#mandateStatusPill").classList.toggle("ready", state.revenue.mandateActive);
  $("#mandateCheck").checked = state.revenue.mandateActive;
  $("#billingMethodSelect").value = state.revenue.billingMethod;
  $("#stripeSetupStatus").textContent = state.revenue.stripeSessionId
    ? `Mandate setup ${state.revenue.integration?.mode || "simulation"} session: ${state.revenue.stripeSessionId}`
    : "Stripe setup has not been started.";
  renderRevenueIntegrationStatus();

  const connectedCount = state.revenue.sources.filter((source) => source.connected).length;
  $("#connectedRevenueCount").textContent = `${connectedCount} connected`;

  sourceGrid.innerHTML = state.revenue.sources
    .map(
      (source) => `
        <article class="revenue-source-card ${source.connected ? "connected" : ""}">
          <div class="source-main">
            <span class="source-badge">${escapeHtml(source.code)}</span>
            <div>
              <strong>${escapeHtml(source.name)}</strong>
              <p>${escapeHtml(source.dataAccess)}</p>
              <small>${escapeHtml(source.payoutControl)}</small>
            </div>
          </div>
          <em>${source.connected ? "Connected" : "Not connected"}</em>
          <button type="button" data-revenue-source="${escapeHtml(source.id)}">${source.connected ? "Sync" : "Connect"}</button>
          <footer>
            <span>${escapeHtml(source.collection)}</span>
            <span>${escapeHtml(source.sync)}</span>
          </footer>
        </article>
      `,
    )
    .join("");

  renderRevenueLedger();
  $$("#revenueSourceGrid button").forEach((button) => {
    button.addEventListener("click", () => connectRevenueSource(button.dataset.revenueSource));
  });
}

function renderRevenueLedger() {
  const ledger = $("#ledgerTable");
  if (!ledger || !state.revenue) return;

  ledger.innerHTML = `
    <div class="ledger-row ledger-head">
      <span>Platform</span>
      <span>Period</span>
      <span>Gross</span>
      <span>PodForge 10%</span>
      <span>Creator 90%</span>
      <span>Status</span>
    </div>
    ${state.revenue.ledger
      .map(
        (row) => `
          <div class="ledger-row">
            <strong>${escapeHtml(row.platform)}</strong>
            <span>${escapeHtml(row.period)}</span>
            <span>${formatCurrency(row.gross)}</span>
            <span>${formatCurrency(row.fee)}</span>
            <span>${formatCurrency(row.creator)}</span>
            <em class="ledger-status ${row.status === "Collected" || row.status === "Simulated collected" ? "collected" : "scheduled"}">${escapeHtml(row.status)}</em>
          </div>
        `,
      )
      .join("")}
  `;
}

function connectRevenueSource(id) {
  const source = state.revenue.sources.find((item) => item.id === id);
  if (!source) return;

  source.connected = true;
  source.sync = source.id === "podforge" ? "Fee collected automatically" : "Ready for next pay period";
  saveRevenueState();
  renderRevenueCollection();
  showToast(`${source.name} revenue source ${source.id === "podforge" ? "synced" : "connected"}.`);
}

async function activateRevenueCollection() {
  if (!$("#mandateCheck").checked) {
    showToast("Authorize the collection mandate first.");
    return;
  }

  try {
    const setup = await apiJson("/api/revenue/setup-mandate", {
      method: "POST",
      body: JSON.stringify(creatorPayload()),
    });

    state.revenue.mandateActive = true;
    state.revenue.billingMethod = $("#billingMethodSelect").value;
    state.revenue.stripeCustomerId = setup.stripeCustomerId;
    state.revenue.stripeSessionId = setup.stripeSessionId;
    state.revenue.lastCollectionMessage = setup.message;
    state.revenue.ledger = state.revenue.ledger.map((row) => ({
      ...row,
      status: row.status === "Collected" ? row.status : "Auto-collect scheduled",
    }));
    saveRevenueState();
    renderRevenueCollection();

    if (setup.checkoutUrl && !setup.checkoutUrl.includes(window.location.origin)) {
      showToast("Stripe setup session created. Open the returned Checkout URL when test keys are configured.");
      return;
    }

    showToast(setup.message || "Automatic PodForge fee collection activated.");
  } catch (error) {
    showToast(error.message);
  }
}

function updateRevenueMandate() {
  state.revenue.mandateActive = $("#mandateCheck").checked;
  state.revenue.billingMethod = $("#billingMethodSelect").value;
  saveRevenueState();
  renderRevenueCollection();
}

async function collectDueFees() {
  if (!state.revenue.mandateActive) {
    showToast("Activate the collection mandate before charging fees.");
    return;
  }

  const dueRows = state.revenue.ledger.filter((row) => row.status !== "Collected" && row.status !== "Simulated collected");
  if (!dueRows.length) {
    showToast("No due fees to collect.");
    return;
  }

  const totalDue = dueRows.reduce((sum, row) => sum + row.fee, 0);

  try {
    const collection = await apiJson("/api/revenue/collect-fee", {
      method: "POST",
      body: JSON.stringify({
        ...creatorPayload(),
        platform: "Multiple platforms",
        period: "Open pay periods",
        amount: totalDue,
        fee: totalDue,
        gross: dueRows.reduce((sum, row) => sum + row.gross, 0),
      }),
    });

    state.revenue.lastCollectionInvoiceId = collection.invoiceId;
    state.revenue.lastCollectionMessage = collection.message;
    state.revenue.ledger = state.revenue.ledger.map((row) =>
      dueRows.some((dueRow) => dueRow.id === row.id)
        ? {
            ...row,
            status: collection.mode === "simulation" ? "Simulated collected" : "Collection started",
            invoiceId: collection.invoiceId,
          }
        : row,
    );
    saveRevenueState();
    renderRevenueCollection();
    showToast(collection.message || "PodForge fee collection started.");
  } catch (error) {
    showToast(error.message);
  }
}

async function importRevenueReport() {
  try {
    await apiJson("/api/revenue/platform-sync", {
      method: "POST",
      body: JSON.stringify({ platform: "TikTok", source: "manual report import" }),
    });
  } catch (error) {
    showToast(error.message);
    return;
  }

  const existing = state.revenue.ledger.some((row) => row.id === "tt-may-2026");
  if (!existing) {
    state.revenue.ledger.unshift({
      id: "tt-may-2026",
      platform: "TikTok",
      period: "May 2026",
      gross: 480,
      fee: 48,
      creator: 432,
      source: "Report import",
      status: state.revenue.mandateActive ? "Auto-collect scheduled" : "Mandate needed",
    });
  }

  const tiktok = state.revenue.sources.find((source) => source.id === "tiktok");
  if (tiktok) {
    tiktok.connected = true;
    tiktok.sync = "Report imported";
  }

  saveRevenueState();
  renderRevenueCollection();
  showToast(existing ? "Latest revenue report already imported." : "Revenue report imported.");
}

async function handleFeedbackSubmit(event) {
  event.preventDefault();
  const note = $("#feedbackText").value.trim();
  const feedbackError = $("#feedbackError");

  if (note.length < 4) {
    feedbackError.textContent = "Add a little more detail before submitting.";
    return;
  }

  const feedback = {
    page: $("#feedbackPage").value,
    type: document.querySelector('input[name="feedbackType"]:checked')?.value || "Idea",
    note,
    contact: $("#feedbackContact").value.trim(),
  };

  try {
    const payload = await apiJson("/api/feedback", {
      method: "POST",
      body: JSON.stringify(feedback),
    });
    saveStoredFeedback(payload.items || [payload.feedback, ...getStoredFeedback()].filter(Boolean));
    renderFeedbackSummary();
    closeFeedbackModal();
    showToast("Feedback submitted to the shared tester inbox.");
  } catch (error) {
    const now = new Date();
    const localFeedback = {
      id: crypto.randomUUID(),
      ...feedback,
      createdAt: now.toISOString(),
      timeLabel: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    saveStoredFeedback([localFeedback, ...getStoredFeedback()]);
    renderFeedbackSummary();
    closeFeedbackModal();
    showToast("Feedback saved locally. Server inbox is unavailable.");
  }
}

function syncEpisodeToWorkspace(episode) {
  if (!episode) return;
  $("#episodeTitle").value = episode.title;
  $("#audienceInput").value = episode.audience;
  $("#episodeAngle").value = episode.goal;
  $("#formatSelect").value = episode.format;
  state.mode = episode.type;
  $$(".mode-button").forEach((item) => item.classList.toggle("active", item.dataset.mode === episode.type));
  $(".cover-preview strong").textContent = episode.title;
  $("#reviewEpisodeTitle").textContent = episode.title;
  $("#reviewLink").textContent = `podforge.review/${episode.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  packageSummary.textContent = `${episode.title}: ready for production setup`;
}

function selectEpisode(id) {
  state.selectedEpisodeId = id;
  const episode = selectedEpisode();
  syncEpisodeToWorkspace(episode);
  updateWorkflow(episode.stage, false);
  renderEpisodes();
}

function advanceEpisode(id) {
  const episode = state.episodes.find((item) => item.id === id);
  if (!episode) return;
  const nextStage = nextPipelineStage(episode.stage);
  state.selectedEpisodeId = episode.id;
  episode.stage = nextStage;
  episode.status = stageToStatus(nextStage);
  saveStoredEpisodes();
  syncEpisodeToWorkspace(episode);
  updateWorkflow(nextStage);
}

function renderEpisodes() {
  const episodeGrid = $("#episodeGrid");
  const episodes = visibleEpisodes();

  if (!episodes.length) {
    episodeGrid.innerHTML = `
      <div class="empty-state pipeline-empty">
        No episodes match the current pipeline view.
      </div>
    `;
    renderStudioMetrics();
    renderPipelineSummary();
    renderPipelineControls();
    return;
  }

  episodeGrid.innerHTML = episodes
    .map(
      (episode) => {
        const progress = episodeProgress(episode);
        const readiness = episodeReadiness(episode);
        const nextStage = nextPipelineStage(episode.stage);
        const isFinalStage = nextStage === episode.stage;

        return `
        <article class="episode-card ${episode.id === state.selectedEpisodeId ? "selected" : ""}" data-episode-id="${episode.id}" style="--progress: ${progress}%">
          <div class="episode-card-top">
            <span class="episode-status ${statusClass(episode.status)}">${escapeHtml(episode.status)}</span>
            <span class="episode-readiness">${readiness}% ready</span>
          </div>
          <h3>${escapeHtml(episode.title)}</h3>
          <p>${escapeHtml(episode.goal)}</p>
          <div class="episode-progress" aria-hidden="true"><span></span></div>
          <dl class="episode-details">
            <div><dt>Guest</dt><dd>${escapeHtml(episode.guest || "Solo")}</dd></div>
            <div><dt>Audience</dt><dd>${escapeHtml(episode.audience || "General")}</dd></div>
            <div><dt>Next</dt><dd>${escapeHtml(stageActions[episode.stage] || "Review")}</dd></div>
          </dl>
          <div class="episode-card-footer">
            <span>${escapeHtml(episode.format)}</span>
            <span>${episode.type === "audio" ? "Audio only" : "Video podcast"}</span>
            <span>${escapeHtml(episode.target)}</span>
          </div>
          <div class="episode-actions">
            <button class="secondary-button compact" type="button" data-episode-select="${episode.id}">Open</button>
            <button class="ghost-button compact" type="button" data-episode-next="${episode.id}" ${isFinalStage ? "disabled" : ""}>${isFinalStage ? "Complete" : `Move to ${nextStage}`}</button>
          </div>
        </article>
      `;
      },
    )
    .join("");

  $$("[data-episode-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      selectEpisode(card.dataset.episodeId);
    });
  });

  $$("[data-episode-select]").forEach((button) => {
    button.addEventListener("click", () => selectEpisode(button.dataset.episodeSelect));
  });

  $$("[data-episode-next]").forEach((button) => {
    button.addEventListener("click", () => advanceEpisode(button.dataset.episodeNext));
  });

  renderStudioMetrics();
  renderPipelineSummary();
  renderPipelineControls();
}

function openEpisodeModal() {
  $("#episodeError").textContent = "";
  $("#episodeForm").reset();
  $("#newEpisodeTitle").value = "";
  $("#newEpisodeAudience").value = $("#audienceInput").value || "";
  $("#newEpisodeGoal").value = "";
  $("#newEpisodeGuest").value = "";
  $("#newEpisodeFormat").value = $("#formatSelect").value || "Interview";
  $("#newEpisodeType").value = state.mode;
  $("#newEpisodeStage").value = "Idea";
  $("#episodeModal").hidden = false;
  $("#newEpisodeTitle").focus();
}

function closeEpisodeModal() {
  $("#episodeModal").hidden = true;
}

function handleEpisodeSubmit(event) {
  event.preventDefault();
  const title = $("#newEpisodeTitle").value.trim();
  const audience = $("#newEpisodeAudience").value.trim();
  const goal = $("#newEpisodeGoal").value.trim();

  if (title.length < 3) {
    $("#episodeError").textContent = "Add an episode title.";
    return;
  }

  if (audience.length < 3) {
    $("#episodeError").textContent = "Add the audience this episode is for.";
    return;
  }

  if (goal.length < 8) {
    $("#episodeError").textContent = "Add a clear goal or angle for this episode.";
    return;
  }

  const stage = $("#newEpisodeStage").value;
  const episode = {
    id: crypto.randomUUID(),
    title,
    status: stageToStatus(stage),
    format: $("#newEpisodeFormat").value,
    type: $("#newEpisodeType").value,
    audience,
    goal,
    guest: $("#newEpisodeGuest").value.trim(),
    target: $("#newEpisodeTarget").value,
    stage,
  };

  state.episodes.unshift(episode);
  state.selectedEpisodeId = episode.id;
  saveStoredEpisodes();
  renderEpisodes();
  syncEpisodeToWorkspace(episode);
  updateWorkflow(stage, false);
  closeEpisodeModal();
  showToast("Episode created and added to Pipeline.");
}

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getStoredAccount() {
  try {
    return JSON.parse(localStorage.getItem(accountStorageKey));
  } catch (error) {
    return null;
  }
}

function saveStoredAccount(account) {
  localStorage.setItem(accountStorageKey, JSON.stringify(account));
}

function initialsFromName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "P") + (parts[1]?.[0] || parts[0]?.[1] || "F");
}

function validateAccountFields({ fullName, phone, email, password, verifyPassword, termsAccepted }, requirePassword = true) {
  const phoneDigits = phone.replace(/\D/g, "");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (fullName.trim().split(/\s+/).length < 2) return "Enter a first and last name.";
  if (phoneDigits.length < 10) return "Enter a valid phone number.";
  if (!emailPattern.test(email)) return "Enter a valid email address.";
  if (requirePassword && password.length < 8) return "Password must be at least 8 characters.";
  if (requirePassword && password !== verifyPassword) return "Passwords do not match.";
  if (requirePassword && !termsAccepted) return "You must agree to the Terms and Services.";
  return "";
}

function populateAccount(account) {
  if (!account) return;
  $("#sidebarAccountName").textContent = account.fullName;
  $("#sidebarAccountEmail").textContent = account.email;
  $("#accountAvatar").textContent = initialsFromName(account.fullName).toUpperCase();
  $("#accountName").value = account.fullName;
  $("#accountPhone").value = account.phone;
  $("#accountEmail").value = account.email;
  $("#termsAcceptedAt").textContent = `Accepted ${new Date(account.termsAcceptedAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function unlockApp(account) {
  document.body.classList.remove("auth-locked");
  populateAccount(account);
  routeToPage();
}

function requireAccount() {
  const account = getStoredAccount();
  if (account?.termsAccepted) {
    unlockApp(account);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const signupError = $("#signupError");
  const values = {
    fullName: $("#signupName").value.trim(),
    phone: $("#signupPhone").value.trim(),
    email: $("#signupEmail").value.trim(),
    password: $("#signupPassword").value,
    verifyPassword: $("#signupPasswordVerify").value,
    termsAccepted: $("#termsAgreement").checked,
  };
  const error = validateAccountFields(values);

  if (error) {
    signupError.textContent = error;
    return;
  }

  const account = {
    id: crypto.randomUUID(),
    fullName: values.fullName,
    phone: values.phone,
    email: values.email,
    passwordHash: await hashPassword(values.password),
    termsAccepted: true,
    termsAcceptedAt: new Date().toISOString(),
    revenueSharePercent: 10,
  };

  saveStoredAccount(account);
  signupError.textContent = "";
  $("#signupForm").reset();
  unlockApp(account);
  showToast("Account created. Welcome to PodForge.");
}

function handleAccountSave(event) {
  event.preventDefault();
  const current = getStoredAccount();
  if (!current) return;

  const values = {
    fullName: $("#accountName").value.trim(),
    phone: $("#accountPhone").value.trim(),
    email: $("#accountEmail").value.trim(),
    password: "",
    verifyPassword: "",
    termsAccepted: true,
  };
  const error = validateAccountFields(values, false);

  if (error) {
    showToast(error);
    return;
  }

  const updated = {
    ...current,
    fullName: values.fullName,
    phone: values.phone,
    email: values.email,
  };
  saveStoredAccount(updated);
  populateAccount(updated);
  showToast("Account updated.");
}

function signOut() {
  document.body.classList.add("auth-locked");
  showToast("Signed out of this prototype.");
}

function resetPrototypeAccount() {
  localStorage.removeItem(accountStorageKey);
  document.body.classList.add("auth-locked");
  $("#signupForm").reset();
}

function pageList(element) {
  return (element.dataset.page || "")
    .split(" ")
    .map((page) => page.trim())
    .filter(Boolean);
}

function routeToPage(page = window.location.hash.replace("#", "") || "pipeline") {
  const currentPage = validPages.includes(page) ? page : "pipeline";
  const content = pageCopy[currentPage];

  $$(".app-page").forEach((section) => {
    const isActive = pageList(section).includes(currentPage);
    section.classList.toggle("active", isActive);
  });

  $$("[data-panel-page]").forEach((panel) => {
    const panelPages = (panel.dataset.panelPage || "").split(" ");
    panel.hidden = !panelPages.includes(currentPage);
  });

  $$(".nav-list a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${currentPage}`);
  });

  document.body.dataset.currentPage = currentPage;
  $(".studio-grid")?.classList.toggle("single-page", currentPage !== "studio");
  $(".review-analytics-grid")?.classList.toggle("single-page", currentPage !== "analytics" && currentPage !== "review" ? false : true);
  $(".topbar h1").textContent = content.title;
  $(".topbar-copy").textContent = content.copy;
  document.title = `PodForge Studio - ${currentPage[0].toUpperCase()}${currentPage.slice(1)}`;
}

function setStatus(label, live = false) {
  sessionStatus.textContent = label;
  sessionStatus.classList.toggle("live", live);
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mimeForMode() {
  if (state.mode === "audio") {
    return MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  }

  return MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
}

async function enableDevices() {
  if (state.stream) return state.stream;

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: state.mode === "video",
      audio: true,
    });
    cameraPreview.srcObject = state.stream;
    await cameraPreview.play();
    cameraPreview.classList.toggle("active", state.mode === "video");
    previewPlaceholder.style.display = state.mode === "video" ? "none" : "grid";
    setupAudioMeter(state.stream);
    setStatus("Devices ready");
    showToast("Camera and microphone are ready.");
    return state.stream;
  } catch (error) {
    setStatus("Permission needed");
    showToast("Device access was blocked or unavailable.");
    throw error;
  }
}

function stopDevices() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  cameraPreview.srcObject = null;
  cameraPreview.classList.remove("active");
  previewPlaceholder.style.display = "grid";
  cancelAnimationFrame(state.animationId);
}

function setupAudioMeter(stream) {
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }

  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 128;
  source.connect(state.analyser);
  drawMeter();
}

function drawMeter() {
  const width = audioMeter.width;
  const height = audioMeter.height;
  const bars = new Uint8Array(state.analyser?.frequencyBinCount || 32);

  if (state.analyser) {
    state.analyser.getByteFrequencyData(bars);
  }

  meterContext.clearRect(0, 0, width, height);
  meterContext.fillStyle = "rgba(255, 255, 255, 0.14)";
  meterContext.fillRect(0, 0, width, height);

  const gap = 4;
  const barWidth = width / bars.length - gap;
  bars.forEach((value, index) => {
    const barHeight = Math.max(8, (value / 255) * height);
    meterContext.fillStyle = index % 3 === 0 ? "#f0c95f" : "#f7fff9";
    meterContext.fillRect(index * (barWidth + gap), height - barHeight, barWidth, barHeight);
  });

  state.animationId = requestAnimationFrame(drawMeter);
}

async function startRecording() {
  const stream = await enableDevices();
  state.chunks = [];
  const mimeType = mimeForMode();
  state.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  state.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) state.chunks.push(event.data);
  });

  state.recorder.addEventListener("stop", () => {
    const type = state.mode === "audio" ? "audio/webm" : "video/webm";
    const blob = new Blob(state.chunks, { type });
    const url = URL.createObjectURL(blob);
    addAsset({
      title: `${$("#episodeTitle").value || "Untitled Episode"} raw ${state.mode}`,
      type: "Raw",
      detail: `${state.mode.toUpperCase()} recording saved at ${formatTime()}`,
      url,
      size: blob.size,
      mediaKind: state.mode,
      mimeType: blob.type,
    });
    runEditPipeline();
  });

  state.recorder.start();
  state.isRecording = true;
  recordButton.classList.add("recording");
  recordButton.setAttribute("aria-label", "Stop recording");
  setStatus("Recording", true);
}

function stopRecording() {
  if (!state.recorder || state.recorder.state === "inactive") return;
  state.recorder.stop();
  state.isRecording = false;
  recordButton.classList.remove("recording");
  recordButton.setAttribute("aria-label", "Start recording");
  setStatus("Processing");
}

function addAsset(asset) {
  const nextAsset = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    mediaKind: asset.mediaKind || (asset.mimeType || "").split("/")[0] || "",
    ...asset,
  };
  state.assets.unshift(nextAsset);
  renderAssets();
  return nextAsset;
}

function assetIsAudio(asset) {
  if (asset.mediaKind === "audio") return true;
  if (asset.mediaKind === "video") return false;
  if (String(asset.mimeType || "").startsWith("audio/")) return true;
  if (String(asset.mimeType || "").startsWith("video/")) return false;
  return /audio/i.test(asset.detail || "") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(asset.title || "");
}

function assetBadge(asset) {
  if (asset.type === "Final") return "PK";
  return assetIsAudio(asset) ? "AU" : "VD";
}

function selectAsset(id, options = {}) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) return;

  if (options.reveal && window.location.hash !== "#library") {
    window.location.hash = "library";
  }

  const player = $("#assetPlayer");
  const audio = $("#assetAudioPlayer");
  const video = $("#assetVideoPlayer");
  const activePlayer = assetIsAudio(asset) ? audio : video;
  player.querySelector("strong").textContent = asset.title;
  player.querySelector("p").textContent = asset.url
    ? `${asset.detail} ${asset.size ? `- ${formatBytes(asset.size)}` : ""}`
    : "This prototype asset has no playable media attached yet.";
  audio.pause();
  video.pause();
  audio.hidden = true;
  video.hidden = true;
  audio.removeAttribute("src");
  video.removeAttribute("src");
  audio.load();
  video.load();

  if (asset.url && assetIsAudio(asset)) {
    audio.src = asset.url;
    audio.hidden = false;
  } else if (asset.url) {
    video.src = asset.url;
    video.hidden = false;
  }

  $$(".asset-item, .recent-item").forEach((item) => item.classList.toggle("selected", item.dataset.assetId === id));

  if (!asset.url) {
    showToast("This asset does not have playable media yet.");
    return;
  }

  activePlayer.load();
  if (options.autoplay) {
    activePlayer.play().then(() => showToast(`Playing ${assetIsAudio(asset) ? "audio" : "video"} recording.`)).catch(() => {
      showToast("Recording is loaded. Press play in the media player.");
    });
  } else {
    showToast("Recording loaded in the Library player.");
  }
}

function renameAsset(id) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) return;
  const nextTitle = window.prompt("Rename recording", asset.title);
  if (!nextTitle?.trim()) return;
  asset.title = nextTitle.trim();
  renderAssets();
  selectAsset(id);
  showToast("Recording renamed.");
}

function deleteAsset(id) {
  const asset = state.assets.find((item) => item.id === id);
  if (asset?.url) URL.revokeObjectURL(asset.url);
  state.assets = state.assets.filter((item) => item.id !== id);
  renderAssets();
  showToast("Recording removed from this session.");
}

function sendAssetToEdit(id) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) return;
  packageSummary.textContent = `${asset.title}: queued for auto-edit`;
  window.location.hash = "editor";
  showToast("Recording sent to Auto Edit.");
}

function bindAssetActions() {
  $$("[data-asset-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const { assetAction, assetId } = button.dataset;
      if (assetAction === "play") selectAsset(assetId, { autoplay: true, reveal: Boolean(button.closest(".recent-item")) });
      if (assetAction === "rename") renameAsset(assetId);
      if (assetAction === "delete") deleteAsset(assetId);
      if (assetAction === "edit") sendAssetToEdit(assetId);
    });
  });
}

function renderAssets() {
  assetCount.textContent = `${state.assets.length} ${state.assets.length === 1 ? "file" : "files"}`;
  renderRecentRecordings();

  if (!state.assets.length) {
    assetList.innerHTML = '<div class="empty-state">Record or import media to start building the episode package.</div>';
    bindAssetActions();
    return;
  }

  assetList.innerHTML = state.assets
    .map(
      (asset) => `
        <article class="asset-item" data-asset-id="${asset.id}">
          <div>
            <strong>${escapeHtml(asset.title)}</strong>
            <span>${escapeHtml(asset.detail)} ${asset.size ? `- ${formatBytes(asset.size)}` : ""}</span>
          </div>
          <div class="asset-actions">
            <span class="asset-tag">${asset.type}</span>
            <button type="button" data-asset-action="play" data-asset-id="${asset.id}">Play</button>
            <button type="button" data-asset-action="rename" data-asset-id="${asset.id}">Rename</button>
            <button type="button" data-asset-action="edit" data-asset-id="${asset.id}">Edit</button>
            <button type="button" data-asset-action="delete" data-asset-id="${asset.id}">Delete</button>
          </div>
        </article>
      `,
    )
    .join("");
  bindAssetActions();
}

function renderRecentRecordings() {
  const recentAssets = state.assets.filter((asset) => asset.type === "Raw").slice(0, 4);

  if (!recentAssets.length) {
    recentRecordingsList.innerHTML = '<div class="empty-state compact-empty">New recordings and imports will appear here.</div>';
    return;
  }

  recentRecordingsList.innerHTML = recentAssets
    .map(
      (asset) => `
        <article class="recent-item" data-asset-id="${asset.id}">
          <span class="recent-icon">${assetBadge(asset)}</span>
          <div>
            <strong>${escapeHtml(asset.title)}</strong>
            <small>${escapeHtml(asset.detail)} ${asset.size ? `- ${formatBytes(asset.size)}` : ""}</small>
          </div>
          <button type="button" data-asset-action="play" data-asset-id="${asset.id}">Play</button>
        </article>
      `,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

async function runEditPipeline() {
  const runId = ++state.editRun;
  const steps = $$("#pipelineSteps li");
  steps.forEach((step) => step.classList.remove("active", "done"));
  setStatus("Auto editing");

  for (const step of steps) {
    if (runId !== state.editRun) return;
    step.classList.add("active");
    await delay(650);
    step.classList.remove("active");
    step.classList.add("done");
  }

  const enabledSettings = $$("[data-setting]:checked").map((input) => input.dataset.setting);
  const title = $("#episodeTitle").value || "Untitled Episode";
  addAsset({
    title: `${title} finished package`,
    type: "Final",
    detail: `${state.mode.toUpperCase()} master with ${enabledSettings.join(", ")}`,
    size: 0,
  });
  packageSummary.textContent = `${title}: ${state.mode}, clips, captions, and platform exports`;
  publishStatus.textContent = "Finished package is ready for connected platform upload.";
  renderEditResults(true);
  setStatus("Ready to publish");
  showToast("Finished episode package created.");
}

function renderEditResults(ready = false) {
  const title = $("#episodeTitle").value || "Untitled Episode";
  const outputs = [
    ["Full Episode", ready ? "Ready" : "Not generated", `${state.mode === "audio" ? "Audio" : "Landscape video"} master for ${title}.`],
    ["Vertical Clips", ready ? "3 clips ready" : "Not generated", "TikTok/Reels/Shorts exports with captions."],
    ["Captions", ready ? "SRT ready" : "Not generated", "Caption track plus burned-in social captions."],
    ["Thumbnail", ready ? "Draft ready" : "Not generated", "Brand kit image for video platforms."],
    ["Chapters", ready ? "6 chapters" : "Not generated", "Publish-ready chapter timestamps."],
    ["Audio Polish", ready ? "Normalized" : "Not generated", "Cleaned, leveled, loudness-normalized mix."],
  ];

  $("#resultsGrid").innerHTML = outputs
    .map(
      ([name, status, description]) => `
        <article class="${ready ? "ready" : ""}">
          <span>${name}</span>
          <strong>${status}</strong>
          <p>${description}</p>
          <button type="button">${ready ? "Preview" : "Waiting"}</button>
        </article>
      `,
    )
    .join("");
}

function generateResults() {
  renderEditResults(true);
  window.location.hash = "results";
  showToast("Auto-edit results generated.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toggleLive() {
  state.isLive = !state.isLive;
  if (state.isLive) {
    enableDevices().then(() => {
      liveButton.textContent = "End Live";
      setStatus(`${state.mode === "video" ? "Video" : "Audio"} live`, true);
      showToast("Live room started. Real RTMP/WebRTC routing comes next.");
    });
    return;
  }

  liveButton.textContent = "Go Live";
  setStatus("Live ended");
  showToast("Live room ended and archived to raw assets.");
  addAsset({
    title: `${$("#episodeTitle").value || "Untitled Episode"} live archive`,
    type: "Raw",
    detail: `${state.mode.toUpperCase()} live session archive at ${formatTime()}`,
    size: 0,
  });
}

function publishAll() {
  const selected = $$("#platformGrid input:checked").map((input) => input.dataset.platform);
  if (!state.assets.some((asset) => asset.type === "Final")) {
    showToast("Create a finished package before uploading.");
    return;
  }
  publishStatus.textContent = `Queued upload to ${selected.join(", ")}.`;
  showToast(`Upload queue prepared for ${selected.length} platform${selected.length === 1 ? "" : "s"}.`);
}

function generateRundown() {
  const angle = $("#episodeAngle").value || "A practical creator story";
  const sponsor = $("#sponsorInput").value || "Sponsor read";
  const format = $("#formatSelect").value;
  const audience = $("#audienceInput").value || "listeners";
  const rundown = [
    ["00:00", `Cold open: strongest claim about ${angle.toLowerCase()}`],
    ["01:15", `${format} intro and promise for ${audience}`],
    ["06:00", "Origin story, tension, and proof points"],
    ["14:30", "Tactical segment with examples and creator tools"],
    ["23:00", sponsor],
    ["29:00", "Clip-worthy quote, recap, and platform call-to-action"],
  ];

  $("#rundownList").innerHTML = rundown
    .map(([time, item]) => `<li><span>${time}</span>${escapeHtml(item)}</li>`)
    .join("");
  showToast("Rundown regenerated for this episode.");
}

function updateWorkflow(stepName, announce = true) {
  $$(".workflow-step").forEach((step) => {
    step.classList.toggle("active", step.dataset.workflowStep === stepName);
  });
  const episode = selectedEpisode();
  if (episode) {
    episode.stage = stepName;
    episode.status = stageToStatus(stepName);
    saveStoredEpisodes();
    renderEpisodes();
  }
  if (announce) showToast(`Pipeline moved to ${stepName}.`);
}

function updateReviewScore() {
  const items = $$(".review-list input");
  const ready = items.filter((item) => item.checked).length;
  reviewScore.textContent = `${ready}/${items.length} ready`;
}

function applyBrand(brand) {
  const preview = $(".cover-preview");
  const styles = {
    coral: "linear-gradient(135deg, #d83b55, #2563eb 56%, #0ea5a4)",
    teal: "linear-gradient(135deg, #0ea5a4, #dff3ff 54%, #121826)",
    violet: "linear-gradient(135deg, #7c3aed, #2563eb 58%, #121826)",
    yellow: "linear-gradient(135deg, #f59e0b, #49c7c3 56%, #2563eb)",
  };
  preview.style.background = styles[brand] || styles.coral;
  $$(".swatch").forEach((swatch) => swatch.classList.toggle("active", swatch.dataset.brand === brand));
}

function heatLevel(value) {
  if (value >= 85) return 5;
  if (value >= 70) return 4;
  if (value >= 55) return 3;
  if (value >= 40) return 2;
  return 1;
}

function heatScore(cell) {
  return typeof cell === "object" ? Number(cell.score || 0) : Number(cell || 0);
}

function heatPlatform(cell) {
  return typeof cell === "object" ? String(cell.platform || "All") : "All";
}

function renderAudienceHeatmap() {
  const heatmap = $("#audienceHeatmap");
  if (!heatmap) return;

  $("#audiencePeakPill").textContent = audienceHeatmapData.peak;
  heatmap.innerHTML = `
    <div class="heatmap-corner">Day</div>
    ${audienceHeatmapData.slots.map((slot) => `<div class="heatmap-axis">${escapeHtml(slot)}</div>`).join("")}
    ${audienceHeatmapData.cells
      .map(
        (row) => `
          <div class="heatmap-day">${escapeHtml(row.day)}</div>
          ${row.values
            .map(
              (cell, index) => {
                const value = heatScore(cell);
                const platform = heatPlatform(cell);
                return `
                <div class="heat-cell level-${heatLevel(value)}" title="${escapeHtml(row.day)} ${escapeHtml(audienceHeatmapData.slots[index])}: ${value}% on ${escapeHtml(platform)}">
                  <strong>${value}%</strong>
                  <small>${escapeHtml(platform)}</small>
                </div>
              `;
              },
            )
            .join("")}
        `,
      )
      .join("")}
  `;

  $("#audienceHeatmapInsights").innerHTML = audienceHeatmapData.insights
    .map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join("");
}

function refreshAnalytics() {
  const views = `${(16 + Math.random() * 8).toFixed(1)}K`;
  const retention = `${Math.round(58 + Math.random() * 16)}%`;
  const revenue = `$${Math.round(240 + Math.random() * 180)}`;

  $("#viewsMetric").textContent = views;
  $("#retentionMetric").textContent = retention;
  $("#revenueMetric").textContent = revenue;
  renderAudienceHeatmap();
  loadSharedFeedback();
  showToast("Analytics refreshed.");
}

function runDeviceCheck() {
  const labels = ["Ready", "Clean", "Ready", "Stable"];
  ["#cameraCheck", "#micCheck", "#storageCheck", "#networkCheck"].forEach((selector, index) => {
    const item = $(selector);
    item.textContent = labels[index];
    item.classList.add("ready");
  });
  showToast("Device check passed.");
}

function renderClipQueue(clips) {
  const queue = $("#clipQueue");
  if (!clips.length) {
    queue.innerHTML = '<div class="empty-state compact-empty">Generated clips will appear here.</div>';
    return;
  }
  queue.innerHTML = clips
    .map((clip) => `<article class="clip-item"><strong>${escapeHtml(clip)}</strong><span>Vertical clip draft</span></article>`)
    .join("");
}

function makeClip(label) {
  const existing = $$("#clipQueue .clip-item strong").map((item) => item.textContent);
  renderClipQueue([label, ...existing].slice(0, 5));
  showToast("Clip added to queue.");
}

function findClips() {
  renderClipQueue(["Content engine quote", "Workflow setup", "Edit package"]);
  showToast("Best transcript moments found.");
}

function checkPlatforms() {
  $$("#platformChecklist article").forEach((card) => {
    const status = card.querySelector("em");
    if (status.textContent !== "Optional") status.textContent = "Ready";
  });
  publishStatus.textContent = "All primary platforms are publish-ready.";
  showToast("Platform readiness checked.");
}

function copyReviewLink() {
  const link = $("#reviewLink").textContent;
  navigator.clipboard?.writeText(`https://${link}`).catch(() => {});
  showToast("Review link ready to share.");
}

function exportBackendPlan() {
  showToast("Backend blueprint marked for implementation.");
}

$$(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.isRecording) return showToast("Stop recording before changing modes.");
    state.mode = button.dataset.mode;
    $$(".mode-button").forEach((item) => item.classList.toggle("active", item === button));
    stopDevices();
    setStatus(state.mode === "video" ? "Video mode" : "Audio mode");
  });
});

deviceButton.addEventListener("click", enableDevices);
recordButton.addEventListener("click", () => (state.isRecording ? stopRecording() : startRecording()));
liveButton.addEventListener("click", toggleLive);
$("#runEditButton").addEventListener("click", runEditPipeline);
$("#publishButton").addEventListener("click", publishAll);
$("#publishTopButton").addEventListener("click", publishAll);
$("#saveDraftButton").addEventListener("click", () => showToast("Workspace draft saved locally."));
$("#newEpisodeButton").addEventListener("click", openEpisodeModal);
$("#newEpisodeTopButton").addEventListener("click", openEpisodeModal);
$("#newEpisodePipelineButton").addEventListener("click", openEpisodeModal);
$("#episodeSearchInput").addEventListener("input", (event) => {
  state.pipelineSearch = event.target.value;
  renderEpisodes();
});
$("#episodeStageFilter").addEventListener("change", (event) => {
  state.pipelineStageFilter = event.target.value;
  renderEpisodes();
});
$("#clearPipelineFiltersButton").addEventListener("click", () => {
  state.pipelineSearch = "";
  state.pipelineStageFilter = "All";
  renderEpisodes();
});
$("#generateRundownButton").addEventListener("click", generateRundown);
$("#inviteGuestButton").addEventListener("click", () => {
  $("#guestInviteLink").textContent = `podforge.test/guest/${crypto.randomUUID().slice(0, 8)}`;
  showToast("Guest invite link generated.");
});
$("#applyBrandButton").addEventListener("click", () => showToast(`${$("#captionStyle").value} applied to exports.`));
$("#refreshAnalyticsButton").addEventListener("click", refreshAnalytics);
$("#runDeviceCheckButton").addEventListener("click", runDeviceCheck);
$("#generateResultsButton").addEventListener("click", generateResults);
$("#findClipsButton").addEventListener("click", findClips);
$("#checkPlatformsButton").addEventListener("click", checkPlatforms);
$("#activateCollectionButton").addEventListener("click", activateRevenueCollection);
$("#collectFeesButton").addEventListener("click", collectDueFees);
$("#importReportButton").addEventListener("click", importRevenueReport);
$("#mandateCheck").addEventListener("change", updateRevenueMandate);
$("#billingMethodSelect").addEventListener("change", updateRevenueMandate);
$("#copyReviewLinkButton").addEventListener("click", copyReviewLink);
$("#exportBackendPlanButton").addEventListener("click", exportBackendPlan);
$("#signupForm").addEventListener("submit", handleSignup);
$("#accountForm").addEventListener("submit", handleAccountSave);
$("#signOutButton").addEventListener("click", signOut);
$("#resetAccountButton").addEventListener("click", resetPrototypeAccount);
$("#feedbackFab").addEventListener("click", openFeedbackModal);
$("#closeFeedbackButton").addEventListener("click", closeFeedbackModal);
$("#cancelFeedbackButton").addEventListener("click", closeFeedbackModal);
$("#feedbackForm").addEventListener("submit", handleFeedbackSubmit);
$("#feedbackModal").addEventListener("click", (event) => {
  if (event.target === $("#feedbackModal")) closeFeedbackModal();
});
$("#closeEpisodeButton").addEventListener("click", closeEpisodeModal);
$("#cancelEpisodeButton").addEventListener("click", closeEpisodeModal);
$("#episodeForm").addEventListener("submit", handleEpisodeSubmit);
$("#episodeModal").addEventListener("click", (event) => {
  if (event.target === $("#episodeModal")) closeEpisodeModal();
});

$$(".workflow-step").forEach((step) => {
  step.addEventListener("click", () => updateWorkflow(step.dataset.workflowStep));
});

$$(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => applyBrand(swatch.dataset.brand));
});

$$(".review-list input").forEach((input) => {
  input.addEventListener("change", updateReviewScore);
});

$$("[data-clip]").forEach((button) => {
  button.addEventListener("click", () => makeClip(button.dataset.clip));
});

window.addEventListener("hashchange", () => routeToPage());

importInput.addEventListener("change", (event) => {
  Array.from(event.target.files || []).forEach((file) => {
    addAsset({
      title: file.name,
      type: "Raw",
      detail: `Imported ${file.type.startsWith("audio") ? "audio" : "video"} footage`,
      url: URL.createObjectURL(file),
      size: file.size,
      mediaKind: file.type.startsWith("audio") ? "audio" : "video",
      mimeType: file.type,
    });
  });
  if (event.target.files?.length) runEditPipeline();
  event.target.value = "";
});

state.episodes = getStoredEpisodes();
state.selectedEpisodeId = state.episodes[0]?.id || "";
state.revenue = getStoredRevenue();
renderEpisodes();
syncEpisodeToWorkspace(selectedEpisode());
updateWorkflow(selectedEpisode()?.stage || "Idea", false);
renderAssets();
updateReviewScore();
renderAudienceHeatmap();
renderFeedbackSummary();
loadSharedFeedback();
renderEditResults(false);
renderRevenueCollection();
loadRevenueBackendConfig();
requireAccount();
routeToPage();
