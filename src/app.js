import { createSeedData, products, roles } from "./data/seed.js";
import {
  analyseBrainDump,
  assessRegulation,
  calculateBridging,
  calculateDevelopment,
  calculateQuoteTotals,
  createId,
  draftClientRequest,
  draftLenderSubmission,
  draftQuoteProsCons,
  formatMoney,
  formatPercent,
  matchLenders,
  sendPlaceholderEmail
} from "./services/placeholders.js";

const STORAGE_KEY = "lendtech.mvp.state.v1";
const USER_KEY = "lendtech.mvp.currentUser";
const app = document.querySelector("#app");
const productOptions = [
  { label: "Bridging Finance", value: "prod-bridging", hint: "Short-term property finance" },
  { label: "Development Finance", value: "prod-development", hint: "Build, conversion or heavy works" },
  { label: "Commercial Mortgage", value: "prod-commercial-term", hint: "Owner-occupied or investment term debt" },
  { label: "BTL / Investment Property", value: "BTL / Investment Property", hint: "Rental or refinance requirement" },
  { label: "Business Finance", value: "Business Finance", hint: "Trading business funding" },
  { label: "Asset Finance", value: "Asset Finance", hint: "Equipment or vehicle finance" },
  { label: "Invoice Finance", value: "Invoice Finance", hint: "Receivables-led funding" },
  { label: "Mezzanine", value: "Mezzanine", hint: "Higher leverage structure" },
  { label: "Pref Equity", value: "Pref Equity", hint: "Private capital placeholder" },
  { label: "Other", value: "Other", hint: "Add custom product" }
];
const borrowerTypeOptions = ["Limited Company", "SPV", "Sole Trader", "Partnership", "LLP", "Trust", "Charity", "Individual", "Other"];
const applicantRouteOptions = ["Borrower", "Broker", "Introducer", "Professional Adviser", "Existing Platform User"];
const securityTypeOptions = ["Residential", "Commercial", "Semi-Commercial", "Land", "Development Site", "Mixed Use", "Owner-Occupied", "Investment Property", "Other"];
const chargeTypeOptions = ["First Charge", "Second Charge", "Equitable Charge", "Debenture", "PG Only", "Other"];
const regulatedAnswerOptions = [
  { label: "Yes", value: "Likely regulated" },
  { label: "No", value: "Likely unregulated business purpose" },
  { label: "Previously lived there", value: "Manual compliance review required" },
  { label: "Will live there", value: "Likely regulated" },
  { label: "Not sure", value: "Unknown / TBC" }
];
const lenderResponseOptions = ["Acceptable in principle", "Decline", "Request more information", "Decision pending", "Refer to credit", "Issue indicative terms"];
const quoteLabelOptions = ["Highest Loan", "Lowest Cost", "Lowest PG", "Most Flexible", "Best Balance", "Needs Review", "Client Preferred", "Broker Recommended"];

let state = loadState();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      products: parsed.products || products,
      ui: {
        latest_lender_matches: {},
        latest_client_email_drafts: {},
        notifications: [],
        ...(parsed.ui || {})
      }
    };
  }
  return { ...createSeedData(), products };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state = { ...createSeedData(), products };
  saveState();
}

function currentUser() {
  const id = localStorage.getItem(USER_KEY);
  return state.users.find((user) => user.id === id) || null;
}

