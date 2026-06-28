export function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(number);
}

export function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(number % 1 ? 1 : 0)}%`;
}

export function calculateBridging(input) {
  const loanAmount = Number(input.loan_amount || 0);
  const propertyValue = Number(input.property_value || 0);
  const term = Number(input.term || 0);
  const rate = Number(input.interest_rate || 0);
  const arrangementFeePercent = Number(input.arrangement_fee || 0);
  const exitFeePercent = Number(input.exit_fee || 0);
  const brokerFee = Number(input.broker_fee || 0);
  const retainedInterest = loanAmount * (rate / 100) * term;
  const arrangementFee = loanAmount * (arrangementFeePercent / 100);
  const exitFee = loanAmount * (exitFeePercent / 100);
  const grossLoan = loanAmount + retainedInterest + arrangementFee;
  const redemptionAmount = grossLoan + exitFee + brokerFee;

  return {
    ltv: propertyValue ? (loanAmount / propertyValue) * 100 : 0,
    net_loan: loanAmount,
    gross_loan: grossLoan,
    retained_interest: retainedInterest,
    arrangement_fee_amount: arrangementFee,
    exit_fee_amount: exitFee,
    redemption_amount: redemptionAmount
  };
}

export function calculateDevelopment(input) {
  const purchasePrice = Number(input.purchase_price || 0);
  const cmv = Number(input.current_market_value || purchasePrice || 0);
  const gdv = Number(input.gdv || 0);
  const developmentCosts = Number(input.development_costs || 0);
  const professionalFees = Number(input.professional_fees || 0);
  const contingency = Number(input.contingency || 0);
  const dayOneLoan = Number(input.day_one_loan || 0);
  const buildFacility = Number(input.build_facility || 0);
  const totalNetLoan = Number(input.total_net_loan || dayOneLoan + buildFacility || 0);
  const totalCost = purchasePrice + developmentCosts + professionalFees + contingency;
  const profit = gdv - totalCost;
  const borrowerEquityRequired = Math.max(totalCost - totalNetLoan, 0);

  return {
    day_one_lt_cmv: cmv ? (dayOneLoan / cmv) * 100 : 0,
    net_lt_gdv: gdv ? (totalNetLoan / gdv) * 100 : 0,
    loan_to_cost: totalCost ? (totalNetLoan / totalCost) * 100 : 0,
    peak_debt: totalNetLoan,
    profit,
    profit_on_cost: totalCost ? (profit / totalCost) * 100 : 0,
    profit_on_gdv: gdv ? (profit / gdv) * 100 : 0,
    borrower_equity_required: borrowerEquityRequired,
    contingency_percentage: developmentCosts ? (contingency / developmentCosts) * 100 : 0
  };
}

function extractMoney(text, words) {
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(?:${escaped})[^0-9]{0,40}(?:GBP|£)?\\s*([0-9][0-9,]*(?:\\.\\d+)?)\\s*(m|mn|million|k)?`, "i");
  const match = text.match(regex);
  if (!match) return 0;
  const base = Number(match[1].replace(/,/g, ""));
  const unit = (match[2] || "").toLowerCase();
  if (["m", "mn", "million"].includes(unit)) return base * 1000000;
  if (unit === "k") return base * 1000;
  return base;
}

