const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const toast = $("#adminToast");
const adminState = {
  analytics: null,
  feedback: [],
  search: "",
  statusFilter: "all",
};

const userStatuses = ["Active", "Review", "Past due", "Suspended"];
const feedbackStatuses = ["New", "Reviewing", "Planned", "Fixed", "Deferred"];
const priorities = ["Low", "Normal", "High", "Critical"];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Admin request failed.");
  return payload;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toneClass(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("overdue") || text.includes("failed") || text.includes("high") || text.includes("suspended") || text.includes("critical")) return "danger";
  if (text.includes("collected") || text.includes("connected") || text.includes("published") || text.includes("ready") || text.includes("active") || text.includes("fixed") || text.includes("native")) return "ready";
  if (text.includes("scheduled") || text.includes("due") || text.includes("queued") || text.includes("partial") || text.includes("review") || text.includes("planned")) return "warning";
  return "";
}

function heatLevel(value) {
  if (value >= 90) return 5;
  if (value >= 76) return 4;
  if (value >= 60) return 3;
  if (value >= 45) return 2;
  return 1;
}

function heatScore(cell) {
  return typeof cell === "object" ? Number(cell.score || 0) : Number(cell || 0);
}

function heatPlatform(cell) {
  return typeof cell === "object" ? String(cell.platform || "All") : "All";
}