function setCurrentUser(id) {
  localStorage.setItem(USER_KEY, id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function valueAttr(value) {
  return escapeHtml(value ?? "");
}

function boolAttr(value) {
  return value ? "checked" : "";
}

function parseNumber(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function todayIso() {
  return new Date().toISOString();
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function notify(message) {
  state.ui.last_notice = message;
  state.ui.notifications = [
    { id: createId("notice"), message, created_date: todayIso() },
    ...(state.ui.notifications || [])
  ].slice(0, 10);
  saveState();
}

function navigate(path) {
  history.pushState({}, "", path);
  render();
}

function getCase(caseId) {
  return state.cases.find((caseRecord) => caseRecord.id === caseId);
}

function getCaseFromPath(path) {
  const match = path.match(/^\/cases\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return getCase(match[1]);
}

function caseProduct(caseRecord) {
  return state.products.find((product) => product.id === caseRecord?.product_id);
}

function caseParty(caseRecord) {
  return state.applicationParties.find((item) => item.id === caseRecord?.client_id) || caseParties(caseRecord?.id || "")[0];
}

function caseBroker(caseRecord) {
  return state.brokerProfiles.find((broker) => broker.id === caseRecord?.broker_id);
}

function caseBrokerage(caseRecord) {
  return state.brokerageProfiles.find((brokerage) => brokerage.id === caseRecord?.brokerage_id);
}

function primarySecurity(caseRecord) {
  return caseSecurities(caseRecord?.id || "")[0];
}

function caseParties(caseId) {
  return state.applicationParties.filter((party) => party.case_id === caseId);
}

function casePeople(caseId) {
  return state.people.filter((person) => person.case_id === caseId);
}

function caseSecurities(caseId) {
  return state.propertySecurities.filter((security) => security.case_id === caseId);
}

function caseSubmissions(caseId) {
  return state.caseLenderSubmissions.filter((submission) => submission.case_id === caseId);
}

function caseQuotes(caseId) {
  return state.lenderQuotes.filter((quote) => quote.case_id === caseId);
}

function caseAudit(caseId) {
  return state.auditLogs
    .filter((log) => log.case_id === caseId)
    .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
}

function addAudit(caseId, action, entityType, entityId, detail) {
  state.auditLogs.unshift({
    id: createId("audit"),
    case_id: caseId,
    user_id: currentUser()?.id || "external",
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail,
    created_date: todayIso()
  });
}

function missingCount(caseRecord) {
  return (caseRecord?.missing_information || []).filter(Boolean).length;
}

function commissionExpected(caseRecord) {
  const ledger = state.commissionLedger.find((item) => item.case_id === caseRecord?.id);
  if (!ledger) return 0;
  return Number(ledger.expected_broker_fee || 0) + Number(ledger.expected_lender_procuration_fee || 0) + Number(ledger.platform_override || 0);
}

function nextBestAction(caseRecord) {
  if (!caseRecord) return { label: "Open case", href: "/cases", note: "Review pipeline" };
  if (caseRecord.status === "Draft" || caseRecord.status === "AI extracted draft" || state.aiExtractionReviews.some((item) => item.case_id === caseRecord.id && item.status === "Pending broker review")) {
    return { label: "Review AI extraction", href: `/cases/${caseRecord.id}/ai`, note: "Approve, edit or reject AI suggestions" };
  }
  if (missingCount(caseRecord)) {
    return { label: "Request missing info", href: `/cases/${caseRecord.id}/client-requests`, note: `${missingCount(caseRecord)} item${missingCount(caseRecord) === 1 ? "" : "s"} outstanding` };
  }
  if (caseRecord.status === "Ready for lender search") {
    return { label: "Search lenders", href: `/cases/${caseRecord.id}/lender-search`, note: "Run appetite match" };
  }
  if (caseRecord.status === "Submitted to lenders") {
    return { label: "Check responses", href: `/cases/${caseRecord.id}/lender-submissions`, note: "Review lender decisions" };
  }
  if (caseRecord.status === "Quote comparison") {
    return { label: "Compare quotes", href: `/cases/${caseRecord.id}/quote-comparison`, note: "Prepare client explanation" };
  }
  return { label: "Open case", href: `/cases/${caseRecord.id}`, note: "Continue packaging" };
}

function freshnessPill(appetite) {
  const labels = ["Fresh", "Current", "Stale", "Outdated", "Unverified", "Lender confirmed", "Admin confirmed", "AI extracted only"];
  const index = Math.abs(String(appetite?.id || appetite?.product_type || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % labels.length;
  const label = appetite?.freshness_label || labels[index];
  const tone = ["Fresh", "Current", "Lender confirmed", "Admin confirmed"].includes(label) ? "green"
    : ["Stale", "Unverified", "AI extracted only"].includes(label) ? "amber"
      : "red";
  return `<span class="status ${tone}">${escapeHtml(label)}</span>`;
}

function updateCase(caseId, patch) {
  const caseRecord = getCase(caseId);
  if (!caseRecord) return;
  Object.assign(caseRecord, patch, { updated_date: todayIso() });
}

function optionList(items, selectedValue) {
  return items
    .map((item) => {
      const value = typeof item === "string" ? item : item.value;
      const label = typeof item === "string" ? item : item.label;
      const selected = String(value) === String(selectedValue) ? "selected" : "";
      return `<option value="${valueAttr(value)}" ${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderOptionCards(name, items, selectedValue, options = {}) {
  const cssClass = options.compact ? "option-grid compact" : "option-grid";
  return `
    <div class="${cssClass}">
      ${items.map((item, index) => {
        const value = typeof item === "string" ? item : item.value;
        const label = typeof item === "string" ? item : item.label;
        const hint = typeof item === "string" ? "" : item.hint;
        const icon = typeof item === "string" ? "" : item.icon;
        const checked = String(value) === String(selectedValue) || (!selectedValue && index === 0) ? "checked" : "";
        return `
          <label class="option-card">
            <input type="radio" name="${valueAttr(name)}" value="${valueAttr(value)}" ${checked} />
            ${icon ? `<b>${escapeHtml(icon)}</b>` : ""}
            <span>${escapeHtml(label)}</span>
            ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function fieldStatusBadge(status) {
  const tone = /confirmed|edited|client|lender/i.test(status) ? "green"
    : /missing|rejected|not applicable/i.test(status) ? "red"
      : /suggested|review|not sure|api/i.test(status) ? "amber"
        : "blue";
  return `<span class="status ${tone}">${escapeHtml(status)}</span>`;
}

function renderFieldStatusRow(statuses = ["AI suggested", "API suggested, future", "Manually entered", "Confirmed by broker"]) {
  return `<div class="field-status-row">${statuses.map(fieldStatusBadge).join("")}</div>`;
}

function render() {
  const path = window.location.pathname;
  const external = path.startsWith("/apply/") || path.startsWith("/lender-response/");
  if (path === "/" || path === "") {
    navigate(currentUser() ? "/dashboard" : "/login");
    return;
  }
  if (path === "/login") {
    renderLogin();
    return;
  }
  if (external) {
    app.innerHTML = renderExternal(path);
    return;
  }
  if (!currentUser()) {
    history.replaceState({}, "", "/login");
    renderLogin();
    return;
  }
  app.innerHTML = renderShell(path);
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-panel">
        <div class="login-intro">
          <div class="brand-mark">LT</div>
          <h1>LendTech</h1>
          <p>Core commercial finance workflow, lender packaging, quote comparison and white-label application infrastructure.</p>
          <div class="alert green">MVP mode uses local placeholder services for AI, email, documents and integrations.</div>
        </div>
        <form class="login-form" data-form="login">
          <div class="band-header" style="padding: 0 0 18px; border: 0;">
            <div>
              <h3>Sign in</h3>
              <p>Select a seeded MVP user to enter the platform.</p>
            </div>
          </div>
          <div class="field">
            <label for="login_user">User</label>
            <select id="login_user" name="user_id">
              ${state.users.map((user) => `<option value="${valueAttr(user.id)}">${escapeHtml(user.full_name)} - ${escapeHtml(user.role)}</option>`).join("")}
            </select>
          </div>
          <div style="height: 14px;"></div>
          <button class="button primary" type="submit">Log in</button>
          <button class="button" type="button" data-action="reset-demo">Reset seeded demo</button>
          <p class="subtle">Roles available: ${roles.slice(0, 8).map(escapeHtml).join(", ")} and future specialist users.</p>
        </form>
      </section>
    </main>
  `;
}

function renderExternal(path) {
  if (path.startsWith("/apply/")) {
    const slug = path.split("/").pop();
    return renderWhiteLabelApplication(slug);
  }
  const token = path.split("/").pop();
  return renderLenderResponse(token);
}

function renderShell(path) {
  const user = currentUser();
  const title = routeTitle(path);
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">LT</div>
          <h1>LendTech</h1>
          <p>Commercial finance operating system</p>
        </div>
        ${renderNav(path)}
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div>
            <h2>${escapeHtml(title.title)}</h2>
            <p>${escapeHtml(title.subtitle)}</p>
          </div>
          <div class="top-actions">
            ${state.ui.last_notice ? `<span class="status green">${escapeHtml(state.ui.last_notice)}</span>` : ""}
            <span class="status blue">${escapeHtml(user.full_name)} - ${escapeHtml(user.role)}</span>
            <button class="button" type="button" data-action="logout">Switch user</button>
          </div>
        </header>
        <section class="content">
          ${renderRoute(path)}
        </section>
        ${renderMobileNav(path)}
      </main>
    </div>
  `;
}

function renderMobileNav(path) {
  const items = [
    ["/dashboard", "Home", "HM"],
    ["/cases/case-hendon-dev/ai", "AI", "AI"],
    ["/cases", "Cases", "CS"],
    ["/cases/case-hendon-dev/client-requests", "Tasks", "TS"],
    ["/lender/dashboard", "More", "MR"]
  ];
  return `
    <nav class="mobile-bottom-nav" aria-label="Mobile navigation">
      ${items.map(([href, label, token]) => `
        <a href="${valueAttr(href)}" data-link class="${path === href || (label === "Cases" && path.startsWith("/cases") && !path.includes("/ai")) ? "active" : ""}">
          <span>${escapeHtml(token)}</span>
          ${escapeHtml(label)}
        </a>
      `).join("")}
    </nav>
  `;
}

function renderNav(path) {
  const nav = [
    ["Core", [
      ["/dashboard", "DB", "Dashboard"],
      ["/cases", "CS", "Cases"],
      ["/cases/new", "+", "New case"],
      ["/apply/uk-lender-group", "WL", "UK Lender link"]
    ]],
    ["Profiles", [
      ["/profiles/broker", "BP", "Broker"],
      ["/profiles/brokerage", "BG", "Brokerage"],
      ["/profiles/client", "CL", "Client"],
      ["/profiles/lender", "LP", "Lender"]
    ]],
    ["Lender", [
      ["/lender/dashboard", "LD", "Lender dashboard"],
      ["/lender/applications", "AP", "Applications"]
    ]],
    ["Admin", [
      ["/admin/brokerages", "BR", "Brokerages"],
      ["/admin/brokers", "BK", "Brokers"],
      ["/admin/lenders", "LN", "Lenders"],
      ["/admin/products", "PR", "Products"],
      ["/admin/market-intelligence", "MI", "Market intel"],
      ["/admin/audit", "AU", "Audit"]
    ]]
  ];

  return `
    <nav class="nav">
      ${nav.map(([section, links]) => `
        <div class="nav-section">${escapeHtml(section)}</div>
        ${links.map(([href, token, label]) => `
          <a href="${valueAttr(href)}" data-link class="${path === href ? "active" : ""}">
            <span class="nav-token">${escapeHtml(token)}</span>
            <span>${escapeHtml(label)}</span>
          </a>
        `).join("")}
      `).join("")}
    </nav>
  `;
}

function routeTitle(path) {
  const caseRecord = getCaseFromPath(path);
  if (caseRecord) {
    const product = caseProduct(caseRecord)?.product_name || caseRecord.case_type;
    return { title: caseRecord.case_reference, subtitle: `${caseRecord.status} - ${product}` };
  }
  const titles = {
    "/dashboard": ["Dashboard", "Your AI-powered commercial finance workspace"],
    "/cases": ["Cases", "Broker pipeline and system-of-record case list"],
    "/cases/new": ["Create case", "Capture the minimum structured data and continue to BankManager.ai"],
    "/admin/brokerages": ["Brokerages", "Brokerage profiles and permissions"],
    "/admin/brokers": ["Brokers", "Broker profiles and regulated permissions"],
    "/admin/lenders": ["Lenders", "Profiles, appetite and status"],
    "/admin/products": ["Products", "Active MVP products and future product placeholders"],
    "/admin/market-intelligence": ["Market intelligence", "Controlled criteria import and appetite freshness review"],
    "/admin/audit": ["Audit", "Cross-platform audit trail"],
    "/profiles/broker": ["Broker profile", "Permissions, activity, cases and commission visibility"],
    "/profiles/brokerage": ["Brokerage profile", "Branding, regulatory details, users and submission settings"],
    "/profiles/client": ["Client profile", "Tasks, documents, consents and released quote views"],
    "/profiles/lender": ["Lender profile", "Appetite, responses, terms, decline reasons and white-label settings"],
    "/lender/dashboard": ["Lender dashboard", "Credit-paper style application queue"],
    "/lender/applications": ["Lender applications", "White-label and broker-submitted applications"]
  };
  const match = titles[path] || ["LendTech", "Focused MVP workspace"];
  return { title: match[0], subtitle: match[1] };
}

function renderRoute(path) {
  if (path === "/dashboard") return renderDashboard();
  if (path === "/cases") return renderCases();
  if (path === "/cases/new") return renderNewCase();
  if (path === "/admin/brokerages") return renderBrokeragesAdmin();
  if (path === "/admin/brokers") return renderBrokersAdmin();
  if (path === "/admin/lenders") return renderLendersAdmin();
  if (path === "/admin/products") return renderProductsAdmin();
  if (path === "/admin/market-intelligence") return renderMarketIntelligenceAdmin();
  if (path === "/admin/audit") return renderAuditAdmin();
  if (path === "/profiles/broker") return renderBrokerProfilePage();
  if (path === "/profiles/brokerage") return renderBrokerageProfilePage();
  if (path === "/profiles/client") return renderClientProfilePage();
  if (path === "/profiles/lender") return renderLenderProfilePage();
  if (path === "/lender/dashboard") return renderLenderDashboard();
  if (path === "/lender/applications") return renderLenderApplications();

  const caseRecord = getCaseFromPath(path);
  if (!caseRecord) return renderNotFound();

  const tab = path.split("/")[3] || "";
  return `
    ${renderCaseHeader(caseRecord, tab)}
    ${renderCaseTab(caseRecord, tab)}
  `;
}

function renderDashboard() {
  const openCases = state.cases.filter((caseRecord) => !["Archived", "Completed", "Declined"].includes(caseRecord.status));
  const needingAction = openCases.filter((caseRecord) => ["AI extracted draft", "Broker review required", "Information requested", "Ready for lender search", "Quote comparison"].includes(caseRecord.status));
  const missingItems = openCases.reduce((sum, caseRecord) => sum + missingCount(caseRecord), 0);
  const waitingClient = openCases.filter((caseRecord) => missingCount(caseRecord) > 0).length;
  const waitingLender = state.caseLenderSubmissions.filter((submission) => ["Draft", "Sent", "Viewed", "Decision pending", "Referred to credit"].includes(submission.status)).length;
  const termsReceived = state.caseLenderSubmissions.filter((submission) => submission.status === "Indicative terms received").length + state.lenderQuotes.filter((quote) => quote.quote_status !== "Awaited").length;
  const commission = state.cases.reduce((sum, caseRecord) => sum + commissionExpected(caseRecord), 0);
  const aiReviewCount = state.aiExtractionReviews.filter((review) => review.status === "Pending broker review").length;
  const priorityCases = [...openCases].sort((a, b) => missingCount(b) - missingCount(a)).slice(0, 5);
  const kpis = [
    ["NA", needingAction.length, "Needs action", "Broker queue"],
    ["CL", waitingClient, "Waiting client", `${missingItems} missing items`],
    ["LD", waitingLender, "Waiting lender", "Responses or terms due"],
    ["TR", termsReceived, "Terms received", "Quotes and lender terms"],
    ["AI", aiReviewCount, "AI review", "Awaiting broker approval"],
    ["CM", formatMoney(commission), "Pipeline commission", "Indicative expected income"]
  ];

  return `
    <section class="ai-dashboard-card">
      <div class="ai-orb">AI</div>
      <div class="ai-dashboard-main">
        <div class="eyebrow">BankManager.ai</div>
        <h2>BankManager.ai</h2>
        <p>Paste an enquiry, upload documents or ask what to do next.</p>
        <div class="ai-prompt-shell">
          <textarea aria-label="BankManager.ai dashboard prompt" placeholder="Paste a client email, lender reply, term sheet notes or describe the case..."></textarea>
          <div class="ai-prompt-actions">
            <button class="button soft" type="button">Upload</button>
            <a class="button primary" href="/cases/new" data-link>Analyse</a>
            <a class="button ghost" href="/cases/new" data-link>Create case</a>
          </div>
        </div>
        <div class="quick-chip-row">
          <a href="/cases/new" data-link>Analyse enquiry</a>
          <a href="/cases/new" data-link>Upload files</a>
          <a href="/cases/case-hendon-dev/client-requests" data-link>Draft client request</a>
          <a href="/cases/case-btl-refi/quote-comparison" data-link>Compare quotes</a>
        </div>
      </div>
    </section>
    <section class="kpi-grid">
      ${kpis.map(([icon, value, label, subtext]) => `
        <article class="kpi-card">
          <span class="mini-icon">${escapeHtml(icon)}</span>
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label)}</span>
          <small>${escapeHtml(subtext)}</small>
        </article>
      `).join("")}
    </section>
    <div class="dashboard-columns">
      <section class="surface-panel priority-panel">
        <div class="section-heading">
          <div>
            <h3>Priority work</h3>
            <p>Cases that need the next broker decision.</p>
          </div>
          <a class="text-link" href="/cases" data-link>View all</a>
        </div>
        <div class="priority-list">
          ${priorityCases.map((caseRecord) => {
            const party = caseParty(caseRecord);
            const action = nextBestAction(caseRecord);
            return `
              <article class="priority-row">
                <a class="priority-case" href="/cases/${caseRecord.id}" data-link>
                  <strong>${escapeHtml(caseRecord.case_reference)}</strong>
                  <span>${escapeHtml(party?.name || "Client TBC")}</span>
                  <small>${escapeHtml(caseRecord.case_type)}</small>
                </a>
                <div class="priority-stage">${statusPill(caseRecord.status)}</div>
                <div class="priority-readiness">
                  <div class="progress"><span style="width:${Number(caseRecord.submission_readiness_score || 0)}%;"></span></div>
                  <small>${caseRecord.submission_readiness_score || 0}% ready</small>
                </div>
                <a class="button compact" href="${valueAttr(action.href)}" data-link>${escapeHtml(action.label)}</a>
              </article>
            `;
          }).join("")}
        </div>
      </section>
      <aside class="surface-panel activity-panel">
        <div class="section-heading">
          <div>
            <h3>Recent activity</h3>
            <p>Latest platform events.</p>
          </div>
          <a class="text-link" href="/admin/audit" data-link>View full audit</a>
        </div>
        <div class="activity-feed">
          ${state.auditLogs.slice(0, 5).map((log) => `
            <div class="activity-item">
              <span class="mini-icon">AU</span>
              <div>
                <strong>${escapeHtml(log.action)}</strong>
                <p>${escapeHtml(log.detail)}</p>
                <small>${escapeHtml(log.entity_type)} · ${escapeHtml(new Date(log.created_date).toLocaleString())}</small>
              </div>
            </div>
          `).join("")}
        </div>
      </aside>
    </div>
  `;
}

function renderNextAction(caseRecord) {
  if (caseRecord.status === "Ready for lender search") return `<a class="button" href="/cases/${caseRecord.id}/lender-search" data-link>Search lenders</a>`;
  if (caseRecord.status === "Quote comparison") return `<a class="button" href="/cases/${caseRecord.id}/quote-comparison" data-link>Compare quotes</a>`;
  if (caseRecord.status === "Draft") return `<a class="button" href="/cases/${caseRecord.id}/ai" data-link>Run BankManager.ai</a>`;
  return `<a class="button" href="/cases/${caseRecord.id}" data-link>Open</a>`;
}

function statusPill(status) {
  const lower = String(status || "").toLowerCase();
  const tone = lower.includes("declined") || lower.includes("blocked") ? "red"
    : lower.includes("ready") || lower.includes("approved") || lower.includes("active") || lower.includes("sent") ? "green"
      : lower.includes("review") || lower.includes("await") || lower.includes("draft") ? "amber"
        : "blue";
  return `<span class="status ${tone}">${escapeHtml(status || "TBC")}</span>`;
}

function renderCases() {
  return `
    <section class="band">
      <div class="band-header">
        <div>
          <h3>Case list</h3>
          <p>Broker-facing case pipeline for bridging, development and future finance products.</p>
        </div>
        <a class="button primary" href="/cases/new" data-link>Create case</a>
      </div>
      <div class="band-body table-wrap">
        <table>
          <thead><tr><th>Reference</th><th>Client</th><th>Product</th><th>Loan</th><th>Regulated status</th><th>Status</th></tr></thead>
          <tbody>
            ${state.cases.map((caseRecord) => {
              const party = state.applicationParties.find((item) => item.id === caseRecord.client_id);
              return `
                <tr>
                  <td><a href="/cases/${caseRecord.id}" data-link><strong>${escapeHtml(caseRecord.case_reference)}</strong></a><br><span class="subtle">${escapeHtml(caseRecord.security_address_headline)}</span></td>
                  <td>${escapeHtml(party?.name || "TBC")}</td>
                  <td>${escapeHtml(caseRecord.case_type)}</td>
                  <td>${formatMoney(caseRecord.loan_amount_requested)}</td>
                  <td>${statusPill(caseRecord.regulated_status)}</td>
                  <td>${statusPill(caseRecord.status)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderNewCase() {
  const user = currentUser();
  return `
    <section class="band">
      <div class="band-header">
        <div>
          <h3>New case</h3>
          <p>Upload or paste what you have. BankManager.ai structures it, then you confirm, edit or add manual details.</p>
        </div>
      </div>
      <form class="band-body" data-form="new-case">
        <div class="prefill-hero">
          <div>
            <div class="eyebrow">AI-first case capture</div>
            <h3>Start with the rough enquiry</h3>
            <p>Paste a broker note, email, client message or term sheet extract. Manual entry remains available below.</p>
          </div>
          ${renderFieldStatusRow(["AI suggested", "API suggested, future", "Needs review", "Confirmed by broker"])}
        </div>
        <div class="dropzone">
          <strong>Upload documents or paste notes</strong>
          <span>PDFs, portfolios, lender emails and future Outlook/API sources will pre-fill the review screen. For MVP, paste notes below.</span>
        </div>
        <div class="field">
          <label>Paste email or notes here</label>
          <textarea class="large-input" name="summary" placeholder="Example: Development finance enquiry for an SPV. Loan around £4.5m, GDV £7.5m, security at Hendon Lane, planning pending..."></textarea>
        </div>
        <div class="guided-section">
          <div class="guided-heading">
            <h3>Suggested product</h3>
            <span class="status amber">AI/API pre-fill ready</span>
          </div>
          ${renderOptionCards("product_id", productOptions, "prod-bridging")}
        </div>
        <div class="guided-section">
          <div class="guided-heading"><h3>Borrower type</h3><span class="status blue">Click to select</span></div>
          ${renderOptionCards("borrower_type", borrowerTypeOptions, "Limited Company", { compact: true })}
        </div>
        <div class="guided-section">
          <div class="guided-heading"><h3>Security type</h3><span class="status blue">Smart default</span></div>
          ${renderOptionCards("security_type", securityTypeOptions, "Development Site", { compact: true })}
        </div>
        <div class="guided-section">
          <div class="guided-heading"><h3>Regulated question</h3><span class="status amber">Human review if flagged</span></div>
          <p class="subtle">Does anyone connected to the borrower live in or intend to live in the property?</p>
          ${renderOptionCards("regulated_status", regulatedAnswerOptions, "Unknown / TBC", { compact: true })}
        </div>
        <details class="manual-panel">
          <summary>Enter manually or edit pre-filled details</summary>
          <div class="form-grid three" style="margin-top:14px;">
            <div class="field"><label>Source brand</label><select name="source_brand">${optionList(["LendTech", "BankManager.ai", "The UK Lender Group", "FinanceMyCompany.co.uk"], "BankManager.ai")}</select></div>
            <div class="field"><label>Initial status</label><select name="status">${optionList(["Draft", "Broker review required", "Ready for lender search"], "Draft")}</select></div>
            <div class="field"><label>Borrower/applicant name</label><input name="client_name" placeholder="Company or individual name" /></div>
            <div class="field"><label>Client email</label><input name="client_email" type="email" placeholder="client@example.com" /></div>
            <div class="field"><label>Client phone</label><input name="client_phone" placeholder="020..." /></div>
            <div class="field"><label>Loan amount requested</label><input name="loan_amount_requested" inputmode="decimal" placeholder="4561860" /></div>
            <div class="field"><label>Security address headline</label><input name="security_address" placeholder="Property or site address" /></div>
            <div class="field"><label>Other product</label><input name="custom_product" placeholder="Only if Other selected" /></div>
          </div>
        </details>
        <input type="hidden" name="brokerage_id" value="${valueAttr(user.brokerage_id || "brokerage-uka")}" />
        <input type="hidden" name="broker_id" value="${valueAttr(user.broker_id || "broker-max")}" />
        <div class="actions" style="margin-top:16px;">
          <button class="button primary" type="submit">Create AI-prefilled case</button>
          <a class="button" href="/cases" data-link>Cancel</a>
        </div>
      </form>
    </section>
  `;
}

function renderCaseHeader(caseRecord, tab) {
  const party = caseParty(caseRecord);
  const broker = caseBroker(caseRecord);
  const security = primarySecurity(caseRecord);
  const action = nextBestAction(caseRecord);
  const warningItems = [
    ...(caseRecord.missing_information || []).slice(0, 2),
    /regulated|third-party|manual/i.test(caseRecord.regulated_status || "") ? caseRecord.regulated_status : ""
  ].filter(Boolean);
  const tabs = [
    ["", "Overview"],
    ["ai", "AI Workspace"],
    ["applicants", "People"],
    ["security", "Security"],
    ["development", "Loan"],
    ["documents", "Documents"],
    ["lender-search", "Lenders"],
    ["quote-comparison", "Quotes"],
    ["compliance", "Compliance"],
    ["commission", "Commission"],
    ["audit", "Audit"]
  ];
  return `
    <section class="case-hub premium-case">
      <div class="case-hub-main">
        <div class="eyebrow">Case hub</div>
        <h2>${escapeHtml(caseRecord.case_reference)} - ${escapeHtml(party?.name || "Client TBC")}</h2>
        <p>${escapeHtml(caseRecord.case_type)} · ${formatMoney(caseRecord.loan_amount_requested)} · ${escapeHtml(security?.security_address || caseRecord.security_address_headline || "Security TBC")}</p>
        <div class="case-hub-facts">
          <span><strong>${escapeHtml(caseRecord.case_type)}</strong> Product</span>
          <span><strong>${formatMoney(caseRecord.loan_amount_requested)}</strong> Loan request</span>
          <span><strong>${escapeHtml(security?.security_address || caseRecord.security_address_headline || "TBC")}</strong> Security</span>
          <span><strong>${escapeHtml(broker?.full_name || "Broker TBC")}</strong> Broker</span>
        </div>
      </div>
      <div class="case-hub-side">
        <div class="case-status-stack">
          ${statusPill(caseRecord.status)}
          <strong>${caseRecord.submission_readiness_score || 0}%</strong>
          <span>submission ready</span>
        </div>
        <div class="progress"><span style="width:${Number(caseRecord.submission_readiness_score || 0)}%;"></span></div>
        <a class="button primary" href="${valueAttr(action.href)}" data-link>${escapeHtml(action.label)}</a>
        <span class="subtle">${escapeHtml(action.note)}</span>
      </div>
    </section>
    ${warningItems.length ? `
      <div class="warning-strip">
        ${warningItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    ` : ""}
    <nav class="tabs">
      ${tabs.map(([key, label]) => {
        const href = key ? `/cases/${caseRecord.id}/${key}` : `/cases/${caseRecord.id}`;
        const active = (tab || "") === key ? "active" : "";
        return `<a href="${href}" data-link class="${active}">${escapeHtml(label)}</a>`;
      }).join("")}
    </nav>
  `;
}

function renderCaseTab(caseRecord, tab) {
  const views = {
    "": renderCaseOverview,
    ai: renderBankManager,
    "source-log": renderSourceLog,
    applicants: renderApplicants,
    security: renderSecurity,
    bridging: renderBridging,
    development: renderDevelopment,
    documents: renderDocuments,
    "client-requests": renderClientRequests,
    "lender-search": renderLenderSearch,
    "lender-submissions": renderLenderSubmissions,
    "credit-paper": renderCreditPaper,
    "quote-comparison": renderQuoteComparison,
    compliance: renderCompliance,
    commission: renderCommission,
    audit: renderCaseAuditTab
  };
  return (views[tab || ""] || renderCaseOverview)(caseRecord);
}

function renderCaseOverview(caseRecord) {
  const party = state.applicationParties.find((item) => item.id === caseRecord.client_id);
  const security = caseSecurities(caseRecord.id)[0];
  const submissions = caseSubmissions(caseRecord.id);
  const quotes = caseQuotes(caseRecord.id);
  const project = state.developmentProjects.find((item) => item.case_id === caseRecord.id);
  const action = nextBestAction(caseRecord);
  const latestSubmissions = submissions.slice(0, 3);
  return `
    <div class="case-metric-row">
      <div class="metric"><span>Loan request</span><strong>${formatMoney(caseRecord.loan_amount_requested)}</strong><small>${escapeHtml(caseRecord.case_type)}</small></div>
      <div class="metric"><span>Security value</span><strong>${formatMoney(security?.current_value)}</strong><small>${escapeHtml(security?.security_type || "Security")}</small></div>
      <div class="metric"><span>GDV</span><strong>${formatMoney(security?.gdv || project?.gdv)}</strong><small>Where relevant</small></div>
      <div class="metric"><span>Readiness</span><strong>${caseRecord.submission_readiness_score || 0}%</strong><small>Broker-controlled score</small></div>
      <div class="metric"><span>Lender submissions</span><strong>${submissions.length}</strong><small>${submissions.filter((item) => item.status === "Sent").length} sent</small></div>
      <div class="metric"><span>Quotes</span><strong>${quotes.length}</strong><small>${quotes.filter((item) => item.quote_status === "Broker approved").length} broker approved</small></div>
    </div>
    <div class="case-overview-grid">
      <section class="surface-panel">
        <div class="section-heading">
          <div><h3>Case summary</h3><p>The core story before lender submission.</p></div>
        </div>
        <p class="case-summary-text">${escapeHtml(caseRecord.summary || "No summary yet. Use BankManager.ai to turn the enquiry into a structured case narrative.")}</p>
        <dl class="kv clean-kv">
          <dt>Borrower</dt><dd>${escapeHtml(party?.name || "TBC")}</dd>
          <dt>Security</dt><dd>${escapeHtml(security?.security_address || caseRecord.security_address_headline || "TBC")}</dd>
          <dt>Source</dt><dd>${escapeHtml(caseRecord.source_brand)} / ${escapeHtml(caseRecord.source_app)}</dd>
          <dt>Last updated</dt><dd>${escapeHtml(dateOnly(caseRecord.updated_date))}</dd>
        </dl>
      </section>
      <aside class="surface-panel missing-panel">
        <div class="section-heading">
          <div><h3>Missing information</h3><p>Only the items blocking progress.</p></div>
        </div>
        <div class="missing-list">
          ${(caseRecord.missing_information || []).slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("") || `<span>No missing information logged.</span>`}
        </div>
        <div class="actions compact-actions">
          <a class="button primary" href="/cases/${caseRecord.id}/client-requests" data-link>Draft client request</a>
          <button class="button ghost" type="button">Mark not required</button>
          <a class="button ghost" href="/cases/${caseRecord.id}/ai" data-link>Add manually</a>
        </div>
      </aside>
    </div>
    <div class="case-overview-grid secondary">
      <section class="surface-panel">
        <div class="section-heading">
          <div><h3>Latest lender activity</h3><p>Recent decisions and response state.</p></div>
          <a class="text-link" href="/cases/${caseRecord.id}/lender-submissions" data-link>Open submissions</a>
        </div>
        <div class="activity-feed compact-feed">
          ${latestSubmissions.map((submission) => {
            const lender = state.lenderProfiles.find((item) => item.id === submission.lender_id);
            return `
              <div class="activity-item">
                <span class="mini-icon">LD</span>
                <div>
                  <strong>${escapeHtml(lender?.lender_name || "Lender")}</strong>
                  <p>${escapeHtml(submission.decision || submission.status || "Awaiting response")}</p>
                  <small>${escapeHtml(submission.submission_level)}</small>
                </div>
              </div>
            `;
          }).join("") || `<div class="empty-state">No lender activity yet.</div>`}
        </div>
      </section>
      <aside class="surface-panel">
        <div class="section-heading">
          <div><h3>Workflow actions</h3><p>Keep the next step clear.</p></div>
        </div>
        <div class="next-action-card">
          <span class="mini-icon">NX</span>
          <div>
            <strong>${escapeHtml(action.label)}</strong>
            <p>${escapeHtml(action.note)}</p>
          </div>
        </div>
        <div class="actions compact-actions">
          <a class="button primary" href="${valueAttr(action.href)}" data-link>Continue next action</a>
          <a class="button ghost" href="/cases/${caseRecord.id}/ai" data-link>Open AI Workspace</a>
        </div>
        <details class="manual-panel">
          <summary>More actions</summary>
          <div class="more-action-list">
            <a href="/cases/${caseRecord.id}/development" data-link>Development calculator</a>
            <a href="/cases/${caseRecord.id}/bridging" data-link>Bridging calculator</a>
            <a href="/cases/${caseRecord.id}/lender-search" data-link>Lender search</a>
            <a href="/cases/${caseRecord.id}/credit-paper" data-link>Credit paper</a>
            <a href="/cases/${caseRecord.id}/quote-comparison" data-link>Quote comparison</a>
            <a href="/cases/${caseRecord.id}/commission" data-link>Commission</a>
          </div>
        </details>
      </aside>
    </div>
    <section class="surface-panel">
      <div class="section-heading">
        <div><h3>Recent activity</h3><p>Short preview only. Full detail is in Audit.</p></div>
        <a class="text-link" href="/cases/${caseRecord.id}/audit" data-link>Open audit</a>
      </div>
      <div class="activity-feed compact-feed">${renderTimeline(caseAudit(caseRecord.id).slice(0, 4))}</div>
    </section>
  `;
}

function renderBankManager(caseRecord) {
  const reviews = state.aiExtractionReviews.filter((review) => review.case_id === caseRecord.id);
  const latestSource = state.brainDumpSourceRecords
    .filter((source) => source.case_id === caseRecord.id)
    .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)))[0];
  const analysis = latestSource?.analysis_summary;
  return `
    <section class="ai-workspace">
      <div class="ai-chat-panel">
        <div class="ai-chat-header">
          <div class="ai-orb">AI</div>
          <div>
            <h3>BankManager.ai</h3>
            <p>Turns messy enquiries, lender replies and documents into structured finance cases.</p>
          </div>
        </div>
        <div class="chat-thread">
          <div class="ai-message user-message">
            <strong>Start with anything you have</strong>
            <p>Paste an email, lender reply, WhatsApp notes, term sheet or describe the case.</p>
          </div>
          ${analysis ? `
            <div class="ai-message assistant-message">
              <strong>I think this is a ${escapeHtml(analysis.likely_product)} enquiry.</strong>
              <p>I found borrower, loan and security signals. I am missing ${analysis.missing_information.map(escapeHtml).join(", ") || "no key items"}.</p>
              <div class="quick-chip-row">
                <span>Suggested product: ${escapeHtml(analysis.likely_product)}</span>
                <span>${reviews.length} review fields</span>
                <span>Human approval required</span>
              </div>
            </div>
          ` : `
            <div class="ai-message assistant-message">
              <strong>Ready when you are.</strong>
              <p>Paste the enquiry below and I will extract client, loan, security, missing information and suggested next actions.</p>
            </div>
          `}
        </div>
        <form class="ai-compose" data-form="ai-brain-dump" data-case-id="${valueAttr(caseRecord.id)}">
          <textarea name="brain_dump" placeholder="Paste an email, lender reply, WhatsApp notes, term sheet or describe the case..."></textarea>
          <div class="ai-compose-footer">
            <div class="quick-chip-row">
              <button class="chip-button" type="button">Upload files</button>
              <a class="chip-button" href="/cases/${caseRecord.id}/client-requests" data-link>Draft client request</a>
              <a class="chip-button" href="/cases/${caseRecord.id}/credit-paper" data-link>Prepare credit paper</a>
              <a class="chip-button" href="/cases/${caseRecord.id}/source-log" data-link>Source log</a>
            </div>
            <button class="button primary" type="submit">Analyse</button>
          </div>
        </form>
      </div>
      <aside class="ai-side-panel">
        <div class="section-heading">
          <div><h3>Recommended next step</h3><p>One clear action from the assistant.</p></div>
        </div>
        ${analysis ? `
          <div class="next-action-card">
            <span class="mini-icon">RQ</span>
            <div>
              <strong>Draft client request</strong>
              <p>Ask for ${analysis.missing_information.slice(0, 3).map(escapeHtml).join(", ") || "remaining evidence"}.</p>
            </div>
          </div>
          <a class="button primary full-width" href="/cases/${caseRecord.id}/client-requests" data-link>Draft client request</a>
          <div class="mini-list">
            <strong>Suggested client questions</strong>
            ${analysis.suggested_questions.map((question) => `<span>${escapeHtml(question)}</span>`).join("")}
          </div>
        ` : `
          <div class="next-action-card">
            <span class="mini-icon">AN</span>
            <div>
              <strong>Analyse enquiry</strong>
              <p>Run extraction to create reviewable suggestions.</p>
            </div>
          </div>
        `}
        <div class="mini-list">
          <strong>Upload placeholders</strong>
          ${["PDFs", "Word documents", "Excel portfolios", "lender emails", "term sheets", "images", "bank statements", "development appraisals"].map((documentType) => `<span>${escapeHtml(documentType)}</span>`).join("")}
        </div>
      </aside>
    </section>
    ${analysis ? `
      <section class="surface-panel">
        <div class="section-heading">
          <div><h3>AI response summary</h3><p>Suggested product, extracted data and flags remain broker-editable.</p></div>
        </div>
        <div class="case-metric-row compact-row">
          <div class="metric"><span>Product</span><strong>${escapeHtml(analysis.likely_product)}</strong><small>Suggested only</small></div>
          <div class="metric"><span>Client details</span><strong>${reviews.filter((review) => review.entity_type === "ApplicationParty").length}</strong><small>Extracted fields</small></div>
          <div class="metric"><span>Loan/security</span><strong>${reviews.filter((review) => review.entity_type === "Case" || review.entity_type === "PropertySecurity").length}</strong><small>Review rows</small></div>
          <div class="metric"><span>Regulatory flags</span><strong>${analysis.missing_information.some((item) => /regulated|consent/i.test(item)) ? "Review" : "None"}</strong><small>Broker decision required</small></div>
        </div>
      </section>
    ` : ""}
    <section class="surface-panel">
      <div class="section-heading">
        <div>
          <h3>Review AI/API Suggestions</h3>
          <p>Grouped by case area. Confirmed fields are not updated until the broker approves them.</p>
        </div>
      </div>
      ${reviews.length ? renderReviewGroups(reviews) : `<div class="empty-state">Run analysis to create extraction review rows.</div>`}
    </section>
  `;
}

function reviewSectionName(review) {
  if (review.entity_type === "ApplicationParty") return "Client / borrower";
  if (review.entity_type === "Person") return "People";
  if (review.entity_type === "PropertySecurity") return "Property / security";
  if (review.entity_type === "DevelopmentProject") return "Development details";
  if (review.entity_type === "LenderQuote") return "Lender terms";
  if (/regulated|compliance/i.test(review.field_name || review.field_key || "")) return "Compliance flags";
  if (review.entity_type === "Case" && /loan|product|case/i.test(review.field_key || "")) return "Loan details";
  return "Missing information";
}

function renderReviewGroups(reviews) {
  const sections = ["Client / borrower", "Company", "People", "Property / security", "Loan details", "Development details", "Lender terms", "Missing information", "Compliance flags"];
  return sections.map((section) => {
    const rows = reviews.filter((review) => reviewSectionName(review) === section);
    if (!rows.length) return "";
    return `
      <div class="suggestion-group">
        <div class="guided-heading">
          <h3>${escapeHtml(section)}</h3>
          ${fieldStatusBadge(`${rows.length} suggestion${rows.length === 1 ? "" : "s"}`)}
        </div>
        ${rows.map(renderReviewItem).join("")}
      </div>
    `;
  }).join("");
}

function renderReviewItem(review) {
  return `
    <div class="review-item ai-suggestion">
      <div class="review-grid">
        <div>
          <strong>${escapeHtml(review.field_name)}</strong><br>
          <span class="subtle">${escapeHtml(review.entity_type)}.${escapeHtml(review.field_key)}</span>
          ${renderFieldStatusRow([review.status === "Applied" ? "Confirmed" : "AI suggested", "API suggested, future"])}
        </div>
        <div class="field">
          <label>Suggested / broker value</label>
          <input data-review-value="${valueAttr(review.id)}" value="${valueAttr(review.broker_value ?? review.suggested_value)}" />
        </div>
        <div>
          ${statusPill(review.status)}
          <div class="subtle">Confidence ${formatPercent((Number(review.confidence || 0) * 100))}</div>
          <div class="source-chip">Source: ${escapeHtml(review.source_excerpt || "Brain dump source")}</div>
        </div>
        <div class="actions">
          <button class="button teal" type="button" data-action="approve-ai" data-review-id="${valueAttr(review.id)}">Confirm</button>
          <button class="button" type="button" data-action="edit-ai" data-review-id="${valueAttr(review.id)}">Edit</button>
          <button class="button" type="button" data-action="ask-client-ai" data-review-id="${valueAttr(review.id)}">Ask client</button>
          <button class="button" type="button" data-action="not-sure-ai" data-review-id="${valueAttr(review.id)}">Not sure</button>
          <button class="button danger" type="button" data-action="reject-ai" data-review-id="${valueAttr(review.id)}">Reject</button>
        </div>
      </div>
    </div>
  `;
}

function renderSourceLog(caseRecord) {
  const sources = state.brainDumpSourceRecords.filter((source) => source.case_id === caseRecord.id);
  return `
    <section class="band">
      <div class="band-header">
        <div>
          <h3>Source log</h3>
          <p>Every important data point should answer where the information came from.</p>
        </div>
      </div>
      <div class="band-body">
        ${sources.length ? sources.map((source) => `
          <div class="timeline-item">
            <div class="actions" style="justify-content:space-between;">
              <strong>${escapeHtml(source.input_type)}</strong>
              ${statusPill(source.ai_analysis_status)}
            </div>
            <p>${escapeHtml(source.original_content)}</p>
            <dl class="kv">
              <dt>Extracted</dt><dd>${(source.extracted_fields || []).map(escapeHtml).join(", ") || "None"}</dd>
              <dt>Approved</dt><dd>${(source.broker_approved_fields || []).map(escapeHtml).join(", ") || "None"}</dd>
              <dt>Rejected</dt><dd>${(source.rejected_fields || []).map(escapeHtml).join(", ") || "None"}</dd>
              <dt>Created</dt><dd>${escapeHtml(dateOnly(source.created_date))}</dd>
            </dl>
          </div>
        `).join("") : `<div class="empty-state">No source records yet.</div>`}
      </div>
    </section>
  `;
}

function renderApplicants(caseRecord) {
  const parties = caseParties(caseRecord.id);
  const people = casePeople(caseRecord.id);
  const partyTypes = ["PropCo", "OpCo", "Director", "Shareholder", "Partner", "Trustee", "Guarantor", "Parent Company", "Professional Party", "SPV", "Limited company"];
  return `
    <div class="split">
      <section class="band">
        <div class="band-header">
          <div><h3>Applicants and connected parties</h3><p>PropCo, OpCo, directors, shareholders, guarantors and professional parties.</p></div>
        </div>
        <div class="band-body grid two">
          ${parties.map((party) => `
            <article class="party-card">
              <h4>${escapeHtml(party.name)}</h4>
              <dl class="kv">
                <dt>Type</dt><dd>${escapeHtml(party.applicant_type)}</dd>
                <dt>Role</dt><dd>${escapeHtml(party.role)}</dd>
                <dt>Email</dt><dd>${escapeHtml(party.email || "TBC")}</dd>
                <dt>Phone</dt><dd>${escapeHtml(party.phone || "TBC")}</dd>
              </dl>
              <p class="subtle">${escapeHtml(party.notes || "")}</p>
            </article>
          `).join("")}
        </div>
      </section>
      <aside class="band">
        <div class="band-header"><div><h3>Add party</h3><p>One-click roles become editable cards.</p></div></div>
        <form class="band-body" data-form="add-party" data-case-id="${valueAttr(caseRecord.id)}">
          <div class="field"><label>Party type</label><select name="applicant_type">${optionList(partyTypes, "Director")}</select></div>
          <div class="field"><label>Name</label><input name="name" placeholder="Name or company" required /></div>
          <div class="field"><label>Email</label><input name="email" type="email" /></div>
          <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Add party</button></div>
        </form>
      </aside>
    </div>
    <section class="band">
      <div class="band-header"><div><h3>People</h3><p>Directors, shareholders, partners, trustees, guarantors and client contacts.</p></div></div>
      <div class="band-body">
        <div class="grid two">
          ${people.map((person) => `
            <article class="party-card">
              <h4>${escapeHtml(person.full_legal_name)}</h4>
              <dl class="kv">
                <dt>Role</dt><dd>${escapeHtml(person.role)}</dd>
                <dt>Ownership</dt><dd>${formatPercent(person.ownership_percentage || 0)}</dd>
                <dt>KYC/AML</dt><dd>${escapeHtml(person.kyc_aml_status)}</dd>
                <dt>Address history</dt><dd>${person.address_history_complete ? "Complete" : "Incomplete"}</dd>
              </dl>
              ${!person.address_history_complete ? `<div class="alert amber">Previous address history is required if current address is under 3 years.</div>` : ""}
            </article>
          `).join("") || `<div class="empty-state">No people added yet.</div>`}
        </div>
        <form class="form-grid three" data-form="add-person" data-case-id="${valueAttr(caseRecord.id)}" style="margin-top:16px;">
          <div class="field"><label>Full legal name</label><input name="full_legal_name" required /></div>
          <div class="field"><label>Role</label><select name="role">${optionList(["Director", "Shareholder", "Partner", "Trustee", "Guarantor", "Client contact", "Third-party security provider"], "Director")}</select></div>
          <div class="field"><label>Ownership %</label><input name="ownership_percentage" inputmode="decimal" /></div>
          <div class="field"><label>Email</label><input name="email" type="email" /></div>
          <div class="field"><label>Phone</label><input name="phone" /></div>
          <div class="field"><label>KYC/AML status</label><select name="kyc_aml_status">${optionList(["Not started", "Requested", "In review", "Complete"], "Not started")}</select></div>
          <div class="actions"><button class="button primary" type="submit">Add person</button></div>
        </form>
      </div>
    </section>
  `;
}

function renderSecurity(caseRecord) {
  const security = caseSecurities(caseRecord.id)[0] || {};
  return `
    <section class="band">
      <div class="band-header">
        <div><h3>Real estate security</h3><p>Multiple securities will be supported. MVP edits the primary security.</p></div>
      </div>
      <form class="band-body" data-form="save-security" data-case-id="${valueAttr(caseRecord.id)}" data-security-id="${valueAttr(security.id || "")}">
        <div class="form-grid three">
          <div class="field"><label>Security address</label><input name="security_address" value="${valueAttr(security.security_address || caseRecord.security_address_headline)}" /></div>
          <div class="field"><label>Owner</label><input name="owner" value="${valueAttr(security.owner)}" /></div>
          <div class="field"><label>Tenure</label><select name="tenure">${optionList(["Freehold", "Leasehold", "TBC"], security.tenure || "TBC")}</select></div>
          <div class="field"><label>Security type</label><select name="security_type">${optionList(["Residential", "Semi-commercial", "Commercial", "Land", "Part-developed development", "Mixed-use", "Development site", "Owner-occupied property", "Investment property", "Other"], security.security_type || "Mixed-use")}</select></div>
          <div class="field"><label>Current value</label><input name="current_value" value="${valueAttr(security.current_value || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Purchase price</label><input name="purchase_price" value="${valueAttr(security.purchase_price || "")}" inputmode="decimal" /></div>
          <div class="field"><label>GDV</label><input name="gdv" value="${valueAttr(security.gdv || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Proposed charge type</label><select name="proposed_charge_type">${optionList(["First charge", "Second charge", "Equitable charge", "Debenture", "Personal guarantee"], security.proposed_charge_type || "First charge")}</select></div>
          <div class="field"><label>Existing lender</label><input name="existing_lender" value="${valueAttr(security.existing_lender || "")}" /></div>
          <div class="field"><label>Existing balance</label><input name="existing_balance" value="${valueAttr(security.existing_balance || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Valuation status</label><select name="valuation_status">${optionList(["Required", "Ordered", "Received", "Not required"], security.valuation_status || "Required")}</select></div>
          <div class="field"><label>Consent obtained</label><select name="consent_obtained">${optionList([{ value: "false", label: "No" }, { value: "true", label: "Yes" }], String(Boolean(security.consent_obtained)))}</select></div>
        </div>
        <div class="field" style="margin-top:14px;"><label>Notes</label><textarea name="notes">${escapeHtml(security.notes || "")}</textarea></div>
        <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Save security</button></div>
      </form>
    </section>
  `;
}

function renderCompliance(caseRecord) {
  const security = caseSecurities(caseRecord.id)[0];
  const assessment = state.regulatedAssessments.find((item) => item.case_id === caseRecord.id) || {};
  return `
    <section class="band">
      <div class="band-header">
        <div><h3>Regulated and third-party charge assessment</h3><p>AI may assist, but broker/compliance approval controls the result.</p></div>
      </div>
      <form class="band-body" data-form="save-compliance" data-case-id="${valueAttr(caseRecord.id)}" data-assessment-id="${valueAttr(assessment.id || "")}" data-security-id="${valueAttr(security?.id || "")}">
        <div class="alert ${caseRecord.regulated_status === "Likely regulated" ? "red" : "amber"}">
          Current classification: <strong>${escapeHtml(caseRecord.regulated_status)}</strong>. Regulated cases must be blocked unless brokerage, broker and lender permissions all support regulated business.
        </div>
        <div class="form-grid two" style="margin-top:16px;">
          <div class="field">
            <label>Does any connected person live in the property?</label>
            <select name="occupier_connection">${optionList(["Yes", "No", "Not currently, but has lived there", "Will live there", "Unknown / TBC"], assessment.occupier_connection || "Unknown / TBC")}</select>
          </div>
          <div class="field"><label>Who owns the security?</label><input name="security_owner" value="${valueAttr(assessment.security_owner || security?.owner || "")}" /></div>
          <div class="field"><label>Who is borrowing?</label><input name="borrower" value="${valueAttr(assessment.borrower || "")}" /></div>
          <div class="field"><label>Business purpose?</label><select name="business_purpose">${optionList([{ value: "true", label: "Yes" }, { value: "false", label: "No / TBC" }], String(assessment.business_purpose ?? true))}</select></div>
          <div class="field"><label>Third-party charge?</label><select name="third_party_charge">${optionList([{ value: "false", label: "No" }, { value: "true", label: "Yes" }], String(Boolean(assessment.third_party_charge)))}</select></div>
          <div class="field"><label>Independent legal advice required?</label><select name="independent_legal_advice_required">${optionList([{ value: "false", label: "No" }, { value: "true", label: "Yes" }], String(Boolean(assessment.independent_legal_advice_required)))}</select></div>
        </div>
        <div class="field" style="margin-top:14px;"><label>Notes</label><textarea name="notes">${escapeHtml(assessment.notes || "")}</textarea></div>
        <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Save assessment</button></div>
      </form>
    </section>
  `;
}

function renderBridging(caseRecord) {
  const loan = state.bridgingLoans.find((item) => item.case_id === caseRecord.id) || {};
  const calc = calculateBridging({
    loan_amount: loan.loan_amount || caseRecord.loan_amount_requested,
    property_value: loan.property_value || caseSecurities(caseRecord.id)[0]?.current_value,
    term: loan.term || 12,
    interest_rate: loan.interest_rate || 1,
    arrangement_fee: loan.arrangement_fee || 2,
    exit_fee: loan.exit_fee || 0,
    broker_fee: loan.broker_fee || 0
  });
  return `
    <section class="band">
      <div class="band-header"><div><h3>Bridging finance calculator</h3><p>LTV, retained interest, gross loan and redemption estimate.</p></div></div>
      <form class="band-body" data-form="save-bridging" data-case-id="${valueAttr(caseRecord.id)}" data-loan-id="${valueAttr(loan.id || "")}">
        <div class="form-grid three">
          <div class="field"><label>Loan purpose</label><input name="loan_purpose" value="${valueAttr(loan.loan_purpose || "Acquisition / refinance")}" /></div>
          <div class="field"><label>Loan amount</label><input name="loan_amount" value="${valueAttr(loan.loan_amount || caseRecord.loan_amount_requested || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Property value</label><input name="property_value" value="${valueAttr(loan.property_value || caseSecurities(caseRecord.id)[0]?.current_value || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Term months</label><input name="term" value="${valueAttr(loan.term || 12)}" inputmode="decimal" /></div>
          <div class="field"><label>Monthly interest rate %</label><input name="interest_rate" value="${valueAttr(loan.interest_rate || 1)}" inputmode="decimal" /></div>
          <div class="field"><label>Interest type</label><select name="interest_type">${optionList(["Retained", "Rolled", "Serviced"], loan.interest_type || "Retained")}</select></div>
          <div class="field"><label>Arrangement fee %</label><input name="arrangement_fee" value="${valueAttr(loan.arrangement_fee || 2)}" inputmode="decimal" /></div>
          <div class="field"><label>Exit fee %</label><input name="exit_fee" value="${valueAttr(loan.exit_fee || 0)}" inputmode="decimal" /></div>
          <div class="field"><label>Broker fee</label><input name="broker_fee" value="${valueAttr(loan.broker_fee || 0)}" inputmode="decimal" /></div>
        </div>
        <div class="grid four" style="margin-top:16px;">
          <div class="metric"><span>LTV</span><strong>${formatPercent(calc.ltv)}</strong><small>Net loan / value</small></div>
          <div class="metric"><span>Gross loan</span><strong>${formatMoney(calc.gross_loan)}</strong><small>Loan plus retained interest and fee</small></div>
          <div class="metric"><span>Retained interest</span><strong>${formatMoney(calc.retained_interest)}</strong><small>Indicative</small></div>
          <div class="metric"><span>Redemption</span><strong>${formatMoney(calc.redemption_amount)}</strong><small>Indicative total</small></div>
        </div>
        <div class="field" style="margin-top:14px;"><label>Exit strategy</label><textarea name="exit_strategy">${escapeHtml(loan.exit_strategy || "")}</textarea></div>
        <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Save bridge calculation</button></div>
      </form>
    </section>
  `;
}

function renderDevelopment(caseRecord) {
  const project = state.developmentProjects.find((item) => item.case_id === caseRecord.id) || {};
  const calc = calculateDevelopment(project);
  return `
    <section class="band">
      <div class="band-header"><div><h3>Development finance calculator</h3><p>LT-CMV, LT-GDV, loan-to-cost, profit and equity requirement.</p></div></div>
      <form class="band-body" data-form="save-development" data-case-id="${valueAttr(caseRecord.id)}" data-project-id="${valueAttr(project.id || "")}">
        <div class="form-grid three">
          <div class="field"><label>Purchase price</label><input name="purchase_price" value="${valueAttr(project.purchase_price || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Current market value</label><input name="current_market_value" value="${valueAttr(project.current_market_value || "")}" inputmode="decimal" /></div>
          <div class="field"><label>GDV</label><input name="gdv" value="${valueAttr(project.gdv || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Development costs</label><input name="development_costs" value="${valueAttr(project.development_costs || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Professional fees</label><input name="professional_fees" value="${valueAttr(project.professional_fees || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Contingency</label><input name="contingency" value="${valueAttr(project.contingency || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Day-one loan</label><input name="day_one_loan" value="${valueAttr(project.day_one_loan || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Build facility</label><input name="build_facility" value="${valueAttr(project.build_facility || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Total net loan</label><input name="total_net_loan" value="${valueAttr(project.total_net_loan || "")}" inputmode="decimal" /></div>
          <div class="field"><label>Development period months</label><input name="development_period" value="${valueAttr(project.development_period || 15)}" inputmode="decimal" /></div>
          <div class="field"><label>Sale/refinance period months</label><input name="sale_refinance_period" value="${valueAttr(project.sale_refinance_period || 3)}" inputmode="decimal" /></div>
          <div class="field"><label>Planning status</label><select name="planning_status">${optionList(["Subject to planning", "Planning submitted", "Planning granted", "Permitted development", "TBC"], project.planning_status || "TBC")}</select></div>
        </div>
        <div class="grid four" style="margin-top:16px;">
          <div class="metric"><span>Day-one LT-CMV</span><strong>${formatPercent(calc.day_one_lt_cmv)}</strong><small>Day-one / current value</small></div>
          <div class="metric"><span>Net LT-GDV</span><strong>${formatPercent(calc.net_lt_gdv)}</strong><small>Total net / GDV</small></div>
          <div class="metric"><span>Loan to cost</span><strong>${formatPercent(calc.loan_to_cost)}</strong><small>Total net / total cost</small></div>
          <div class="metric"><span>Profit on GDV</span><strong>${formatPercent(calc.profit_on_gdv)}</strong><small>Indicative profit margin</small></div>
        </div>
        <div class="grid two" style="margin-top:16px;">
          <div class="alert ${calc.profit_on_gdv < 15 ? "red" : "green"}">Profit: <strong>${formatMoney(calc.profit)}</strong>. Borrower equity required: <strong>${formatMoney(calc.borrower_equity_required)}</strong>.</div>
          <div class="alert amber">AI/rules can flag lack of experience, but mitigants and final credit judgement remain human-controlled.</div>
        </div>
        <div class="field" style="margin-top:14px;"><label>Exit strategy</label><textarea name="exit_strategy">${escapeHtml(project.exit_strategy || "")}</textarea></div>
        <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Save development calculation</button></div>
      </form>
    </section>
  `;
}

function renderDocuments(caseRecord) {
  const docs = state.documents.filter((doc) => doc.case_id === caseRecord.id);
  const checks = state.documentChecklistItems.filter((item) => item.case_id === caseRecord.id);
  return `
    <div class="split">
      <section class="band">
        <div class="band-header"><div><h3>Document checklist</h3><p>MVP tracks document status and metadata. File services are placeholders.</p></div></div>
        <div class="band-body">
          ${checks.map((item) => `
            <div class="document-row" style="margin-bottom:10px;">
              <div class="actions" style="justify-content:space-between;">
                <strong>${escapeHtml(item.document_type)}</strong>
                ${statusPill(item.status)}
              </div>
              <div class="actions" style="margin-top:10px;">
                <button class="button" type="button" data-action="mark-doc" data-check-id="${valueAttr(item.id)}" data-status="Requested">Request</button>
                <button class="button" type="button" data-action="mark-doc" data-check-id="${valueAttr(item.id)}" data-status="Received">Mark received</button>
                <button class="button" type="button" data-action="mark-doc" data-check-id="${valueAttr(item.id)}" data-status="Broker approved">Approve</button>
              </div>
            </div>
          `).join("") || `<div class="empty-state">No checklist rows yet.</div>`}
        </div>
      </section>
      <aside class="band">
        <div class="band-header"><div><h3>Upload metadata</h3><p>Placeholder document upload record.</p></div></div>
        <form class="band-body" data-form="document-upload" data-case-id="${valueAttr(caseRecord.id)}">
          <div class="field"><label>Document type</label><select name="document_type">${optionList(["ID/AML", "Proof of address", "Company documents", "Accounts", "Bank statements", "Portfolio schedule", "Planning documents", "Architect drawings", "Development appraisal", "Cost plan", "Valuation", "Title", "Term sheet", "Facility letter"], "Valuation")}</select></div>
          <div class="field"><label>File name</label><input name="file" placeholder="document.pdf" required /></div>
          <div class="field"><label>Notes</label><textarea name="notes"></textarea></div>
          <button class="button primary" type="submit">Add document record</button>
        </form>
      </aside>
    </div>
    <section class="band">
      <div class="band-header"><div><h3>Documents</h3><p>Visible to broker and selected lenders according to submission level.</p></div></div>
      <div class="band-body table-wrap">
        <table>
          <thead><tr><th>Type</th><th>File</th><th>Status</th><th>Visibility</th><th>AI extraction</th></tr></thead>
          <tbody>${docs.map((doc) => `<tr><td>${escapeHtml(doc.document_type)}</td><td>${escapeHtml(doc.file)}</td><td>${statusPill(doc.status)}</td><td>${escapeHtml(doc.visibility)}</td><td>${escapeHtml(doc.ai_extraction_status)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderClientRequests(caseRecord) {
  const tasks = state.clientTasks.filter((task) => task.case_id === caseRecord.id);
  const draft = draftClientRequest(caseRecord, caseRecord.missing_information || []);
  const missing = caseRecord.missing_information || [];
  const clientTaskOptions = ["Upload ID", "Upload proof of address", "Confirm company details", "Confirm property address", "Confirm loan amount", "Confirm exit strategy", "Upload portfolio", "Upload development appraisal", "Upload planning documents"];
  return `
    <div class="split">
      <section class="band">
        <div class="band-header"><div><h3>Client missing information request</h3><p>BankManager.ai drafts the request. The broker clicks the next action and approves before sending.</p></div></div>
        <form class="band-body" data-form="client-request" data-case-id="${valueAttr(caseRecord.id)}">
          <div class="guided-section">
            <div class="guided-heading"><h3>Smart missing information actions</h3>${fieldStatusBadge("AI suggested")}</div>
            ${missing.length ? missing.map((item) => `
              <div class="missing-action-card">
                <strong>${escapeHtml(item)}</strong>
                <div class="actions">
                  <button class="button" type="button">Draft client request</button>
                  <button class="button" type="button">Ask broker to complete</button>
                  <button class="button" type="button">Mark as not required</button>
                  <button class="button" type="button">Add manually</button>
                  <button class="button" type="button">Upload document</button>
                </div>
              </div>
            `).join("") : `<div class="empty-state">No missing information logged for this case.</div>`}
          </div>
          <div class="guided-section">
            <div class="guided-heading"><h3>Client task buttons</h3><span class="status blue">Client-facing</span></div>
            <div class="task-button-grid">
              ${clientTaskOptions.map((task) => `
                <div class="client-task-button">
                  <strong>${escapeHtml(task)}</strong>
                  <div class="actions"><button class="button" type="button">Upload</button><button class="button" type="button">Answer</button><button class="button" type="button">Not available</button><button class="button" type="button">Ask a question</button></div>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="guided-section">
            <div class="guided-heading"><h3>Request type</h3><span class="status amber">Suggested</span></div>
            ${renderOptionCards("request_type", ["Missing information request", "Document request", "Portfolio confirmation request", "Development experience request", "Quote comparison", "Offer explanation"], "Missing information request", { compact: true })}
          </div>
          <details class="manual-panel" open>
            <summary>Edit broker-approved message draft</summary>
            <div class="field" style="margin-top:14px;"><label>Email draft</label><textarea name="message_body">${escapeHtml(draft)}</textarea></div>
          </details>
          <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Approve and log send</button></div>
        </form>
      </section>
      <aside class="band">
        <div class="band-header"><div><h3>Client tasks</h3><p>Secure email request links are represented as tracked tasks.</p></div></div>
        <div class="band-body">
          ${tasks.map((task) => `<div class="task-item"><strong>${escapeHtml(task.request_type)}</strong><p>${escapeHtml(task.status)}</p><p class="subtle">${escapeHtml(task.message_body || "")}</p></div>`).join("") || `<div class="empty-state">No client requests sent yet.</div>`}
        </div>
      </aside>
    </div>
  `;
}

function renderLenderSearch(caseRecord) {
  const security = caseSecurities(caseRecord.id)[0];
  const matches = state.ui.latest_lender_matches?.[caseRecord.id] || [];
  const bestMatches = matches.filter((match) => match.match_score >= 75);
  const possibleMatches = matches.filter((match) => match.match_score >= 50 && match.match_score < 75);
  const notSuitable = matches.filter((match) => match.match_score < 50);
  const renderMatchCards = (title, rows) => `
    <div class="match-lane">
      <div class="guided-heading"><h3>${escapeHtml(title)}</h3>${fieldStatusBadge(`${rows.length} lender${rows.length === 1 ? "" : "s"}`)}</div>
      <div class="lender-card-grid">
        ${rows.map((match) => `
          <article class="lender-match-card">
            <div class="actions" style="justify-content:space-between;">
              <strong>${escapeHtml(match.lender_name)}</strong>
              <span class="match-score">${match.match_score}</span>
            </div>
            <p class="subtle">${escapeHtml(match.product_type)} - ${escapeHtml(match.indicative_rate_range)}</p>
            ${freshnessPill(state.lenderAppetites.find((appetite) => appetite.id === match.appetite_id))}
            <dl class="kv">
              <dt>Why matched</dt><dd>${match.key_warnings.length ? "Partial appetite fit" : "Product, amount and core appetite fit"}</dd>
              <dt>Key issue</dt><dd>${match.key_warnings[0] ? escapeHtml(match.key_warnings[0]) : "No material warning"}</dd>
            </dl>
            <div class="actions">
              <button class="button primary" type="button" data-action="create-submission" data-case-id="${valueAttr(caseRecord.id)}" data-lender-id="${valueAttr(match.lender_id)}">Send enquiry</button>
              <button class="button" type="button">View details</button>
            </div>
          </article>
        `).join("") || `<div class="empty-state">No lenders in this group yet.</div>`}
      </div>
    </div>
  `;
  return `
    <section class="band">
      <div class="band-header">
        <div><h3>AI-guided lender search</h3><p>Start with suggested matches from LenderProfile and LenderAppetite records. Advanced filters stay optional.</p></div>
        <button class="button primary" type="button" data-action="run-lender-search" data-case-id="${valueAttr(caseRecord.id)}">Run lender search</button>
      </div>
      <div class="band-body">
        <div class="grid four">
          <div class="metric"><span>Product</span><strong>${escapeHtml(caseRecord.case_type)}</strong><small>Input</small></div>
          <div class="metric"><span>Loan</span><strong>${formatMoney(caseRecord.loan_amount_requested)}</strong><small>Input</small></div>
          <div class="metric"><span>LTV</span><strong>${security?.current_value ? formatPercent((caseRecord.loan_amount_requested / security.current_value) * 100) : "TBC"}</strong><small>Calculated</small></div>
          <div class="metric"><span>Regulated</span><strong>${escapeHtml(caseRecord.regulated_status)}</strong><small>Blocks invalid submissions</small></div>
        </div>
      </div>
      <div class="band-body">
        ${matches.length ? `
          ${renderMatchCards("Best Matches", bestMatches)}
          ${renderMatchCards("Possible Matches", possibleMatches)}
          ${renderMatchCards("Not Suitable", notSuitable)}
          <details class="manual-panel">
            <summary>Advanced search</summary>
            <div class="form-grid three" style="margin-top:14px;">
              <div class="field"><label>Product</label><input value="${valueAttr(caseRecord.case_type)}" /></div>
              <div class="field"><label>Loan amount</label><input value="${valueAttr(caseRecord.loan_amount_requested)}" /></div>
              <div class="field"><label>Region</label><input placeholder="England, Wales..." /></div>
              <div class="field"><label>Security type</label><input value="${valueAttr(security?.security_type || "")}" /></div>
              <div class="field"><label>Charge type</label><input value="${valueAttr(security?.proposed_charge_type || "")}" /></div>
              <div class="field"><label>Regulated status</label><input value="${valueAttr(caseRecord.regulated_status)}" /></div>
            </div>
          </details>
        ` : `<div class="empty-state">Run lender search to produce AI-suggested Best, Possible and Not Suitable lender groups.</div>`}
      </div>
    </section>
  `;
}

function renderLenderSubmissions(caseRecord) {
  const submissions = caseSubmissions(caseRecord.id);
  return `
    <section class="band">
      <div class="band-header">
        <div><h3>Lender submissions</h3><p>Email-only lenders receive a branded placeholder email with a secure credit dashboard link and response token.</p></div>
      </div>
      <div class="band-body table-wrap">
        <table>
          <thead><tr><th>Lender</th><th>Level</th><th>Status</th><th>Decision</th><th>Response link</th><th>Action</th></tr></thead>
          <tbody>
            ${submissions.map((submission) => {
              const lender = state.lenderProfiles.find((item) => item.id === submission.lender_id);
              return `
                <tr>
                  <td><strong>${escapeHtml(lender?.lender_name || "Unknown lender")}</strong><br><span class="subtle">${escapeHtml(lender?.platform_status || "")}</span></td>
                  <td>${escapeHtml(submission.submission_level)}</td>
                  <td>${statusPill(submission.status)}</td>
                  <td>${escapeHtml(submission.decision || "Awaited")}</td>
                  <td><a href="/lender-response/${submission.response_token}" data-link>${escapeHtml(submission.response_token)}</a></td>
                  <td><button class="button primary" type="button" data-action="send-submission" data-submission-id="${valueAttr(submission.id)}">Send enquiry</button></td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="6">No submissions yet. Add lenders from lender search.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCreditPaper(caseRecord) {
  const security = caseSecurities(caseRecord.id)[0];
  const parties = caseParties(caseRecord.id);
  const people = casePeople(caseRecord.id);
  const project = state.developmentProjects.find((item) => item.case_id === caseRecord.id);
  const bridge = state.bridgingLoans.find((item) => item.case_id === caseRecord.id);
  const docs = state.documents.filter((doc) => doc.case_id === caseRecord.id);
  const versions = state.creditPaperVersions.filter((version) => version.case_id === caseRecord.id);
  const submission = caseSubmissions(caseRecord.id)[0];
  const projectCalc = project ? calculateDevelopment(project) : null;
  const bridgeCalc = bridge ? calculateBridging(bridge) : null;
  return `
    <section class="surface-panel credit-paper-shell">
      <div class="section-heading">
        <div><h3>Lender credit-paper dashboard</h3><p>Credit-style lender view with download buttons logged as versioned placeholder outputs.</p></div>
        <div class="actions">
          <button class="button" type="button" data-action="download-credit-paper" data-case-id="${valueAttr(caseRecord.id)}" data-format="PDF">Download PDF</button>
          <button class="button" type="button" data-action="download-credit-paper" data-case-id="${valueAttr(caseRecord.id)}" data-format="Word">Download Word</button>
          <button class="button" type="button" data-action="download-credit-paper" data-case-id="${valueAttr(caseRecord.id)}" data-format="Lender pack">Download lender pack</button>
        </div>
      </div>
        <div class="credit-hero">
          <div>
            <div class="eyebrow">Executive summary</div>
            <h2>${escapeHtml(caseRecord.case_reference)} - ${escapeHtml(caseParty(caseRecord)?.name || "Borrower TBC")}</h2>
            <p>${escapeHtml(caseRecord.summary || "No executive summary yet.")}</p>
          </div>
          <div class="actions">
            ${submission ? `<a class="button primary" href="/lender-response/${valueAttr(submission.response_token)}" data-link>Lender action buttons</a>` : ""}
          </div>
        </div>
        <div class="case-metric-row compact-row" style="margin-top:18px;">
          <div class="metric"><span>Loan request</span><strong>${formatMoney(caseRecord.loan_amount_requested)}</strong><small>${escapeHtml(caseRecord.case_type)}</small></div>
          <div class="metric"><span>Security value</span><strong>${formatMoney(security?.current_value)}</strong><small>${escapeHtml(security?.security_type || "Security")}</small></div>
          <div class="metric"><span>GDV</span><strong>${formatMoney(security?.gdv || project?.gdv)}</strong><small>Where applicable</small></div>
          <div class="metric"><span>Readiness</span><strong>${caseRecord.submission_readiness_score || 0}%</strong><small>${escapeHtml(caseRecord.regulated_status)}</small></div>
        </div>
        <div class="grid two paper-grid" style="margin-top:18px;">
          <div class="alert amber"><strong>Risk flags</strong><br>${(caseRecord.missing_information || []).map(escapeHtml).join("<br>") || "No current risk flags."}</div>
          <div class="alert green"><strong>Mitigants</strong><br>Broker packaging, source log, compliance assessment, document checklist and lender-specific appetite review are captured before submission.</div>
        </div>
        <div class="grid two paper-grid" style="margin-top:18px;">
          <div class="paper-section">
            <h3>Borrower and connected parties</h3>
            ${parties.map((party) => `<p><strong>${escapeHtml(party.name)}</strong> - ${escapeHtml(party.applicant_type)} / ${escapeHtml(party.role)}</p>`).join("")}
            ${people.map((person) => `<p>${escapeHtml(person.full_legal_name)} - ${escapeHtml(person.role)}</p>`).join("")}
          </div>
          <div class="paper-section">
            <h3>Loan and project metrics</h3>
            ${project ? `
              <dl class="kv">
                <dt>GDV</dt><dd>${formatMoney(project.gdv)}</dd>
                <dt>Costs</dt><dd>${formatMoney(project.development_costs)}</dd>
                <dt>Day-one loan</dt><dd>${formatMoney(project.day_one_loan)}</dd>
                <dt>Total net loan</dt><dd>${formatMoney(project.total_net_loan)}</dd>
                <dt>Net LT-GDV</dt><dd>${formatPercent(projectCalc?.net_lt_gdv || 0)}</dd>
                <dt>Profit on GDV</dt><dd>${formatPercent(projectCalc?.profit_on_gdv || 0)}</dd>
              </dl>
            ` : `
              <dl class="kv">
                <dt>Gross loan</dt><dd>${formatMoney(bridge?.gross_loan)}</dd>
                <dt>Term</dt><dd>${escapeHtml(bridge?.term || "TBC")} months</dd>
                <dt>LTV</dt><dd>${formatPercent(bridgeCalc?.ltv || 0)}</dd>
                <dt>Exit</dt><dd>${escapeHtml(bridge?.exit_strategy || "TBC")}</dd>
              </dl>
            `}
          </div>
        </div>
        <div class="grid two paper-grid" style="margin-top:18px;">
          <div class="paper-section">
            <h3>Security summary</h3>
            <dl class="kv">
              <dt>Address</dt><dd>${escapeHtml(security?.security_address || "TBC")}</dd>
              <dt>Owner</dt><dd>${escapeHtml(security?.owner || "TBC")}</dd>
              <dt>Charge</dt><dd>${escapeHtml(security?.proposed_charge_type || "TBC")}</dd>
              <dt>Valuation</dt><dd>${escapeHtml(security?.valuation_status || "TBC")}</dd>
            </dl>
          </div>
          <div class="paper-section">
            <h3>Broker note and missing information</h3>
            <p>${escapeHtml(caseRecord.summary || "No broker note recorded.")}</p>
            <p class="subtle">${(caseRecord.missing_information || []).map(escapeHtml).join(", ") || "No missing information logged."}</p>
          </div>
        </div>
        <div class="grid two paper-grid" style="margin-top:18px;">
          <div class="paper-section">
            <h3>Documents</h3>
            <p>${docs.map((doc) => `${escapeHtml(doc.document_type)} (${escapeHtml(doc.status)})`).join(", ") || "No documents uploaded."}</p>
          </div>
          <div class="paper-section">
            <h3>Credit paper versions</h3>
            <p>${versions.map((version) => `v${version.version} ${escapeHtml(version.format)} ${escapeHtml(dateOnly(version.generated_date))}`).join(", ") || "No versions yet."}</p>
          </div>
        </div>
    </section>
  `;
}

function renderQuoteComparison(caseRecord) {
  const quotes = caseQuotes(caseRecord.id);
  const received = quotes.filter((quote) => Number(quote.loan_amount) > 0);
  const cheapestTotal = received.reduce((best, quote) => {
    const total = calculateQuoteTotals(quote).total_estimated_cost;
    return !best || total < best.total ? { quote, total } : best;
  }, null);
  const highestLoan = received.reduce((best, quote) => !best || quote.loan_amount > best.loan_amount ? quote : best, null);
  const lowestPg = received.reduce((best, quote) => !best || quote.personal_guarantee_amount < best.personal_guarantee_amount ? quote : best, null);
  const lowestMonthly = received.reduce((best, quote) => !best || quote.monthly_interest_cost < best.monthly_interest_cost ? quote : best, null);
  const awaited = quotes.filter((quote) => quote.quote_status === "Awaited");
  return `
    <section class="surface-panel quote-page-header">
      <div class="section-heading">
        <div>
          <h3>Quote comparison</h3>
          <p>Compare lender terms side by side and prepare client explanation.</p>
        </div>
        <div class="actions compact-actions">
          <button class="button primary" type="button" data-action="draft-quote-email" data-case-id="${valueAttr(caseRecord.id)}">Draft client comparison</button>
          <a class="button ghost" href="#add-quote">Add quote</a>
        </div>
      </div>
      <div class="quote-summary-strip">
        <span><strong>Highest loan</strong>${escapeHtml(highestLoan?.lender_name || "TBC")}</span>
        <span><strong>Lowest cost</strong>${escapeHtml(cheapestTotal?.quote.lender_name || "TBC")}</span>
        <span><strong>Lowest PG</strong>${escapeHtml(lowestPg?.lender_name || "TBC")}</span>
        <span><strong>Lowest monthly</strong>${escapeHtml(lowestMonthly?.lender_name || "TBC")}</span>
        <span><strong>Awaiting</strong>${awaited.map((quote) => escapeHtml(quote.lender_name)).join(", ") || "None"}</span>
      </div>
    </section>
    <section class="quote-card-grid">
        ${quotes.map((quote) => {
          const totals = calculateQuoteTotals(quote);
          const isCheapest = cheapestTotal?.quote.id === quote.id;
          const labels = [
            highestLoan?.id === quote.id ? "Highest loan" : "",
            isCheapest ? "Lowest cost" : "",
            lowestPg?.id === quote.id ? "Lowest PG" : "",
            lowestMonthly?.id === quote.id ? "Lowest monthly" : "",
            /flexible|breakage to confirm|no early/i.test(`${quote.breakage_costs} ${quote.notes}`) ? "Most flexible" : "",
            quote.quote_status === "Broker approved" ? "Broker recommended" : "",
            quote.quote_status === "Awaited" ? "Awaited" : ""
          ].filter(Boolean);
          const selectedLabel = labels.some((label) => label.includes("Highest")) ? "Highest Loan"
            : labels.some((label) => label.includes("Lowest cost")) ? "Lowest Cost"
              : labels.some((label) => label.includes("Lowest PG")) ? "Lowest PG"
                : labels.some((label) => label.includes("flexible")) ? "Most Flexible"
                  : quote.quote_status === "Broker approved" ? "Broker Recommended"
                    : "Needs Review";
          return `
            <article class="quote-lender-card">
              <div class="quote-card-head">
                <div>
                  <h4>${escapeHtml(quote.lender_name)}</h4>
                  <div class="tag-row">${labels.map((label) => `<span class="soft-tag">${escapeHtml(label)}</span>`).join("") || `<span class="soft-tag amber">Needs review</span>`}</div>
                </div>
                ${statusPill(quote.quote_status)}
              </div>
              <div class="quote-stat-grid">
                <div><span>Loan</span><strong>${quote.loan_amount ? formatMoney(quote.loan_amount) : "Awaited"}</strong></div>
                <div><span>Rate</span><strong>${quote.interest_rate ? formatPercent(quote.interest_rate) : "Awaited"}</strong></div>
                <div><span>Fee</span><strong>${quote.arrangement_fee_percentage ? formatPercent(quote.arrangement_fee_percentage) : "Awaited"}</strong></div>
                <div><span>Annual cost</span><strong>${quote.annual_interest_cost ? formatMoney(quote.annual_interest_cost) : "Awaited"}</strong></div>
                <div><span>Monthly</span><strong>${quote.monthly_interest_cost ? formatMoney(quote.monthly_interest_cost) : "Awaited"}</strong></div>
                <div><span>PG</span><strong>${quote.personal_guarantee_amount ? `${formatPercent(quote.personal_guarantee_percentage)}` : "Awaited"}</strong></div>
                <div><span>Breakage</span><strong>${escapeHtml(quote.breakage_costs || "Awaited")}</strong></div>
                <div><span>Total cost</span><strong>${quote.loan_amount ? formatMoney(totals.total_estimated_cost) : "Awaited"}</strong></div>
              </div>
              <div class="client-toggle"><span>Client-visible</span><strong>${quote.quote_status === "Broker approved" || quote.quote_status === "Sent to client" ? "On" : "Off"}</strong></div>
              <div class="quote-review-buttons">
                <strong>Broker recommendation</strong>
                <div class="tag-row editable-tags">
                  ${quoteLabelOptions.map((label) => `<button class="tag-button ${label === selectedLabel ? "active" : ""}" type="button">${escapeHtml(label)}</button>`).join("")}
                </div>
              </div>
              <div class="pros-cons-grid">
                <div><h4>Pros</h4><p>${(quote.pros || []).slice(0, 3).map(escapeHtml).join("<br>") || "Generate broker-editable pros."}</p></div>
                <div><h4>Cons</h4><p>${(quote.cons || []).slice(0, 3).map(escapeHtml).join("<br>") || "Generate broker-editable cons."}</p></div>
              </div>
              <div class="actions compact-actions"><button class="button ghost" type="button" data-action="generate-pros-cons" data-quote-id="${valueAttr(quote.id)}">Regenerate</button><button class="button ghost" type="button">Hide from client</button></div>
              <details class="manual-panel">
                <summary>View full terms</summary>
                <dl class="kv" style="margin-top:12px;">
                  <dt>LT-CMV</dt><dd>${quote.ltv_ltcmv ? formatPercent(quote.ltv_ltcmv) : "Awaited"}</dd>
                  <dt>Capital raise</dt><dd>${quote.capital_raise ? formatMoney(quote.capital_raise) : "Awaited"}</dd>
                  <dt>Arrangement fee amount</dt><dd>${quote.arrangement_fee_amount ? formatMoney(quote.arrangement_fee_amount) : "Awaited"}</dd>
                  <dt>Term</dt><dd>${escapeHtml(quote.term_duration || "Awaited")}</dd>
                  <dt>ICR</dt><dd>${escapeHtml(quote.icr || "TBC")}</dd>
                  <dt>DSCR</dt><dd>${escapeHtml(quote.dscr || "TBC")}</dd>
                  <dt>Conditions</dt><dd>${escapeHtml(quote.conditions || "Awaited")}</dd>
                  <dt>Cost per pound</dt><dd>${quote.loan_amount ? `£${totals.cost_per_pound_borrowed.toFixed(2)}` : "Awaited"}</dd>
                  <dt>Broker notes</dt><dd>${escapeHtml(quote.notes || "No broker notes yet.")}</dd>
                </dl>
              </details>
            </article>
          `;
        }).join("") || `<div class="empty-state">No quotes added yet.</div>`}
    </section>
    <section id="add-quote" class="surface-panel">
      <details class="manual-panel">
        <summary>Add or AI-extract quote manually</summary>
        <form class="form-grid three" data-form="add-quote" data-case-id="${valueAttr(caseRecord.id)}" style="margin-top:14px;">
          <div class="field"><label>Lender</label><select name="lender_id">${state.lenderProfiles.map((lender) => `<option value="${valueAttr(lender.id)}">${escapeHtml(lender.lender_name)}</option>`).join("")}</select></div>
          <div class="field"><label>Quote type</label><select name="quote_type">${optionList(["Indicative terms", "Credit-backed terms", "Formal offer", "Revised offer"], "Indicative terms")}</select></div>
          <div class="field"><label>Status</label><select name="quote_status">${optionList(["Awaited", "Received", "AI extracted", "Broker review required", "Broker approved", "Sent to client", "Client selected"], "Received")}</select></div>
          <div class="field"><label>Loan amount</label><input name="loan_amount" inputmode="decimal" /></div>
          <div class="field"><label>CMV / value</label><input name="cmv_property_value" inputmode="decimal" /></div>
          <div class="field"><label>Interest rate %</label><input name="interest_rate" inputmode="decimal" /></div>
          <div class="field"><label>Arrangement fee %</label><input name="arrangement_fee_percentage" inputmode="decimal" /></div>
          <div class="field"><label>PG %</label><input name="personal_guarantee_percentage" inputmode="decimal" /></div>
          <div class="field"><label>Notes</label><input name="notes" /></div>
          <div class="actions"><button class="button primary" type="submit">Add quote</button></div>
        </form>
      </details>
    </section>
    ${state.ui.latest_client_email_drafts?.[caseRecord.id] ? `
      <section class="band">
        <div class="band-header"><div><h3>Client comparison email draft</h3><p>Editable broker draft. Nothing is sent automatically.</p></div></div>
        <div class="band-body"><pre style="white-space:pre-wrap;margin:0;">${escapeHtml(state.ui.latest_client_email_drafts[caseRecord.id])}</pre></div>
      </section>
    ` : ""}
  `;
}

function renderCommission(caseRecord) {
  const ledger = state.commissionLedger.find((item) => item.case_id === caseRecord.id) || {};
  return `
    <section class="band">
      <div class="band-header"><div><h3>Commission ledger</h3><p>Expected broker, lender, platform and introducer income with invoice/payment status.</p></div></div>
      <form class="band-body" data-form="save-commission" data-case-id="${valueAttr(caseRecord.id)}" data-ledger-id="${valueAttr(ledger.id || "")}">
        <div class="form-grid three">
          <div class="field"><label>Expected broker fee</label><input name="expected_broker_fee" value="${valueAttr(ledger.expected_broker_fee || 0)}" inputmode="decimal" /></div>
          <div class="field"><label>Expected lender procuration fee</label><input name="expected_lender_procuration_fee" value="${valueAttr(ledger.expected_lender_procuration_fee || 0)}" inputmode="decimal" /></div>
          <div class="field"><label>Platform override</label><input name="platform_override" value="${valueAttr(ledger.platform_override || 0)}" inputmode="decimal" /></div>
          <div class="field"><label>UKA / LendTech share</label><input name="uka_lendtech_share" value="${valueAttr(ledger.uka_lendtech_share || 0)}" inputmode="decimal" /></div>
          <div class="field"><label>Broker share</label><input name="broker_share" value="${valueAttr(ledger.broker_share || 0)}" inputmode="decimal" /></div>
          <div class="field"><label>Introducer share</label><input name="introducer_share" value="${valueAttr(ledger.introducer_share || 0)}" inputmode="decimal" /></div>
          <div class="field"><label>Invoice status</label><select name="invoice_status">${optionList(["Not invoiced", "Draft", "Sent", "Paid", "Disputed"], ledger.invoice_status || "Not invoiced")}</select></div>
          <div class="field"><label>Payment status</label><select name="payment_status">${optionList(["Not due", "Due", "Part paid", "Paid", "Overdue"], ledger.payment_status || "Not due")}</select></div>
          <div class="field"><label>Due date</label><input name="due_date" type="date" value="${valueAttr(ledger.due_date || "")}" /></div>
        </div>
        <div class="field" style="margin-top:14px;"><label>Notes</label><textarea name="notes">${escapeHtml(ledger.notes || "")}</textarea></div>
        <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Save commission ledger</button></div>
      </form>
    </section>
  `;
}

function renderBrokerProfilePage() {
  const broker = state.brokerProfiles[0];
  const cases = state.cases.filter((caseRecord) => caseRecord.broker_id === broker?.id);
  const activity = state.auditLogs.filter((log) => cases.some((caseRecord) => caseRecord.id === log.case_id)).slice(0, 5);
  return `
    <div class="grid four">
      <div class="metric"><span>Cases</span><strong>${cases.length}</strong><small>Assigned pipeline</small></div>
      <div class="metric"><span>Regulated</span><strong>${broker?.regulated_adviser ? "Yes" : "No"}</strong><small>Adviser status</small></div>
      <div class="metric"><span>Products</span><strong>${[broker?.can_submit_bridging ? "Bridge" : "", broker?.can_submit_development_finance ? "Dev" : ""].filter(Boolean).join(" / ") || "TBC"}</strong><small>Permissions</small></div>
      <div class="metric"><span>Commission view</span><strong>${formatMoney(cases.reduce((sum, caseRecord) => sum + commissionExpected(caseRecord), 0))}</strong><small>Permissioned estimate</small></div>
    </div>
    <section class="band">
      <div class="band-header"><div><h3>Broker profile</h3><p>Name, contact, permissions, regulated status and signature.</p></div></div>
      <div class="band-body grid two">
        <div class="profile-panel">
          <h3>${escapeHtml(broker?.full_name || "Broker")}</h3>
          <dl class="kv">
            <dt>Email</dt><dd>${escapeHtml(broker?.email || "TBC")}</dd>
            <dt>Phone</dt><dd>${escapeHtml(broker?.phone || "TBC")}</dd>
            <dt>Brokerage</dt><dd>${escapeHtml(caseBrokerage(cases[0])?.brokerage_name || "UK Adviser")}</dd>
            <dt>Signature</dt><dd>${escapeHtml(broker?.signature_block || "TBC")}</dd>
          </dl>
        </div>
        <div class="profile-panel">
          <h3>Activity</h3>
          ${renderTimeline(activity)}
        </div>
      </div>
    </section>
  `;
}

function renderBrokerageProfilePage() {
  const brokerage = state.brokerageProfiles[0];
  const users = state.brokerProfiles.filter((broker) => broker.brokerage_id === brokerage?.id);
  return `
    <section class="band">
      <div class="band-header"><div><h3>Brokerage profile</h3><p>Branding, regulatory permissions, users and client-facing submission footer.</p></div></div>
      <div class="band-body grid two">
        <div class="profile-panel">
          <div class="brand-card"><span>${escapeHtml(brokerage?.logo || "BG")}</span><strong>${escapeHtml(brokerage?.brokerage_name || "Brokerage")}</strong></div>
          <dl class="kv">
            <dt>Website</dt><dd>${escapeHtml(brokerage?.website || "TBC")}</dd>
            <dt>FCA / AR</dt><dd>${escapeHtml(brokerage?.fca_status || "TBC")} / ${escapeHtml(brokerage?.appointed_representative_status || "TBC")}</dd>
            <dt>FCA ref</dt><dd>${escapeHtml(brokerage?.fca_reference_number || "TBC")}</dd>
            <dt>ICO</dt><dd>${escapeHtml(brokerage?.ico_registration_number || "TBC")}</dd>
          </dl>
        </div>
        <div class="profile-panel">
          <h3>Permissions and users</h3>
          <div class="label-row">
            ${statusPill(brokerage?.can_submit_regulated_deals ? "Regulated deals allowed" : "Regulated deals blocked")}
            ${statusPill(brokerage?.can_submit_unregulated_deals ? "Unregulated deals allowed" : "Unregulated deals blocked")}
          </div>
          <p class="subtle">Users: ${users.map((broker) => escapeHtml(broker.full_name)).join(", ") || "No users added."}</p>
          <p><strong>Submission footer</strong><br>${escapeHtml(brokerage?.submission_footer_text || "No footer set.")}</p>
        </div>
      </div>
    </section>
  `;
}

function renderClientProfilePage() {
  const client = state.applicationParties[0];
  const cases = state.cases.filter((caseRecord) => caseRecord.client_id === client?.id || caseParties(caseRecord.id).some((party) => party.id === client?.id));
  const tasks = state.clientTasks.filter((task) => cases.some((caseRecord) => caseRecord.id === task.case_id));
  const docs = state.documents.filter((doc) => cases.some((caseRecord) => caseRecord.id === doc.case_id));
  const consents = state.consentRecords.filter((consent) => cases.some((caseRecord) => caseRecord.id === consent.case_id));
  return `
    <div class="grid four">
      <div class="metric"><span>Cases</span><strong>${cases.length}</strong><small>Linked to client</small></div>
      <div class="metric"><span>Tasks</span><strong>${tasks.length}</strong><small>Secure requests</small></div>
      <div class="metric"><span>Documents</span><strong>${docs.length}</strong><small>Shared or requested</small></div>
      <div class="metric"><span>Consents</span><strong>${consents.length}</strong><small>Data sharing controls</small></div>
    </div>
    <section class="band">
      <div class="band-header"><div><h3>Client profile placeholder</h3><p>Client-facing data stays clean: no internal broker strategy, raw AI output or commission detail.</p></div></div>
      <div class="band-body grid two">
        <div class="profile-panel">
          <h3>${escapeHtml(client?.name || "Client")}</h3>
          <dl class="kv">
            <dt>Company</dt><dd>${escapeHtml(client?.name || "TBC")}</dd>
            <dt>Email</dt><dd>${escapeHtml(client?.email || "TBC")}</dd>
            <dt>Phone</dt><dd>${escapeHtml(client?.phone || "TBC")}</dd>
            <dt>Quote views</dt><dd>Broker-approved comparisons only</dd>
          </dl>
        </div>
        <div class="profile-panel">
          <h3>Visible client items</h3>
          <p>Tasks, documents, consent records, messages and released quote comparisons will appear here as the client portal matures.</p>
          <div class="label-row">${statusPill("Internal notes hidden")} ${statusPill("Commission hidden")} ${statusPill("Raw AI hidden")}</div>
        </div>
      </div>
    </section>
  `;
}

function renderLenderProfilePage() {
  const lender = state.lenderProfiles.find((item) => item.id === "lender-uklg") || state.lenderProfiles[0];
  const appetites = state.lenderAppetites.filter((appetite) => appetite.lender_id === lender?.id);
  const submissions = state.caseLenderSubmissions.filter((submission) => submission.lender_id === lender?.id);
  const settings = state.whiteLabelApplicationSettings.find((item) => item.lender_id === lender?.id);
  return `
    <div class="grid four">
      <div class="metric"><span>Products</span><strong>${appetites.length}</strong><small>Active appetite records</small></div>
      <div class="metric"><span>Applications</span><strong>${submissions.length}</strong><small>Received through LendTech</small></div>
      <div class="metric"><span>Terms issued</span><strong>${submissions.filter((item) => item.status === "Indicative terms received").length}</strong><small>Structured responses</small></div>
      <div class="metric"><span>White-label</span><strong>${settings?.status || "draft"}</strong><small>/apply/${escapeHtml(settings?.application_link_slug || "slug")}</small></div>
    </div>
    <section class="band">
      <div class="band-header"><div><h3>${escapeHtml(lender?.lender_name || "Lender profile")}</h3><p>Lender profile, appetite, response history, decline reasons and white-label settings.</p></div><a class="button primary" href="/lender/dashboard" data-link>Open lender workflow</a></div>
      <div class="band-body grid two">
        <div class="profile-panel">
          <dl class="kv">
            <dt>Type</dt><dd>${escapeHtml(lender?.lender_type || "TBC")}</dd>
            <dt>Website</dt><dd>${escapeHtml(lender?.website || "TBC")}</dd>
            <dt>Submission email</dt><dd>${escapeHtml(lender?.submission_email || "TBC")}</dd>
            <dt>Relationship manager</dt><dd>${escapeHtml(lender?.relationship_manager || "TBC")}</dd>
          </dl>
        </div>
        <div class="profile-panel">
          <h3>Appetite freshness</h3>
          ${appetites.map((appetite) => `<p><strong>${escapeHtml(appetite.product_type)}</strong> ${freshnessPill(appetite)}<br><span class="subtle">${escapeHtml(appetite.sub_product)} - max ${formatMoney(appetite.maximum_loan)}</span></p>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderBrokeragesAdmin() {
  return renderSimpleAdminTable("Brokerage profiles", state.brokerageProfiles, ["brokerage_name", "fca_status", "can_submit_regulated_deals", "can_submit_unregulated_deals", "status"]);
}

function renderBrokersAdmin() {
  return renderSimpleAdminTable("Broker profiles", state.brokerProfiles, ["full_name", "email", "regulated_adviser", "can_submit_bridging", "can_submit_development_finance", "status"]);
}

function renderLendersAdmin() {
  return `
    ${renderSimpleAdminTable("Lender profiles", state.lenderProfiles, ["lender_name", "lender_type", "platform_status", "accepts_bridging", "accepts_development_finance", "accepts_regulated_deals"])}
    <section class="band">
      <div class="band-header"><div><h3>Lender appetite records</h3><p>All matching uses appetite records. Freshness labels are review controls, not automatic updates.</p></div></div>
      <div class="band-body table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Sub-product</th><th>Loan range</th><th>Max LTV</th><th>Max LT-GDV</th><th>Freshness</th><th>Status</th></tr></thead>
          <tbody>
            ${state.lenderAppetites.map((appetite) => `<tr><td>${escapeHtml(appetite.product_type)}</td><td>${escapeHtml(appetite.sub_product)}</td><td>${formatMoney(appetite.minimum_loan)} - ${formatMoney(appetite.maximum_loan)}</td><td>${formatPercent(appetite.max_ltv || 0)}</td><td>${appetite.max_lt_gdv ? formatPercent(appetite.max_lt_gdv) : "N/A"}</td><td>${freshnessPill(appetite)}</td><td>${statusPill(appetite.status)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
    ${renderSimpleAdminTable("White-label application settings", state.whiteLabelApplicationSettings, ["application_link_slug", "custom_domain_subdomain", "enabled_products", "auto_create_case", "auto_create_lender_submission", "status"])}
  `;
}

function renderMarketIntelligenceAdmin() {
  const reviewRows = [
    { source: "Moneyfacts export placeholder", lender: "Potential Specialist Lender", product: "Bridging Finance", status: "Pending admin review", confidence: "medium" },
    { source: "Product sheet PDF placeholder", lender: "Existing lender appetite update", product: "Development Finance", status: "Duplicate check required", confidence: "low" }
  ];
  return `
    <section class="band">
      <div class="band-header">
        <div><h3>Controlled lender criteria import</h3><p>Future Moneyfacts, product sheet, PDF and lender document extraction. Nothing scrapes, sends or updates automatically.</p></div>
      </div>
      <div class="band-body">
        <div class="workflow-steps">
          ${["Upload source file or enter approved source URL", "AI extracts lender and product criteria", "Duplicate lenders are detected", "Items enter admin review queue", "Admin approves, edits, rejects, merges or asks lender to confirm", "Only approved data updates LenderProfile or LenderAppetite", "Source, date, confidence and audit trail are stored"].map((step, index) => `<div class="step-card"><span>${index + 1}</span><strong>${escapeHtml(step)}</strong></div>`).join("")}
        </div>
        <div class="grid two" style="margin-top:18px;">
          <div class="profile-panel">
            <h3>Import source placeholder</h3>
            <div class="field"><label>Source URL</label><input placeholder="https://approved-source.example/product-sheet.pdf" /></div>
            <div class="field"><label>Source file</label><input placeholder="moneyfacts-export.csv or product-sheet.pdf" /></div>
            <div class="actions" style="margin-top:14px;"><button class="button primary" type="button" disabled>Queue extraction placeholder</button></div>
          </div>
          <div class="profile-panel">
            <h3>Freshness labels</h3>
            <div class="label-row">
              ${["Fresh", "Current", "Stale", "Outdated", "Unverified", "Lender confirmed", "Admin confirmed", "AI extracted only"].map((label) => `<span class="status ${["Fresh", "Current", "Lender confirmed", "Admin confirmed"].includes(label) ? "green" : ["Stale", "Unverified", "AI extracted only"].includes(label) ? "amber" : "red"}">${escapeHtml(label)}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="band">
      <div class="band-header"><div><h3>Review queue placeholder</h3><p>Admin-controlled queue for extracted lender criteria.</p></div></div>
      <div class="band-body table-wrap">
        <table>
          <thead><tr><th>Source</th><th>Lender</th><th>Product</th><th>Status</th><th>Confidence</th><th>Controls</th></tr></thead>
          <tbody>
            ${reviewRows.map((row) => `<tr><td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.lender)}</td><td>${escapeHtml(row.product)}</td><td>${statusPill(row.status)}</td><td>${escapeHtml(row.confidence)}</td><td><div class="actions"><button class="button" disabled>Approve</button><button class="button" disabled>Edit</button><button class="button" disabled>Reject</button><button class="button" disabled>Merge</button></div></td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderProductsAdmin() {
  return renderSimpleAdminTable("Products", state.products, ["product_name", "status", "requires_real_estate_security", "supports_regulated_cases", "supports_white_label_lender_application", "calculator_type"]);
}

function renderAuditAdmin() {
  return `
    <section class="band">
      <div class="band-header"><div><h3>Platform audit</h3><p>Cross-case audit trail for core MVP actions.</p></div></div>
      <div class="band-body">${renderTimeline(state.auditLogs.slice(0, 50))}</div>
    </section>
  `;
}

function renderCaseAuditTab(caseRecord) {
  return `
    <section class="band">
      <div class="band-header">
        <div><h3>Case audit history</h3><p>Source, approval and change history for this case.</p></div>
      </div>
      <div class="band-body">${renderTimeline(caseAudit(caseRecord.id))}</div>
    </section>
  `;
}

function renderSimpleAdminTable(title, rows, fields) {
  return `
    <section class="band">
      <div class="band-header"><div><h3>${escapeHtml(title)}</h3><p>${rows.length} records</p></div></div>
      <div class="band-body table-wrap">
        <table>
          <thead><tr>${fields.map((field) => `<th>${escapeHtml(field.replaceAll("_", " "))}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>${fields.map((field) => `<td>${Array.isArray(row[field]) ? row[field].map(escapeHtml).join(", ") : escapeHtml(row[field])}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderLenderDashboard() {
  const uklg = state.lenderProfiles.find((lender) => lender.id === "lender-uklg");
  const submissions = state.caseLenderSubmissions.filter((submission) => submission.lender_id === uklg?.id);
  return `
    <section class="lender-hero">
      <div>
        <div class="brand-card compact"><span>${escapeHtml(uklg?.logo || "UKLG")}</span><strong>${escapeHtml(uklg?.lender_name || "Lender")}</strong></div>
        <h2>Credit-paper application queue</h2>
        <p>Review white-label and broker-submitted applications in one clean lender workspace.</p>
      </div>
      <a class="button primary" href="/apply/uk-lender-group" data-link>Open application link</a>
    </section>
    <div class="case-metric-row compact-row">
      <div class="metric"><span>Applications</span><strong>${submissions.length}</strong><small>Assigned in LendTech</small></div>
      <div class="metric"><span>Responses needed</span><strong>${submissions.filter((item) => ["Sent", "Viewed", "Draft"].includes(item.status)).length}</strong><small>Credit team queue</small></div>
      <div class="metric"><span>Terms issued</span><strong>${submissions.filter((item) => item.status === "Indicative terms received").length}</strong><small>Structured responses</small></div>
    </div>
    <section class="surface-panel">
      <div class="section-heading"><div><h3>Credit queue</h3><p>Applications open into a lender-ready credit paper.</p></div></div>
      <div class="lender-queue">
        ${submissions.map((submission) => {
          const caseRecord = getCase(submission.case_id);
          const party = state.applicationParties.find((item) => item.id === caseRecord?.client_id);
          return `
            <article class="lender-queue-card">
              <div>
                <a href="/cases/${caseRecord.id}/credit-paper" data-link><strong>${escapeHtml(caseRecord.case_reference)}</strong></a>
                <p>${escapeHtml(party?.name || "TBC")} · ${escapeHtml(caseRecord.case_type)}</p>
              </div>
              <span>${formatMoney(caseRecord.loan_amount_requested)}</span>
              ${statusPill(submission.status)}
              <a class="button compact" href="/lender-response/${submission.response_token}" data-link>Respond</a>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderLenderApplications() {
  return `
    <section class="band">
      <div class="band-header"><div><h3>White-label applications</h3><p>The UK Lender Group applications created through /apply/uk-lender-group.</p></div><a class="button primary" href="/apply/uk-lender-group" data-link>Open application link</a></div>
      <div class="band-body table-wrap">
        <table>
          <thead><tr><th>Case</th><th>Source</th><th>Applicant</th><th>Product</th><th>Loan</th><th>Status</th></tr></thead>
          <tbody>
            ${state.cases.filter((caseRecord) => caseRecord.source_lender_id === "lender-uklg" || caseRecord.source_application_link === "/apply/uk-lender-group").map((caseRecord) => {
              const party = state.applicationParties.find((item) => item.id === caseRecord.client_id);
              return `<tr><td><a href="/cases/${caseRecord.id}/credit-paper" data-link>${escapeHtml(caseRecord.case_reference)}</a></td><td>${escapeHtml(caseRecord.source_application_link)}</td><td>${escapeHtml(party?.name || "TBC")}</td><td>${escapeHtml(caseRecord.case_type)}</td><td>${formatMoney(caseRecord.loan_amount_requested)}</td><td>${statusPill(caseRecord.status)}</td></tr>`;
            }).join("") || `<tr><td colspan="6">No direct white-label applications yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderWhiteLabelApplication(slug) {
  const settings = state.whiteLabelApplicationSettings.find((item) => item.application_link_slug === slug);
  const lender = state.lenderProfiles.find((item) => item.id === settings?.lender_id);
  if (!settings || !lender) return `<main class="login-screen"><section class="band"><div class="band-body">Application link not found.</div></section></main>`;
  const submittedCaseId = new URLSearchParams(window.location.search).get("submitted");
  if (submittedCaseId) {
    const submittedCase = getCase(submittedCaseId);
    return `
      <main class="login-screen">
        <section class="band" style="width:min(760px,100%);">
          <div class="band-header" style="background:#172331;color:#fff;">
            <div>
              <div class="brand-mark">${escapeHtml(lender.logo || "L")}</div>
              <h3>Application submitted</h3>
              <p style="color:#d9e1e8;">${escapeHtml(lender.lender_name)} has received a structured LendTech application record.</p>
            </div>
          </div>
          <div class="band-body">
            <dl class="kv">
              <dt>Reference</dt><dd>${escapeHtml(submittedCase?.case_reference || submittedCaseId)}</dd>
              <dt>Status</dt><dd>${escapeHtml(submittedCase?.status || "Submitted")}</dd>
              <dt>Next step</dt><dd>The lender team can review the case in the internal dashboard.</dd>
            </dl>
            <div class="actions">
              <a class="button primary" href="/apply/${valueAttr(settings.application_link_slug)}" data-link>Start another application</a>
              <a class="button" href="/login" data-link>Platform login</a>
            </div>
          </div>
        </section>
      </main>
    `;
  }
  const enabledProducts = [...new Set([
    ...((settings.enabled_products && settings.enabled_products.length) ? settings.enabled_products : ["Bridging Finance", "Development Finance"]),
    "Commercial Mortgage",
    "Other Property Finance"
  ])];
  const productCards = enabledProducts.map((productName) => ({
    value: productName,
    label: productName,
    icon: productName.startsWith("Bridge") ? "BR" : productName.startsWith("Development") ? "DV" : productName.startsWith("Commercial") ? "CM" : "PF",
    hint: productName === "Bridging Finance" ? "Short-term property finance for purchase, refinance or capital raise."
      : productName === "Development Finance" ? "Funding for build, conversion, refurbishment or development exits."
        : productName === "Commercial Mortgage" ? "Term debt for owner-occupied or investment property."
          : "For property finance that does not fit the standard routes."
  }));
  const applicantCards = applicantRouteOptions.map((item) => ({ value: item, label: item, icon: item.slice(0, 2).toUpperCase() }));
  const securityCards = ["Residential", "Commercial", "Semi-Commercial", "Land", "Development Site", "Mixed Use", "Other"].map((item) => ({ value: item, label: item, icon: item.slice(0, 2).toUpperCase() }));
  const applicationStages = ["Just enquiring", "Need terms", "Need to complete quickly", "Already have terms", "Refinance needed", "Planning stage", "Ready to fund"];
  const stageCards = applicationStages.map((item) => ({ value: item, label: item, icon: item.slice(0, 2).toUpperCase() }));
  return `
    <main class="white-label-page">
      <section class="white-label-card">
        <div class="wl-header">
          <div>
            <div class="brand-mark">${escapeHtml(lender.logo || "L")}</div>
            <h1>${escapeHtml(lender.lender_name)} application</h1>
            <p>Apply for bridging, development or property finance.</p>
            <span>Powered by LendTech</span>
          </div>
          <a class="button" href="/login" data-link>Platform login</a>
        </div>
        <form class="white-label-body" data-form="white-label-application" data-settings-id="${valueAttr(settings.id)}">
          <div class="mobile-progress"><span>Step 1 of 6</span><div class="progress"><span style="width:16%;"></span></div></div>
          <div class="workflow-steps compact">
            <div class="step-card"><span>1</span><strong>Who are you?</strong></div>
            <div class="step-card"><span>2</span><strong>Finance need</strong></div>
            <div class="step-card"><span>3</span><strong>Security</strong></div>
            <div class="step-card"><span>4</span><strong>Stage</strong></div>
            <div class="step-card"><span>5</span><strong>Upload or paste</strong></div>
            <div class="step-card"><span>6</span><strong>Consent</strong></div>
          </div>
          <div class="step-panel">
            <div class="guided-heading"><h3>1. Who are you?</h3>${fieldStatusBadge("User selected")}</div>
            ${renderOptionCards("applicant_route", applicantCards, "Broker")}
          </div>
          <div class="step-panel">
            <div class="guided-heading"><h3>2. Finance need</h3>${fieldStatusBadge("AI/API ready")}</div>
            ${renderOptionCards("product_name", productCards, enabledProducts[0])}
          </div>
          <div class="step-panel">
            <div class="guided-heading"><h3>3. Security</h3>${fieldStatusBadge("User selected")}</div>
            ${renderOptionCards("security_type", securityCards, "Residential")}
          </div>
          <div class="step-panel">
            <div class="guided-heading"><h3>4. Stage</h3>${fieldStatusBadge("Suggested routing")}</div>
            ${renderOptionCards("application_stage", stageCards, "Need terms", { compact: true })}
          </div>
          <div class="step-panel">
            <div class="guided-heading"><h3>5. Upload or paste</h3>${fieldStatusBadge("Documents optional")}</div>
            <div class="dropzone">
              <strong>Upload documents</strong>
              <span>Placeholder for ID, title, appraisal, cost plan, valuation, portfolio or term sheet uploads.</span>
              <div class="upload-choice-row">
                <button class="button" type="button">Upload files</button>
                <button class="button" type="button">Take photo</button>
                <button class="button" type="button">Paste notes</button>
                <button class="button" type="button">Continue without documents</button>
              </div>
            </div>
            <div class="field"><label>Application notes / brain dump</label><textarea name="brain_dump" placeholder="Tell us about the borrower, security, loan purpose, exit, timing and any documents available."></textarea></div>
            <details class="manual-panel">
              <summary>Add more details manually</summary>
              <div class="form-grid three" style="margin-top:14px;">
                <div class="field"><label>Borrower/applicant name</label><input name="client_name" /></div>
                <div class="field"><label>Company name</label><input name="company_name" /></div>
                <div class="field"><label>Loan amount requested</label><input name="loan_amount_requested" inputmode="decimal" /></div>
                <div class="field"><label>Client email</label><input name="client_email" type="email" /></div>
                <div class="field"><label>Client phone</label><input name="client_phone" /></div>
                <div class="field"><label>Broker/firm name</label><input name="broker_firm" /></div>
                <div class="field"><label>Broker email</label><input name="broker_email" type="email" /></div>
                <div class="field"><label>Security address</label><input name="security_address" /></div>
                <div class="field"><label>Estimated value / CMV</label><input name="current_value" inputmode="decimal" /></div>
                <div class="field"><label>GDV, if development</label><input name="gdv" inputmode="decimal" /></div>
              </div>
            </details>
          </div>
          <div class="step-panel consent-panel">
            <div class="guided-heading"><h3>6. Consent</h3>${fieldStatusBadge("Required")}</div>
            <p>I confirm I have authority to submit this enquiry and agree for the information to be processed and shared with ${escapeHtml(lender.lender_name)} for review.</p>
            ${renderOptionCards("consent_granted", [{ value: "true", label: "Yes" }, { value: "false", label: "No" }], "true", { compact: true })}
          </div>
          <div class="alert amber" style="margin-top:14px;">Submitting creates a LendTech case for ${escapeHtml(lender.lender_name)} only. It is not automatically sent to other lenders.</div>
          <div class="sticky-submit"><button class="button primary" type="submit">Submit application</button></div>
          <p class="subtle">${escapeHtml(settings.footer_text)}</p>
        </form>
      </section>
    </main>
  `;
}

function renderLenderResponse(token) {
  const submission = state.caseLenderSubmissions.find((item) => item.response_token === token);
  if (!submission) return `<main class="login-screen"><section class="band"><div class="band-body">This lender response link is not valid.</div></section></main>`;
  const caseRecord = getCase(submission.case_id);
  const lender = state.lenderProfiles.find((item) => item.id === submission.lender_id);
  return `
    <main class="login-screen">
      <section class="band" style="width:min(980px,100%);">
        <div class="band-header">
          <div>
            <h3>${escapeHtml(lender?.lender_name || "Lender")} response</h3>
            <p>${escapeHtml(caseRecord.case_reference)} - ${escapeHtml(caseRecord.case_type)} - ${formatMoney(caseRecord.loan_amount_requested)}</p>
          </div>
          <a class="button" href="/cases/${caseRecord.id}/credit-paper" data-link>View credit paper</a>
        </div>
        <form class="band-body" data-form="lender-response" data-submission-id="${valueAttr(submission.id)}">
          <div class="guided-section">
            <div class="guided-heading"><h3>Lender decision</h3>${fieldStatusBadge("Lender confirmed")}</div>
            ${renderOptionCards("decision", lenderResponseOptions, submission.decision || "Decision pending", { compact: true })}
          </div>
          <details class="manual-panel" open>
            <summary>Add reason, timescale or terms manually</summary>
            <div class="field" style="margin-top:14px;"><label>Timescale / reason</label><input name="reason" value="${valueAttr(submission.decline_reason || "")}" /></div>
          </details>
          <div class="field" style="margin-top:14px;"><label>Requested information or indicative terms</label><textarea name="notes">${escapeHtml(submission.requested_information?.join("\n") || submission.indicative_terms || "")}</textarea></div>
          <div class="actions" style="margin-top:14px;"><button class="button primary" type="submit">Submit response</button><a class="button" href="/login" data-link>Platform login</a></div>
        </form>
      </section>
    </main>
  `;
}

function renderTimeline(logs) {
  if (!logs.length) return `<div class="empty-state">No audit entries yet.</div>`;
  return logs.map((log) => `
    <div class="timeline-item">
      <div class="actions" style="justify-content:space-between;">
        <strong>${escapeHtml(log.action)}</strong>
        <span class="subtle">${escapeHtml(new Date(log.created_date).toLocaleString())}</span>
      </div>
      <p>${escapeHtml(log.detail)}</p>
      <span class="subtle">${escapeHtml(log.entity_type)} ${escapeHtml(log.entity_id || "")}</span>
    </div>
  `).join("");
}

function renderNotFound() {
  return `<section class="band"><div class="band-body empty-state">Page not found.</div></section>`;
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (link) {
    const href = link.getAttribute("href");
    if (href && href.startsWith("/")) {
      event.preventDefault();
      navigate(href);
      return;
    }
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "logout") {
    localStorage.removeItem(USER_KEY);
    navigate("/login");
    return;
  }
  if (action === "reset-demo") {
    resetState();
    notify("Seeded demo reset");
    navigate("/login");
    return;
  }
  if (["approve-ai", "edit-ai", "reject-ai", "ask-client-ai", "not-sure-ai"].includes(action)) {
    handleAiReviewAction(action, button.dataset.reviewId);
    return;
  }
  if (action === "run-lender-search") {
    handleRunLenderSearch(button.dataset.caseId);
    return;
  }
  if (action === "create-submission") {
    handleCreateSubmission(button.dataset.caseId, button.dataset.lenderId);
    return;
  }
  if (action === "send-submission") {
    handleSendSubmission(button.dataset.submissionId);
    return;
  }
  if (action === "download-credit-paper") {
    handleCreditPaperDownload(button.dataset.caseId, button.dataset.format);
    return;
  }
  if (action === "generate-pros-cons") {
    handleGenerateProsCons(button.dataset.quoteId);
    return;
  }
  if (action === "draft-quote-email") {
    handleDraftQuoteEmail(button.dataset.caseId);
    return;
  }
  if (action === "mark-doc") {
    handleMarkDoc(button.dataset.checkId, button.dataset.status);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  const formName = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());

  const handlers = {
    login: () => handleLogin(data),
    "new-case": () => handleNewCase(data),
    "ai-brain-dump": () => handleAiBrainDump(form.dataset.caseId, data),
    "add-party": () => handleAddParty(form.dataset.caseId, data),
    "add-person": () => handleAddPerson(form.dataset.caseId, data),
    "save-security": () => handleSaveSecurity(form.dataset.caseId, form.dataset.securityId, data),
    "save-compliance": () => handleSaveCompliance(form.dataset.caseId, form.dataset.assessmentId, form.dataset.securityId, data),
    "save-bridging": () => handleSaveBridging(form.dataset.caseId, form.dataset.loanId, data),
    "save-development": () => handleSaveDevelopment(form.dataset.caseId, form.dataset.projectId, data),
    "document-upload": () => handleDocumentUpload(form.dataset.caseId, data),
    "client-request": () => handleClientRequest(form.dataset.caseId, data),
    "add-quote": () => handleAddQuote(form.dataset.caseId, data),
    "save-commission": () => handleSaveCommission(form.dataset.caseId, form.dataset.ledgerId, data),
    "white-label-application": () => handleWhiteLabelApplication(form.dataset.settingsId, data),
    "lender-response": () => handleLenderResponse(form.dataset.submissionId, data)
  };

  handlers[formName]?.();
});

window.addEventListener("popstate", render);

function handleLogin(data) {
  setCurrentUser(data.user_id);
  notify("Logged in");
  navigate("/dashboard");
}

function handleNewCase(data) {
  const product = state.products.find((item) => item.id === data.product_id);
  const productName = product?.product_name || data.custom_product || data.product_id || "Other";
  const borrowerName = data.client_name || "Borrower TBC";
  const securityAddress = data.security_address || "Security TBC";
  const caseId = createId("case");
  const partyId = createId("party");
  const securityId = createId("security");
  const caseReference = `LT-${String(state.cases.length + 1).padStart(4, "0")}`;

  state.cases.unshift({
    id: caseId,
    case_reference: caseReference,
    source_brand: data.source_brand,
    source_app: "Broker dashboard",
    source_lender_id: "",
    source_application_link: "",
    brokerage_id: data.brokerage_id,
    broker_id: data.broker_id,
    client_id: partyId,
    product_id: product?.id || data.product_id,
    case_type: productName,
    status: data.status,
    loan_amount_requested: parseNumber(data.loan_amount_requested),
    security_address_headline: securityAddress,
    submission_readiness_score: 18,
    regulated_status: data.regulated_status,
    commercial_agreement_status: "Draft",
    created_date: todayIso(),
    updated_date: todayIso(),
    summary: data.summary,
    missing_information: ["Source evidence", "Consent to share with lenders", "Documents"],
    lenders_already_approached: []
  });
  state.applicationParties.push({
    id: partyId,
    case_id: caseId,
    applicant_type: data.borrower_type || "Limited Company",
    name: borrowerName,
    company_number: "",
    role: "Borrower",
    email: data.client_email,
    phone: data.client_phone,
    notes: ""
  });
  state.propertySecurities.push({
    id: securityId,
    case_id: caseId,
    security_address: securityAddress,
    title_number: "",
    owner: borrowerName,
    tenure: "TBC",
    security_type: data.security_type || "TBC",
    current_use: "",
    proposed_use: "",
    current_value: 0,
    purchase_price: 0,
    value_90_day: 0,
    value_180_day: 0,
    gdv: 0,
    existing_first_charge: false,
    existing_second_charge: false,
    proposed_charge_type: "First charge",
    existing_lender: "",
    existing_balance: 0,
    consent_required: false,
    consent_obtained: false,
    valuation_status: "Required",
    notes: ""
  });
  addAudit(caseId, "Case creation", "Case", caseId, `Case ${caseReference} created from broker dashboard.`);
  notify("Case created");
  saveState();
  navigate(`/cases/${caseId}/ai`);
}

function handleAiBrainDump(caseId, data) {
  const text = data.brain_dump || "";
  if (!text.trim()) return;
  const analysis = analyseBrainDump(text);
  const caseRecord = getCase(caseId);
  const sourceId = createId("source");

  state.brainDumpSourceRecords.unshift({
    id: sourceId,
    case_id: caseId,
    client_id: caseRecord.client_id,
    broker_id: caseRecord.broker_id,
    brokerage_id: caseRecord.brokerage_id,
    input_type: "Brain dump",
    original_content: text,
    attachments: [],
    source_file_email_reference: "",
    ai_analysis_status: "Broker review required",
    extracted_fields: analysis.suggestions.map((item) => item.field_key),
    broker_approved_fields: [],
    rejected_fields: [],
    tasks_created: [],
    emails_drafted: ["Client missing information draft", "Lender summary draft"],
    emails_sent: [],
    analysis_summary: analysis,
    created_date: todayIso()
  });

  analysis.suggestions.forEach((suggestion) => {
    state.aiExtractionReviews.unshift({
      id: createId("review"),
      case_id: caseId,
      source_record_id: sourceId,
      ...suggestion,
      broker_value: suggestion.suggested_value,
      created_date: todayIso()
    });
  });

  caseRecord.status = "AI extracted draft";
  caseRecord.missing_information = Array.from(new Set([...(caseRecord.missing_information || []), ...analysis.missing_information]));
  addAudit(caseId, "AI analysis run", "BrainDumpSourceRecord", sourceId, "BankManager.ai placeholder analysis created extraction review rows.");
  notify("AI analysis ready for review");
  saveState();
  render();
}

function handleAiReviewAction(action, reviewId) {
  const review = state.aiExtractionReviews.find((item) => item.id === reviewId);
  if (!review) return;
  const input = document.querySelector(`[data-review-value="${CSS.escape(reviewId)}"]`);
  const brokerValue = input ? input.value : review.broker_value;
  review.broker_value = brokerValue;

  if (action === "reject-ai") {
    review.status = "Rejected";
    updateSourceReview(review, "rejected");
    addAudit(review.case_id, "AI field rejected", "AIExtractionReview", review.id, `${review.field_name} rejected.`);
    notify("Extraction rejected");
  } else if (action === "ask-client-ai") {
    review.status = "Ask client";
    state.clientTasks.unshift({
      id: createId("client-task"),
      case_id: review.case_id,
      request_type: "Missing information request",
      status: "Drafted",
      message_body: `Please confirm: ${review.field_name}. Suggested value: ${brokerValue || "TBC"}`,
      created_date: todayIso()
    });
    addAudit(review.case_id, "Client request drafted", "ClientTask", review.id, `${review.field_name} marked to ask client.`);
    notify("Client request drafted");
  } else if (action === "not-sure-ai") {
    review.status = "Not sure";
    addAudit(review.case_id, "AI field marked not sure", "AIExtractionReview", review.id, `${review.field_name} marked not sure.`);
    notify("Suggestion marked not sure");
  } else {
    review.status = action === "edit-ai" ? "Edited and applied" : "Applied";
    applyExtraction(review, brokerValue);
    updateSourceReview(review, "approved");
    addAudit(review.case_id, action === "edit-ai" ? "AI field edited" : "AI field accepted", "AIExtractionReview", review.id, `${review.field_name} applied to ${review.entity_type}.`);
    notify("Extraction applied");
  }
  saveState();
  render();
}

function updateSourceReview(review, outcome) {
  const source = state.brainDumpSourceRecords.find((item) => item.id === review.source_record_id);
  if (!source) return;
  const target = outcome === "approved" ? "broker_approved_fields" : "rejected_fields";
  source[target] = Array.from(new Set([...(source[target] || []), review.field_key]));
}

function applyExtraction(review, value) {
  const caseRecord = getCase(review.case_id);
  if (!caseRecord) return;
  if (review.entity_type === "Case") {
    const parsed = review.field_key === "loan_amount_requested" ? parseNumber(value) : value;
    caseRecord[review.field_key] = parsed;
    if (review.field_key === "case_type") {
      const product = state.products.find((item) => item.product_name === value);
      if (product) caseRecord.product_id = product.id;
    }
    caseRecord.status = "Broker review required";
    caseRecord.updated_date = todayIso();
  }
  if (review.entity_type === "ApplicationParty") {
    const party = state.applicationParties.find((item) => item.id === caseRecord.client_id) || caseParties(caseRecord.id)[0];
    if (party) party[review.field_key] = value;
  }
  if (review.entity_type === "PropertySecurity") {
    let security = caseSecurities(caseRecord.id)[0];
    if (!security) {
      security = { id: createId("security"), case_id: caseRecord.id, security_address: "", current_value: 0, gdv: 0, proposed_charge_type: "First charge" };
      state.propertySecurities.push(security);
    }
    security[review.field_key] = ["gdv", "current_value", "purchase_price"].includes(review.field_key) ? parseNumber(value) : value;
    if (review.field_key === "security_address") caseRecord.security_address_headline = value;
  }
}

function handleAddParty(caseId, data) {
  const partyId = createId("party");
  state.applicationParties.push({
    id: partyId,
    case_id: caseId,
    applicant_type: data.applicant_type,
    name: data.name,
    company_number: "",
    role: data.applicant_type,
    email: data.email,
    phone: "",
    notes: ""
  });
  addAudit(caseId, "Case edits", "ApplicationParty", partyId, `${data.applicant_type} added.`);
  notify("Party added");
  saveState();
  render();
}

function handleAddPerson(caseId, data) {
  const personId = createId("person");
  state.people.push({
    id: personId,
    case_id: caseId,
    full_legal_name: data.full_legal_name,
    date_of_birth: "",
    email: data.email,
    phone: data.phone,
    current_address: "",
    date_moved_in: "",
    address_history_complete: false,
    connected_party_id: getCase(caseId)?.client_id,
    role: data.role,
    ownership_percentage: parseNumber(data.ownership_percentage),
    personal_guarantee_required: data.role === "Guarantor",
    kyc_aml_status: data.kyc_aml_status,
    notes: ""
  });
  addAudit(caseId, "Case edits", "Person", personId, `${data.role} added.`);
  notify("Person added");
  saveState();
  render();
}

function handleSaveSecurity(caseId, securityId, data) {
  let security = state.propertySecurities.find((item) => item.id === securityId);
  if (!security) {
    security = { id: createId("security"), case_id: caseId };
    state.propertySecurities.push(security);
  }
  Object.assign(security, {
    security_address: data.security_address,
    owner: data.owner,
    tenure: data.tenure,
    security_type: data.security_type,
    current_value: parseNumber(data.current_value),
    purchase_price: parseNumber(data.purchase_price),
    gdv: parseNumber(data.gdv),
    proposed_charge_type: data.proposed_charge_type,
    existing_lender: data.existing_lender,
    existing_balance: parseNumber(data.existing_balance),
    valuation_status: data.valuation_status,
    consent_obtained: data.consent_obtained === "true",
    notes: data.notes
  });
  updateCase(caseId, { security_address_headline: data.security_address });
  addAudit(caseId, "Case edits", "PropertySecurity", security.id, "Primary security updated.");
  notify("Security saved");
  saveState();
  render();
}

function handleSaveCompliance(caseId, assessmentId, securityId, data) {
  const input = {
    occupier_connection: data.occupier_connection,
    security_owner: data.security_owner,
    borrower: data.borrower,
    business_purpose: data.business_purpose === "true",
    third_party_charge: data.third_party_charge === "true",
    independent_legal_advice_required: data.independent_legal_advice_required === "true"
  };
  const classification = assessRegulation(input);
  let assessment = state.regulatedAssessments.find((item) => item.id === assessmentId);
  if (!assessment) {
    assessment = { id: createId("assessment"), case_id: caseId, security_id: securityId };
    state.regulatedAssessments.push(assessment);
  }
  Object.assign(assessment, input, {
    security_owner_different_from_borrower: input.security_owner !== input.borrower,
    occupier_consent_required: ["Yes", "Will live there"].includes(input.occupier_connection),
    classification_result: classification,
    broker_approved: true,
    notes: data.notes
  });
  updateCase(caseId, { regulated_status: classification });
  addAudit(caseId, "Regulated assessment", "RegulatedAssessment", assessment.id, `Classification set to ${classification}.`);
  notify("Compliance assessment saved");
  saveState();
  render();
}

function handleSaveBridging(caseId, loanId, data) {
  const calc = calculateBridging(data);
  let loan = state.bridgingLoans.find((item) => item.id === loanId);
  if (!loan) {
    loan = { id: createId("bridge"), case_id: caseId };
    state.bridgingLoans.push(loan);
  }
  Object.assign(loan, {
    loan_purpose: data.loan_purpose,
    loan_amount: parseNumber(data.loan_amount),
    net_loan: calc.net_loan,
    gross_loan: calc.gross_loan,
    property_value: parseNumber(data.property_value),
    ltv: calc.ltv,
    term: parseNumber(data.term),
    interest_rate: parseNumber(data.interest_rate),
    interest_type: data.interest_type,
    arrangement_fee: parseNumber(data.arrangement_fee),
    exit_fee: parseNumber(data.exit_fee),
    broker_fee: parseNumber(data.broker_fee),
    exit_strategy: data.exit_strategy,
    regulated_status: getCase(caseId)?.regulated_status,
    charge_type: caseSecurities(caseId)[0]?.proposed_charge_type,
    notes: ""
  });
  updateCase(caseId, { loan_amount_requested: loan.loan_amount });
  addAudit(caseId, "Case edits", "BridgingLoan", loan.id, "Bridging calculator saved.");
  notify("Bridge calculation saved");
  saveState();
  render();
}

function handleSaveDevelopment(caseId, projectId, data) {
  let project = state.developmentProjects.find((item) => item.id === projectId);
  if (!project) {
    project = { id: createId("development"), case_id: caseId, security_id: caseSecurities(caseId)[0]?.id || "" };
    state.developmentProjects.push(project);
  }
  Object.assign(project, {
    purchase_price: parseNumber(data.purchase_price),
    current_market_value: parseNumber(data.current_market_value),
    gdv: parseNumber(data.gdv),
    development_costs: parseNumber(data.development_costs),
    professional_fees: parseNumber(data.professional_fees),
    contingency: parseNumber(data.contingency),
    day_one_loan: parseNumber(data.day_one_loan),
    build_facility: parseNumber(data.build_facility),
    total_net_loan: parseNumber(data.total_net_loan),
    development_period: parseNumber(data.development_period),
    sale_refinance_period: parseNumber(data.sale_refinance_period),
    total_term: parseNumber(data.development_period) + parseNumber(data.sale_refinance_period),
    planning_status: data.planning_status,
    exit_strategy: data.exit_strategy,
    notes: ""
  });
  updateCase(caseId, { loan_amount_requested: project.total_net_loan, case_type: "Development Finance", product_id: "prod-development" });
  addAudit(caseId, "Case edits", "DevelopmentProject", project.id, "Development calculator saved.");
  notify("Development calculation saved");
  saveState();
  render();
}

function handleDocumentUpload(caseId, data) {
  const docId = createId("doc");
  state.documents.unshift({
    id: docId,
    case_id: caseId,
    uploaded_by: currentUser()?.id || "external",
    document_type: data.document_type,
    file: data.file,
    version: 1,
    status: "Received",
    visibility: "Broker and selected lender",
    source: "Placeholder upload metadata",
    ai_extraction_status: "Not run",
    uploaded_date: todayIso(),
    notes: data.notes
  });
  addAudit(caseId, "Document uploaded", "Document", docId, `${data.document_type} metadata added.`);
  notify("Document record added");
  saveState();
  render();
}

function handleMarkDoc(checkId, status) {
  const item = state.documentChecklistItems.find((check) => check.id === checkId);
  if (!item) return;
  item.status = status;
  addAudit(item.case_id, status === "Received" ? "Document uploaded" : "Case edits", "DocumentChecklistItem", item.id, `${item.document_type} marked ${status}.`);
  notify("Checklist updated");
  saveState();
  render();
}

function handleClientRequest(caseId, data) {
  const taskId = createId("client-task");
  const caseRecord = getCase(caseId);
  const party = state.applicationParties.find((item) => item.id === caseRecord.client_id);
  const email = sendPlaceholderEmail({
    to: party?.email || "client@example.com",
    subject: `${caseRecord.case_reference} information request`,
    body: data.message_body
  });
  state.clientTasks.unshift({
    id: taskId,
    case_id: caseId,
    request_type: data.request_type,
    status: "Sent via placeholder email",
    message_body: data.message_body,
    email_id: email.id,
    created_date: todayIso()
  });
  state.clientMessages.unshift({
    id: createId("client-message"),
    case_id: caseId,
    direction: "Outbound",
    subject: `${caseRecord.case_reference} information request`,
    body: data.message_body,
    status: email.status,
    created_date: todayIso()
  });
  addAudit(caseId, "Client request sent", "ClientTask", taskId, "Broker-approved client request logged through placeholder email service.");
  notify("Client request logged");
  saveState();
  render();
}

function handleRunLenderSearch(caseId) {
  const caseRecord = getCase(caseId);
  const security = caseSecurities(caseId)[0];
  const matches = matchLenders(caseRecord, security, state.lenderAppetites, state.lenderProfiles, caseRecord.lenders_already_approached || []);
  state.ui.latest_lender_matches[caseId] = matches;
  addAudit(caseId, "Lender search run", "Case", caseId, `${matches.length} lender appetite matches generated.`);
  notify("Lender search complete");
  saveState();
  render();
}

function handleCreateSubmission(caseId, lenderId) {
  const existing = state.caseLenderSubmissions.find((item) => item.case_id === caseId && item.lender_id === lenderId);
  if (existing) {
    notify("Submission already shortlisted");
    render();
    return;
  }
  const submissionId = createId("submission");
  state.caseLenderSubmissions.unshift({
    id: submissionId,
    case_id: caseId,
    lender_id: lenderId,
    submission_level: "Detailed enquiry",
    disclosure_level: "Client information included",
    status: "Draft",
    sent_date: "",
    viewed_date: "",
    decision: "",
    decline_reason: "",
    requested_information: [],
    indicative_terms: "",
    notes: "",
    response_token: createId("tok")
  });
  addAudit(caseId, "Lender submission sent", "CaseLenderSubmission", submissionId, "Lender added to shortlist as draft submission.");
  notify("Lender shortlisted");
  saveState();
  navigate(`/cases/${caseId}/lender-submissions`);
}

function handleSendSubmission(submissionId) {
  const submission = state.caseLenderSubmissions.find((item) => item.id === submissionId);
  if (!submission) return;
  const caseRecord = getCase(submission.case_id);
  const lender = state.lenderProfiles.find((item) => item.id === submission.lender_id);
  const security = caseSecurities(caseRecord.id)[0];
  const developmentProject = state.developmentProjects.find((item) => item.case_id === caseRecord.id);
  const emailBody = draftLenderSubmission(caseRecord, lender, security, developmentProject);
  const email = sendPlaceholderEmail({
    to: lender.submission_email,
    subject: `${caseRecord.case_reference} - ${caseRecord.case_type}`,
    body: emailBody
  });
  submission.status = "Sent";
  submission.sent_date = todayIso();
  submission.notes = `${submission.notes || ""}\n${email.status}: ${email.id}`.trim();
  updateCase(caseRecord.id, { status: "Submitted to lenders" });
  addAudit(caseRecord.id, "Lender submission sent", "CaseLenderSubmission", submission.id, `Placeholder email prepared for ${lender.lender_name}.`);
  notify("Submission sent");
  saveState();
  render();
}

function handleCreditPaperDownload(caseId, format) {
  const versionNumber = state.creditPaperVersions.filter((version) => version.case_id === caseId).length + 1;
  const id = createId("credit-paper");
  state.creditPaperVersions.unshift({
    id,
    case_id: caseId,
    submission_id: caseSubmissions(caseId)[0]?.id || "",
    version: versionNumber,
    generated_by: currentUser()?.id || "external",
    generated_date: todayIso(),
    format,
    status: "Generated",
    audit_log_id: ""
  });
  addAudit(caseId, "Credit paper downloaded", "CreditPaperVersion", id, `${format} placeholder generated and versioned.`);
  notify(`${format} version logged`);
  saveState();
  render();
}

function handleGenerateProsCons(quoteId) {
  const quote = state.lenderQuotes.find((item) => item.id === quoteId);
  if (!quote) return;
  const result = draftQuoteProsCons(quote, caseQuotes(quote.case_id));
  quote.pros = result.pros;
  quote.cons = result.cons;
  quote.quote_status = quote.quote_status === "Awaited" ? "Awaited" : "Broker review required";
  addAudit(quote.case_id, "Quote extracted by AI", "LenderQuote", quote.id, `Pros and cons generated for ${quote.lender_name}.`);
  notify("Pros and cons generated");
  saveState();
  render();
}

function handleDraftQuoteEmail(caseId) {
  const caseRecord = getCase(caseId);
  const quotes = caseQuotes(caseId);
  const received = quotes.filter((quote) => quote.quote_status !== "Awaited");
  const awaited = quotes.filter((quote) => quote.quote_status === "Awaited");
  const lines = received.map((quote) => {
    const totals = calculateQuoteTotals(quote);
    return `- ${quote.lender_name}: ${formatMoney(quote.loan_amount)}, rate ${formatPercent(quote.interest_rate)}, estimated 5 year cost ${formatMoney(totals.total_estimated_cost)}. Pros: ${(quote.pros || []).join("; ")}. Cons: ${(quote.cons || []).join("; ")}.`;
  }).join("\n");
  const avoided = (caseRecord.lenders_already_approached || []).filter((item) => item.avoid_contacting).map((item) => `- ${item.lender_name}: ${item.reason}`).join("\n");
  state.ui.latest_client_email_drafts[caseId] = `Subject: Finance quote comparison for ${caseRecord.case_reference}\n\nHi,\n\nWe have compared the lender responses currently available:\n\n${lines || "- Terms are still awaited."}\n\nAwaited:\n${awaited.map((quote) => `- ${quote.lender_name}`).join("\n") || "- None"}\n\nLenders already approached or avoided:\n${avoided || "- None noted"}\n\nThe main trade-off is between total cost, capital raise, flexibility, conditions and personal guarantee exposure. I suggest we book a call to decide which route you prefer.\n\nRegards,\nYour broker`;
  addAudit(caseId, "Quote comparison sent", "LenderQuote", caseId, "Client comparison email drafted for broker approval.");
  notify("Client quote email drafted");
  saveState();
  render();
}

function handleAddQuote(caseId, data) {
  const lender = state.lenderProfiles.find((item) => item.id === data.lender_id);
  const loanAmount = parseNumber(data.loan_amount);
  const cmv = parseNumber(data.cmv_property_value);
  const rate = parseNumber(data.interest_rate);
  const feePercent = parseNumber(data.arrangement_fee_percentage);
  const pgPercent = parseNumber(data.personal_guarantee_percentage);
  const quoteId = createId("quote");
  state.lenderQuotes.unshift({
    id: quoteId,
    case_id: caseId,
    lender_id: data.lender_id,
    quote_type: data.quote_type,
    quote_status: data.quote_status,
    lender_name: lender?.lender_name || "Manual lender",
    loan_amount: loanAmount,
    cmv_property_value: cmv,
    ltv_ltcmv: cmv ? (loanAmount / cmv) * 100 : 0,
    refinance_amount: 0,
    capital_raise: 0,
    arrangement_fee_percentage: feePercent,
    arrangement_fee_amount: loanAmount * (feePercent / 100),
    paid_to_uka_lendtech_broker: loanAmount * 0.01,
    interest_rate: rate,
    annual_interest_cost: loanAmount * (rate / 100),
    monthly_interest_cost: (loanAmount * (rate / 100)) / 12,
    term_duration: "TBC",
    repayment_type: "Interest only",
    personal_guarantee_percentage: pgPercent,
    personal_guarantee_amount: loanAmount * (pgPercent / 100),
    breakage_costs: "TBC",
    icr: "TBC",
    dscr: "TBC",
    conditions: "TBC",
    notes: data.notes,
    pros: [],
    cons: [],
    source: "Manual broker entry"
  });
  updateCase(caseId, { status: "Quote comparison" });
  addAudit(caseId, "Quote added", "LenderQuote", quoteId, `${lender?.lender_name || "Manual lender"} quote added.`);
  notify("Quote added");
  saveState();
  render();
}

function handleSaveCommission(caseId, ledgerId, data) {
  let ledger = state.commissionLedger.find((item) => item.id === ledgerId);
  if (!ledger) {
    ledger = { id: createId("commission"), case_id: caseId };
    state.commissionLedger.push(ledger);
  }
  Object.assign(ledger, {
    expected_broker_fee: parseNumber(data.expected_broker_fee),
    expected_lender_procuration_fee: parseNumber(data.expected_lender_procuration_fee),
    platform_override: parseNumber(data.platform_override),
    uka_lendtech_share: parseNumber(data.uka_lendtech_share),
    broker_share: parseNumber(data.broker_share),
    introducer_share: parseNumber(data.introducer_share),
    invoice_status: data.invoice_status,
    payment_status: data.payment_status,
    due_date: data.due_date,
    notes: data.notes
  });
  addAudit(caseId, "Commission record updated", "CommissionLedger", ledger.id, "Commission ledger updated.");
  notify("Commission saved");
  saveState();
  render();
}

function handleWhiteLabelApplication(settingsId, data) {
  const settings = state.whiteLabelApplicationSettings.find((item) => item.id === settingsId);
  const product = state.products.find((item) => item.product_name === data.product_name);
  const lender = state.lenderProfiles.find((item) => item.id === settings.lender_id);
  const borrowerName = data.client_name || "Applicant TBC";
  const securityAddress = data.security_address || "Security TBC";
  const notesSummary = [data.application_stage, data.brain_dump].filter(Boolean).join(" - ");
  const caseId = createId("case");
  const partyId = createId("party");
  const securityId = createId("security");
  const sourceId = createId("source");
  const submissionId = createId("submission");
  const caseReference = `UKLG-${String(state.cases.length + 1).padStart(4, "0")}`;

  state.cases.unshift({
    id: caseId,
    case_reference: caseReference,
    source_brand: lender.lender_name,
    source_app: "White-label application",
    source_lender_id: lender.id,
    source_application_link: `/apply/${settings.application_link_slug}`,
    brokerage_id: "brokerage-uka",
    broker_id: "broker-max",
    client_id: partyId,
    product_id: product?.id || "prod-bridging",
    case_type: data.product_name || "Bridging Finance",
    status: settings.default_application_status,
    loan_amount_requested: parseNumber(data.loan_amount_requested),
    security_address_headline: securityAddress,
    submission_readiness_score: 36,
    regulated_status: "Unknown / TBC",
    commercial_agreement_status: "Draft",
    created_date: todayIso(),
    updated_date: todayIso(),
    summary: notesSummary || "White-label application submitted for lender review.",
    missing_information: ["Broker review", "Compliance assessment", "Document checklist"],
    lenders_already_approached: []
  });
  state.applicationParties.push({
    id: partyId,
    case_id: caseId,
    applicant_type: data.applicant_route || "Borrower",
    name: borrowerName,
    company_number: "",
    role: "Borrower",
    email: data.client_email,
    phone: data.client_phone,
    notes: `Applicant route: ${data.applicant_route}. Broker/firm: ${data.broker_firm || "TBC"} ${data.broker_email || ""}`
  });
  state.propertySecurities.push({
    id: securityId,
    case_id: caseId,
    security_address: securityAddress,
    owner: borrowerName,
    tenure: "TBC",
    security_type: data.security_type || (data.product_name === "Development Finance" ? "Development Site" : "TBC"),
    current_value: parseNumber(data.current_value),
    purchase_price: 0,
    value_90_day: 0,
    value_180_day: 0,
    gdv: parseNumber(data.gdv),
    existing_first_charge: false,
    existing_second_charge: false,
    proposed_charge_type: "First charge",
    existing_lender: "",
    existing_balance: 0,
    consent_required: true,
    consent_obtained: data.consent_granted === "true",
    valuation_status: "Required",
    notes: ""
  });
  state.brainDumpSourceRecords.unshift({
    id: sourceId,
    case_id: caseId,
    client_id: partyId,
    broker_id: "broker-max",
    brokerage_id: "brokerage-uka",
    input_type: "White-label application",
    original_content: notesSummary || "White-label application submitted without notes.",
    attachments: [],
    source_file_email_reference: `/apply/${settings.application_link_slug}`,
    ai_analysis_status: "Queued for broker review",
    extracted_fields: ["product", "client", "loan", "security"],
    broker_approved_fields: [],
    rejected_fields: [],
    tasks_created: [],
    emails_drafted: [],
    emails_sent: [],
    created_date: todayIso()
  });
  state.consentRecords.unshift({
    id: createId("consent"),
    case_id: caseId,
    party_id: partyId,
    consent_type: "White-label lender application submission",
    granted: data.consent_granted === "true",
    granted_by: borrowerName,
    granted_date: dateOnly(todayIso()),
    expiry_date: "",
    source: `/apply/${settings.application_link_slug}`,
    notes: "Captured from white-label application journey."
  });
  state.caseLenderSubmissions.unshift({
    id: submissionId,
    case_id: caseId,
    lender_id: lender.id,
    submission_level: "Quick enquiry with client information",
    disclosure_level: "White-label applicant provided details",
    status: "Viewed",
    sent_date: todayIso(),
    viewed_date: todayIso(),
    decision: "",
    decline_reason: "",
    requested_information: [],
    indicative_terms: "",
    notes: "Auto-created from white-label application link.",
    response_token: createId("tok")
  });
  addAudit(caseId, "White-label application submitted", "Case", caseId, `${lender.lender_name} white-label application created a LendTech case.`);
  notify("White-label application created");
  saveState();
  history.pushState({}, "", `/apply/${settings.application_link_slug}?submitted=${caseId}`);
  render();
}

function handleLenderResponse(submissionId, data) {
  const submission = state.caseLenderSubmissions.find((item) => item.id === submissionId);
  if (!submission) return;
  const statusMap = {
    "Decline": "Declined",
    "Refer to credit": "Referred to credit",
    "Issue indicative terms": "Indicative terms received"
  };
  submission.status = statusMap[data.decision] || data.decision;
  submission.decision = data.decision;
  submission.decline_reason = data.decision === "Decline" ? data.reason : "";
  submission.requested_information = data.decision === "Request more information" ? data.notes.split("\n").filter(Boolean) : [];
  submission.indicative_terms = data.decision === "Issue indicative terms" ? data.notes : submission.indicative_terms;
  submission.notes = data.reason || submission.notes;
  state.lenderStructuredResponses.unshift({
    id: createId("response"),
    submission_id: submission.id,
    case_id: submission.case_id,
    lender_id: submission.lender_id,
    response_type: data.decision,
    decline_reason: submission.decline_reason,
    requested_information: submission.requested_information,
    indicative_terms: submission.indicative_terms,
    notes: data.notes,
    created_date: todayIso()
  });
  addAudit(submission.case_id, "Lender response received", "LenderStructuredResponse", submission.id, `Lender response: ${data.decision}.`);
  notify("Lender response captured");
  saveState();
  navigate(`/cases/${submission.case_id}/lender-submissions`);
}

saveState();
render();