function extractEmail(text) {
  return (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || "";
}

function extractPhone(text) {
  return (text.match(/(?:\+44|0)\s?[0-9][0-9\s-]{8,}/) || [])[0] || "";
}

export function analyseBrainDump(text) {
  const lower = text.toLowerCase();
  const isDevelopment = /development|gdv|planning|build|airspace|conversion|cost plan/.test(lower);
  const isBridge = /bridge|bridging|completion|auction|refurb/.test(lower);
  const isLenderTerms = /term sheet|terms|rate|arrangement fee|exit fee|ltv|personal guarantee|pg|annual cost|monthly cost/.test(lower);
  const isLenderReply = /decline|accepted|acceptable|approved|decision pending|refer to credit|request more information|more info|indicative terms/.test(lower);
  const hasDocumentLanguage = /pdf|docx|xlsx|csv|portfolio|schedule|appraisal|planning|bank statement|term sheet|valuation|email attachment|\.msg/.test(lower);
  const product = isDevelopment ? "Development Finance" : isBridge ? "Bridging Finance" : "Bridging Finance";
  const loanAmount = extractMoney(text, ["loan", "facility", "debt", "net loan", "funding", "raise"]);
  const gdv = extractMoney(text, ["gdv", "gross development value"]);
  const purchasePrice = extractMoney(text, ["purchase", "price", "cmv", "value"]);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const addressMatch = text.match(/(?:security|property|site|address)[:\s-]+([^.\n]+)/i);
  const companyMatch = text.match(/([A-Z][A-Za-z0-9&'() -]+(?:Limited|Ltd|LLP|SPV))/);
  const clientMatch = text.match(/(?:client|borrower|applicant)[:\s-]+([^,\n.]+)/i);
  const missing = [];

  if (!loanAmount) missing.push("Requested loan amount");
  if (isDevelopment && !gdv) missing.push("GDV");
  if (isDevelopment && !/cost/i.test(text)) missing.push("Development cost plan");
  if (!addressMatch) missing.push("Security address");
  if (!email) missing.push("Client email");
  if (/residential|home|family|occup/i.test(text)) missing.push("Regulated status confirmation");
  if (!/consent/i.test(text)) missing.push("Consent to share with lenders");

  const detectedContext = isLenderReply ? "lender_reply"
    : isLenderTerms ? "lender_terms"
      : missing.length ? "missing_information"
        : hasDocumentLanguage ? "documents"
          : "new_enquiry";

  const detectedDocuments = [
    /term sheet|terms/i.test(text) ? "Term sheet" : "",
    /portfolio|schedule/i.test(text) ? "Portfolio schedule" : "",
    /appraisal|cost plan/i.test(text) ? "Development appraisal" : "",
    /planning/i.test(text) ? "Planning documents" : "",
    /bank statement/i.test(text) ? "Bank statements" : "",
    /valuation/i.test(text) ? "Valuation" : "",
    /\.msg|lender email|client email/i.test(text) ? "Email file" : ""
  ].filter(Boolean);

  const suggestions = [
    {
      field_name: "Product",
      entity_type: "Case",
      entity_id: "",
      field_key: "case_type",
      suggested_value: product,
      source_excerpt: product === "Development Finance" ? "Development/GDV/planning language detected" : "Bridge/refurb/completion language detected",
      confidence: product === "Development Finance" || isBridge ? 0.82 : 0.52,
      status: "Pending broker review"
    },
    {
      field_name: "Loan amount requested",
      entity_type: "Case",
      entity_id: "",
      field_key: "loan_amount_requested",
      suggested_value: loanAmount || "",
      source_excerpt: "Detected from loan/facility wording",
      confidence: loanAmount ? 0.74 : 0.25,
      status: "Pending broker review"
    },
    {
      field_name: "Client company",
      entity_type: "ApplicationParty",
      entity_id: "",
      field_key: "name",
      suggested_value: companyMatch ? companyMatch[1].trim() : clientMatch ? clientMatch[1].trim() : "",
      source_excerpt: "Detected from company/client wording",
      confidence: companyMatch || clientMatch ? 0.7 : 0.25,
      status: "Pending broker review"
    },
    {
      field_name: "Client email",
      entity_type: "ApplicationParty",
      entity_id: "",
      field_key: "email",
      suggested_value: email,
      source_excerpt: "Email pattern in source",
      confidence: email ? 0.92 : 0.2,
      status: "Pending broker review"
    },
    {
      field_name: "Client phone",
      entity_type: "ApplicationParty",
      entity_id: "",
      field_key: "phone",
      suggested_value: phone,
      source_excerpt: "Phone pattern in source",
      confidence: phone ? 0.78 : 0.2,
      status: "Pending broker review"
    },
    {
      field_name: "Security address",
      entity_type: "PropertySecurity",
      entity_id: "",
      field_key: "security_address",
      suggested_value: addressMatch ? addressMatch[1].trim() : "",
      source_excerpt: "Detected after security/property/site wording",
      confidence: addressMatch ? 0.75 : 0.3,
      status: "Pending broker review"
    },
    {
      field_name: "GDV",
      entity_type: "PropertySecurity",
      entity_id: "",
      field_key: "gdv",
      suggested_value: gdv || "",
      source_excerpt: "Detected from GDV wording",
      confidence: gdv ? 0.82 : 0.18,
      status: "Pending broker review"
    },
    {
      field_name: "Current value / price",
      entity_type: "PropertySecurity",
      entity_id: "",
      field_key: "current_value",
      suggested_value: purchasePrice || "",
      source_excerpt: "Detected from price/value wording",
      confidence: purchasePrice ? 0.62 : 0.18,
      status: "Pending broker review"
    }
  ];

  return {
    likely_product: product,
    detected_context: detectedContext,
    detected_documents: detectedDocuments,
    missing_information: missing,
    suggested_questions: [
      "Can you confirm the full borrower structure and beneficial owners?",
      "Has the client, borrower or any connected party approached any lenders already?",
      "Can you confirm whether anyone connected to the borrower lives in the security property?",
      "Can you provide current valuation, debt and consent details for existing charges?"
    ],
    required_documents: product === "Development Finance"
      ? ["Planning documents", "Architect drawings", "Development appraisal", "Cost plan", "Title"]
      : ["ID/AML", "Proof of address", "Mortgage statement", "Valuation", "Title"],
    lender_route: product === "Development Finance"
      ? "Run development appetite search against UK Lender Group and specialist development lenders."
      : "Run bridge appetite search and block regulated submissions where lender permissions do not fit.",
    lender_summary: `${product} enquiry extracted from broker brain dump. Broker review is required before any external submission.`,
    client_email_draft: `Thanks for the details. To package this properly for lenders, please send the outstanding items listed below. We will review before anything is shared externally.`,
    suggestions
  };
}

export function assessRegulation(input) {
  if (input.occupier_connection === "Yes" || input.occupier_connection === "Will live there") {
    return "Likely regulated";
  }
  if (input.third_party_charge) {
    return "Third-party charge review required";
  }
  if (!input.business_purpose || input.occupier_connection === "Unknown / TBC") {
    return "Manual compliance review required";
  }
  return "Likely unregulated business purpose";
}

export function matchLenders(caseRecord, security, appetites, lenders, alreadyApproached = []) {
  return appetites
    .map((appetite) => {
      const lender = lenders.find((item) => item.id === appetite.lender_id);
      if (!lender || appetite.status !== "active") return null;
      const warnings = [];
      let score = 45;
      const requested = Number(caseRecord.loan_amount_requested || 0);
      const ltv = security?.current_value ? (requested / Number(security.current_value)) * 100 : 0;
      const ltgdv = security?.gdv ? (requested / Number(security.gdv)) * 100 : 0;
      const approached = alreadyApproached.find((item) => item.lender_name === lender.lender_name && item.avoid_contacting);

      if (appetite.product_type === caseRecord.case_type) score += 20;
      else warnings.push("Product type does not exactly match appetite.");

      if (requested && appetite.minimum_loan && requested < appetite.minimum_loan) warnings.push("Requested loan is below appetite minimum.");
      else score += 8;

      if (requested && appetite.maximum_loan && requested > appetite.maximum_loan) warnings.push("Requested loan exceeds appetite maximum.");
      else score += 8;

      if (ltv && appetite.max_ltv && ltv > appetite.max_ltv) warnings.push(`LTV ${formatPercent(ltv)} exceeds appetite max ${formatPercent(appetite.max_ltv)}.`);
      else score += 8;

      if (ltgdv && appetite.max_lt_gdv && ltgdv > appetite.max_lt_gdv) warnings.push(`LT-GDV ${formatPercent(ltgdv)} exceeds appetite max ${formatPercent(appetite.max_lt_gdv)}.`);
      else if (appetite.max_lt_gdv) score += 8;

      if (caseRecord.regulated_status === "Likely regulated" && !appetite.regulated_allowed) warnings.push("Regulated case blocked for this lender appetite.");
      else score += 7;

      if (approached) warnings.push(`Client already approached ${lender.lender_name}: ${approached.reason}`);

      return {
        lender_id: lender.id,
        lender_name: lender.lender_name,
        platform_status: lender.platform_status,
        product_type: appetite.product_type,
        match_score: Math.max(0, Math.min(100, score - warnings.length * 6)),
        appetite_status: appetite.status,
        indicative_rate_range: `${appetite.indicative_rate_minimum}% - ${appetite.indicative_rate_maximum}% ${appetite.rate_period}`,
        key_warnings: warnings,
        missing_information: warnings.length ? ["Broker review required before submission"] : [],
        appetite_id: appetite.id
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.match_score - a.match_score);
}

export function draftClientRequest(caseRecord, missingInformation) {
  const items = (missingInformation || []).map((item) => `- ${item}`).join("\n");
  return `Subject: Information needed for ${caseRecord.case_reference}\n\nHi,\n\nThanks for the details so far. To package the case properly, please send:\n\n${items || "- Any updated documents or missing details noted in the case"}\n\nWe will review everything before sharing externally.\n\nRegards,\nYour broker`;
}

export function draftLenderSubmission(caseRecord, lender, security, developmentProject) {
  return `Subject: ${caseRecord.case_reference} - ${caseRecord.case_type} enquiry\n\nDear ${lender.relationship_manager || "Credit Team"},\n\nPlease review the attached LendTech credit dashboard for ${caseRecord.case_type}.\n\nLoan request: ${formatMoney(caseRecord.loan_amount_requested)}\nSecurity: ${security?.security_address || caseRecord.security_address_headline || "TBC"}\nGDV: ${security?.gdv ? formatMoney(security.gdv) : "TBC"}\nDevelopment costs: ${developmentProject?.development_costs ? formatMoney(developmentProject.development_costs) : "TBC"}\nRegulated status: ${caseRecord.regulated_status}\n\nThis is a placeholder email service. Broker approval is required before sending externally.`;
}

export function draftQuoteProsCons(quote, allQuotes) {
  const receivedQuotes = allQuotes.filter((item) => Number(item.loan_amount) > 0);
  const cheapest = receivedQuotes.reduce((best, item) => !best || item.annual_interest_cost < best.annual_interest_cost ? item : best, null);
  const highestLoan = receivedQuotes.reduce((best, item) => !best || item.loan_amount > best.loan_amount ? item : best, null);
  const lowestPg = receivedQuotes.reduce((best, item) => !best || item.personal_guarantee_amount < best.personal_guarantee_amount ? item : best, null);
  const pros = [];
  const cons = [];

  if (cheapest?.id === quote.id) pros.push("Lowest annual interest cost in the current comparison.");
  if (highestLoan?.id === quote.id) pros.push("Highest loan amount and capital raise in the current comparison.");
  if (lowestPg?.id === quote.id) pros.push("Lowest personal guarantee exposure among received quotes.");
  if (!pros.length && quote.quote_status !== "Awaited") pros.push("Viable option subject to the listed conditions.");
  if (quote.quote_status === "Awaited") cons.push("Terms are still awaited, so no final comparison can be made.");
  if (quote.breakage_costs && /breakage|erc|early/i.test(quote.breakage_costs)) cons.push("Breakage or early repayment costs need client attention.");
  if (quote.personal_guarantee_amount > 0) cons.push(`Personal guarantee exposure is ${formatMoney(quote.personal_guarantee_amount)}.`);

  return { pros, cons };
}

export function calculateQuoteTotals(quote, years = 5) {
  const arrangementFee = Number(quote.arrangement_fee_amount || 0);
  const interest = Number(quote.annual_interest_cost || 0) * years;
  const otherFees = Number(quote.other_fees || 0);
  const total = arrangementFee + interest + otherFees;
  const costPerPound = quote.loan_amount ? total / quote.loan_amount : 0;
  const effectiveAnnualCost = quote.loan_amount ? (total / years / quote.loan_amount) * 100 : 0;

  return {
    total_estimated_cost: total,
    cost_per_pound_borrowed: costPerPound,
    effective_annual_cost: effectiveAnnualCost
  };
}

export function sendPlaceholderEmail({ to, subject, body }) {
  return {
    id: `email-${Date.now()}`,
    to,
    subject,
    body,
    status: "Drafted by placeholder email service",
    created_date: new Date().toISOString()
  };
}

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