function heatSegment(cell) {
  return typeof cell === "object" ? String(cell.segment || "") : "";
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
  return labels[page] || page || "Unknown";
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function optionHtml(options, selectedValue) {
  return options
    .map((option) => `<option value="${escapeHtml(option)}" ${option === selectedValue ? "selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
}

function searchableText(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "object") return Object.values(value).map(searchableText).join(" ");
  return String(value);
}

function matchesSearch(item) {
  if (!adminState.search) return true;
  return searchableText(item).toLowerCase().includes(adminState.search);
}

function selectedFilter() {
  return adminState.statusFilter;
}

function renderSummary(analytics) {
  const summary = analytics.summary || {};
  const mode = titleCase(analytics.mode || "simulation");

  setText("#adminModePill", mode);
  setText("#activeCreatorsMetric", formatNumber(summary.activeCreators));
  setText("#creatorTotalMetric", `${formatNumber(summary.creatorsTotal)} total accounts`);
  setText("#totalUploadsMetric", formatNumber(summary.totalUploads));
  setText("#uploadsTodayMetric", `${formatNumber(summary.uploadsToday)} today`);
  setText("#grossRevenueMetric", formatMoney(summary.grossRevenueTracked));
  setText("#podforgeFeeMetric", formatMoney(summary.podforgeFeeTracked));
  setText("#scheduledRevenueMetric", formatMoney(summary.scheduled));
  setText("#overdueRevenueMetric", `${formatMoney(summary.overdue)} overdue`);
  setText("#collectionSuccessMetric", `${summary.collectionSuccessRate || 0}%`);
  setText("#connectedPlatformsMetric", `${formatNumber(summary.connectedPlatforms)} platform links`);
}

function renderUsers(users) {
  const filter = selectedFilter();
  const filteredUsers = (Array.isArray(users) ? users : []).filter((user) => {
    const statusMatch = !userStatuses.includes(filter) || user.status === filter;
    return statusMatch && matchesSearch(user);
  });

  setText("#userCountPill", `${filteredUsers.length} users`);
  const list = $("#adminUserList");
  if (!filteredUsers.length) {
    list.innerHTML = '<div class="empty-state">No creator accounts match the current filters.</div>';
    return;
  }

  list.innerHTML = `
    <div class="table-row table-head">
      <span>Creator</span>
      <span>Status</span>
      <span>Billing</span>
      <span>Platforms</span>
      <span>Revenue</span>
      <span>Admin action</span>
    </div>
    ${filteredUsers
      .map(
        (user) => `
          <article class="table-row" data-user-row="${escapeHtml(user.id)}">
            <div>
              <strong>${escapeHtml(user.fullName)}</strong>
              <small>${escapeHtml(user.email)} - ${escapeHtml(user.phone || "No phone")}</small>
              <small>Joined ${escapeHtml(formatDateTime(user.joinedAt))} - Last active ${escapeHtml(formatDateTime(user.lastActiveAt))}</small>
            </div>
            <div>
              <span class="status-pill ${toneClass(user.status)}">${escapeHtml(user.status)}</span>
              <small>${escapeHtml(user.plan)} plan - ${escapeHtml(user.risk)} risk</small>
            </div>
            <div>
              <strong>${escapeHtml(user.billingMandate)}</strong>
              <small>${user.termsAcceptedAt ? "Terms accepted" : "Terms missing"} - ${formatNumber(user.revenueSharePercent)}% share</small>
            </div>
            <span>${escapeHtml((user.linkedPlatforms || []).join(", "))}</span>
            <div>
              <strong>${formatMoney(user.grossRevenue)}</strong>
              <small>${formatMoney(user.podforgeFee)} PF fee - ${formatNumber(user.uploads)} uploads</small>
            </div>
            <div class="row-actions">
              <select data-user-status="${escapeHtml(user.id)}" aria-label="Change ${escapeHtml(user.fullName)} status">
                ${optionHtml(userStatuses, user.status)}
              </select>
              <button class="mini-button" type="button" data-user-save="${escapeHtml(user.id)}">Save</button>
              <small>${escapeHtml(user.adminNote || "")}</small>
            </div>
          </article>
        `,
      )
      .join("")}
  `;

  $$("[data-user-save]").forEach((button) => {
    button.addEventListener("click", () => updateUserStatus(button.dataset.userSave));
  });
}

function renderRevenue(analytics) {
  const revenue = analytics.revenue || {};
  const modeLabel = analytics.stripeConfigured ? `${titleCase(analytics.mode)} billing` : "Simulation mode";
  setText("#revenueModePill", modeLabel);
  setText("#collectedRevenueMetric", formatMoney(revenue.collected));
  setText("#scheduledRevenueCardMetric", formatMoney(revenue.scheduled));
  setText("#overdueRevenueCardMetric", formatMoney(revenue.overdue));

  const collections = (Array.isArray(analytics.collections) ? analytics.collections : []).filter(matchesSearch);
  const list = $("#collectionList");
  if (!collections.length) {
    list.innerHTML = '<div class="empty-state">No scheduled collections match the current search.</div>';
    return;
  }

  list.innerHTML = collections
    .map(
      (item) => `
        <article class="collection-row">
          <div>
            <strong>${escapeHtml(item.platform)}</strong>
            <span>${escapeHtml(item.creator)} - ${escapeHtml(item.period)}</span>
          </div>
          <div>
            <strong>${formatMoney(item.fee)}</strong>
            <span>${formatMoney(item.gross)} gross</span>
          </div>
          <div>
            <span class="status-pill ${toneClass(item.status)}">${escapeHtml(item.status)}</span>
            <small>Due ${escapeHtml(formatDate(item.dueDate))}</small>
          </div>
          <div>
            <span>${escapeHtml(item.method)}</span>
            <small>${escapeHtml(item.nextAction)}</small>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAlerts(alerts) {
  const adminAlerts = (Array.isArray(alerts) ? alerts : []).filter(matchesSearch);
  setText("#alertCountPill", `${adminAlerts.length} open`);
  const list = $("#adminAlertList");
  if (!adminAlerts.length) {
    list.innerHTML = '<div class="empty-state">No admin alerts match the current search.</div>';
    return;
  }

  list.innerHTML = adminAlerts
    .map(
      (alert) => `
        <article class="alert-item ${toneClass(alert.severity)}">
          <header>
            <span>${escapeHtml(alert.severity)}</span>
            <small>${escapeHtml(alert.owner)}</small>
          </header>
          <strong>${escapeHtml(alert.title)}</strong>
          <p>${escapeHtml(alert.detail)}</p>
        </article>
      `,
    )
    .join("");
}

function renderUploads(uploads) {
  const uploadItems = (Array.isArray(uploads) ? uploads : []).filter(matchesSearch);
  setText("#uploadCountPill", `${uploadItems.length} uploads`);
  const list = $("#adminUploadList");
  if (!uploadItems.length) {
    list.innerHTML = '<div class="empty-state">No uploads match the current search.</div>';
    return;
  }

  list.innerHTML = `
    <div class="table-row table-head">
      <span>Episode</span>
      <span>Creator</span>
      <span>Uploaded</span>
      <span>Format</span>
      <span>Status</span>
    </div>
    ${uploadItems
      .map(
        (upload) => `
          <article class="table-row">
            <div>
              <strong>${escapeHtml(upload.title)}</strong>
              <small>${escapeHtml(upload.source)} - ${escapeHtml(upload.duration)} - ${escapeHtml(upload.size)}</small>
            </div>
            <span>${escapeHtml(upload.creator)}</span>
            <span>${escapeHtml(formatDateTime(upload.uploadedAt))}</span>
            <span>${escapeHtml(upload.format)}</span>
            <div>
              <span class="status-pill ${toneClass(upload.status)}">${escapeHtml(upload.status)}</span>
              <small>${escapeHtml((upload.platforms || []).join(", "))}</small>
            </div>
          </article>
        `,
      )
      .join("")}
  `;
}

function renderPlatforms(platforms) {
  const platformItems = (Array.isArray(platforms) ? platforms : []).filter(matchesSearch);
  const totalLinks = platformItems.reduce((total, platform) => total + Number(platform.connectedAccounts || 0), 0);
  setText("#platformHealthPill", `${formatNumber(totalLinks)} linked accounts`);

  const grid = $("#adminPlatformGrid");
  if (!platformItems.length) {
    grid.innerHTML = '<div class="empty-state">No platform analytics match the current search.</div>';
    return;
  }

  grid.innerHTML = platformItems
    .map(
      (platform) => `
        <article class="platform-card">
          <header>
            <div>
              <strong>${escapeHtml(platform.name)}</strong>
              <span>${escapeHtml(platform.audience)}</span>
            </div>
            <span class="status-pill ${toneClass(platform.status)}">${escapeHtml(platform.status)}</span>
          </header>
          <div class="platform-metrics">
            <div><span>Accounts</span><strong>${formatNumber(platform.connectedAccounts)}</strong></div>
            <div><span>Uploads</span><strong>${formatNumber(platform.activeUploads)}</strong></div>
            <div><span>Gross</span><strong>${formatMoney(platform.grossRevenue)}</strong></div>
            <div><span>PF fee</span><strong>${formatMoney(platform.podforgeFee)}</strong></div>
          </div>
          <div class="health-meter" aria-label="${escapeHtml(platform.name)} sync health">
            <span style="width: ${Math.max(0, Math.min(100, Number(platform.syncHealth || 0)))}%"></span>
          </div>
          <footer>
            <small>${formatNumber(platform.syncHealth)}% sync health</small>
            <small>${escapeHtml(platform.lastSync)}</small>
          </footer>
        </article>
      `,
    )
    .join("");
}

function renderAudienceHeatmap(audienceHeatmap) {
  const data = audienceHeatmap || {};
  const summary = data.summary || {};
  const days = Array.isArray(data.days) ? data.days : [];
  const slots = Array.isArray(data.slots) ? data.slots : [];
  const heatmap = $("#adminAudienceHeatmap");

  setText("#adminAudiencePeakPill", summary.peakWindow || "Peak window");

  if (!days.length || !slots.length) {
    heatmap.innerHTML = '<div class="empty-state">Audience heatmap will appear here.</div>';
  } else {
    heatmap.innerHTML = `
      <div class="heatmap-corner">Day</div>
      ${slots.map((slot) => `<div class="heatmap-axis">${escapeHtml(slot)}</div>`).join("")}
      ${days
        .map(
          (row) => `
            <div class="heatmap-day">${escapeHtml(row.day)}</div>
            ${(row.values || [])
              .map(
                (cell, index) => {
                  const value = heatScore(cell);
                  const platform = heatPlatform(cell);
                  const segment = heatSegment(cell);
                  return `
                  <div class="heat-cell level-${heatLevel(value)}" title="${escapeHtml(row.day)} ${escapeHtml(slots[index])}: ${value}% on ${escapeHtml(platform)}${segment ? ` - ${escapeHtml(segment)}` : ""}">
                    <strong>${formatNumber(value)}%</strong>
                    <small>${escapeHtml(platform)}</small>
                    <em>${value >= 90 ? "Peak" : value >= 76 ? "Hot" : value >= 60 ? "Warm" : "Light"}</em>
                  </div>
                `;
                },
              )
              .join("")}
          `,
        )
        .join("")}
    `;
  }

  const segmentItems = (Array.isArray(data.segments) ? data.segments : []).filter(matchesSearch);
  const segmentList = $("#audienceSegmentList");
  if (!segmentItems.length) {
    segmentList.innerHTML = '<div class="empty-state">No audience segments match the current search.</div>';
  } else {
    segmentList.innerHTML = `
      <article class="audience-summary-card">
        <span>Hottest segment</span>
        <strong>${escapeHtml(summary.hottestSegment || "Not enough data")}</strong>
        <small>${escapeHtml(summary.strongestPlatform || "Platform")} - ${escapeHtml(summary.topRegion || "Region")} - ${formatNumber(summary.revenueLift || 0)}% revenue lift</small>
      </article>
      ${segmentItems
        .map(
          (segment) => `
            <article class="audience-segment-card">
              <header>
                <div>
                  <strong>${escapeHtml(segment.name)}</strong>
                  <span>${escapeHtml(segment.age)} - ${escapeHtml(segment.region)} - ${escapeHtml(segment.device)}</span>
                </div>
                <span class="status-pill ${toneClass(`${segment.engagement >= 85 ? "ready" : "warning"}`)}">${formatNumber(segment.engagement)}%</span>
              </header>
              <div class="segment-metrics">
                <div><span>Platform</span><strong>${escapeHtml(segment.platform)}</strong></div>
                <div><span>Retention</span><strong>${formatNumber(segment.retention)}%</strong></div>
                <div><span>RPM</span><strong>${formatMoney(segment.revenuePerThousand)}</strong></div>
                <div><span>Best window</span><strong>${escapeHtml(segment.bestWindow)}</strong></div>
              </div>
            </article>
          `,
        )
        .join("")}
    `;
  }

  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  $("#audienceRecommendations").innerHTML = recommendations.length
    ? recommendations.map((item) => `<article>${escapeHtml(item)}</article>`).join("")
    : '<div class="empty-state">Audience recommendations will appear here.</div>';
}

function renderOperations(analytics) {
  const operations = analytics.operations || {};
  const creators = analytics.creators || {};
  setText("#uptimeMetric", `${operations.uptime || "--"} uptime`);
  $("#operationsGrid").innerHTML = `
    <article><span>Storage used</span><strong>${escapeHtml(operations.storageUsed)}</strong></article>
    <article><span>Processing jobs</span><strong>${formatNumber(operations.processingJobs)}</strong></article>
    <article><span>Failed jobs</span><strong>${formatNumber(operations.failedJobs)}</strong></article>
    <article><span>Avg edit time</span><strong>${escapeHtml(operations.averageEditTime)}</strong></article>
    <article><span>Billing mandates</span><strong>${formatNumber(creators.mandatesActive)}</strong></article>
    <article><span>Open support</span><strong>${formatNumber(operations.openSupportItems)}</strong></article>
  `;
}

function renderAuditLog(items) {
  const auditItems = (Array.isArray(items) ? items : []).filter(matchesSearch).slice(0, 12);
  setText("#auditCountPill", `${auditItems.length} events`);
  const list = $("#auditLogList");
  if (!auditItems.length) {
    list.innerHTML = '<div class="empty-state">No audit events match the current search.</div>';
    return;
  }

  list.innerHTML = auditItems
    .map(
      (item) => `
        <article class="audit-item">
          <header>
            <strong>${escapeHtml(item.action)}</strong>
            <small>${escapeHtml(formatDateTime(item.createdAt))}</small>
          </header>
          <span>${escapeHtml(item.target)}</span>
          <small>${escapeHtml(item.actor)} - ${escapeHtml(item.detail)}</small>
        </article>
      `,
    )
    .join("");
}

function renderFeedback(items) {
  const filter = selectedFilter();
  const feedbackItems = (Array.isArray(items) ? items : []).filter((item) => {
    const statusMatch = !feedbackStatuses.includes(filter) || item.status === filter;
    return statusMatch && matchesSearch(item);
  });
  setText("#inboxStatus", `${feedbackItems.length} notes`);

  const list = $("#adminFeedbackList");
  if (!feedbackItems.length) {
    list.innerHTML = '<div class="empty-state">No tester feedback matches the current filters.</div>';
    return;
  }

  list.innerHTML = feedbackItems
    .map(
      (item) => `
        <article class="feedback-card">
          <header>
            <strong>${escapeHtml(item.type)} - ${escapeHtml(pageLabel(item.page))}</strong>
            <span>${escapeHtml(item.timeLabel || "")}</span>
          </header>
          <p>${escapeHtml(item.note)}</p>
          <div class="feedback-meta">
            <small>Status: ${escapeHtml(item.status)}</small>
            <small>Priority: ${escapeHtml(item.priority)}</small>
            ${item.contact ? `<small>Contact: ${escapeHtml(item.contact)}</small>` : ""}
            <small>Submitted: ${escapeHtml(new Date(item.createdAt).toLocaleString())}</small>
            ${item.testerIp ? `<small>IP: ${escapeHtml(item.testerIp)}</small>` : ""}
          </div>
          <div class="feedback-actions">
            <label>
              Status
              <select data-feedback-status="${escapeHtml(item.id)}">
                ${optionHtml(feedbackStatuses, item.status)}
              </select>
            </label>
            <label>
              Priority
              <select data-feedback-priority="${escapeHtml(item.id)}">
                ${optionHtml(priorities, item.priority)}
              </select>
            </label>
            <button class="mini-button" type="button" data-feedback-save="${escapeHtml(item.id)}">Save</button>
          </div>
        </article>
      `,
    )
    .join("");

  $$("[data-feedback-save]").forEach((button) => {
    button.addEventListener("click", () => updateFeedbackStatus(button.dataset.feedbackSave));
  });
}

function renderAdminDashboard() {
  const analytics = adminState.analytics;
  if (!analytics) return;
  renderSummary(analytics);
  renderUsers(analytics.users);
  renderRevenue(analytics);
  renderAlerts(analytics.alerts);
  renderUploads(analytics.uploads);
  renderPlatforms(analytics.platforms);
  renderAudienceHeatmap(analytics.audienceHeatmap);
  renderOperations(analytics);
  renderAuditLog(analytics.auditLog);
  renderFeedback(adminState.feedback);
}

async function loadAdminDashboard() {
  const [analytics, feedback] = await Promise.all([apiJson("/api/admin/analytics"), apiJson("/api/admin/feedback")]);
  adminState.analytics = analytics;
  adminState.feedback = feedback.items || [];
  renderAdminDashboard();
}

async function updateUserStatus(userId) {
  const select = $(`[data-user-status="${CSS.escape(userId)}"]`);
  if (!select) return;
  await apiJson(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: "POST",
    body: JSON.stringify({ status: select.value }),
  });
  showToast("User status updated.");
  await loadAdminDashboard();
}

async function updateFeedbackStatus(feedbackId) {
  const statusSelect = $(`[data-feedback-status="${CSS.escape(feedbackId)}"]`);
  const prioritySelect = $(`[data-feedback-priority="${CSS.escape(feedbackId)}"]`);
  if (!statusSelect || !prioritySelect) return;
  await apiJson(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/status`, {
    method: "POST",
    body: JSON.stringify({ status: statusSelect.value, priority: prioritySelect.value }),
  });
  showToast("Feedback workflow updated.");
  await loadAdminDashboard();
}

async function bootAdmin() {
  try {
    await loadAdminDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

$("#refreshAdminButton").addEventListener("click", async () => {
  try {
    await loadAdminDashboard();
    showToast("Admin command center refreshed.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#adminSearchInput").addEventListener("input", (event) => {
  adminState.search = event.target.value.trim().toLowerCase();
  renderAdminDashboard();
});

$("#adminStatusFilter").addEventListener("change", (event) => {
  adminState.statusFilter = event.target.value;
  renderAdminDashboard();
});

bootAdmin();
