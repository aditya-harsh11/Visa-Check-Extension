(() => {
  // ── Known job board / ATS domains (extend as needed) ─────────────────
  const JOB_DOMAINS = [
    "greenhouse.io", "lever.co", "myworkdayjobs.com", "workday.com",
    "jobs.ashbyhq.com", "ashbyhq.com", "careers.google.com",
    "jobs.lever.co", "boards.greenhouse.io", "icims.com", "taleo.net",
    "smartrecruiters.com", "jobvite.com", "ultipro.com", "breezy.hr",
    "linkedin.com/jobs", "indeed.com", "ziprecruiter.com",
    "glassdoor.com", "angel.co", "wellfound.com", "simplyhired.com",
    "handshake", "joinhandshake.com", "figma.com/careers",
    "stripe.com/jobs", "meta.com/careers", "amazon.jobs",
    "apple.com/careers", "netflix.jobs", "careers", "jobs", "apply",
    "job-boards",
    // additional ATS platforms
    "recruitee.com", "jazzhr.com", "bamboohr.com", "personio.com",
    "personio.de", "workable.com", "successfactors.com", "oraclecloud.com",
    "paylocity.com", "paycomonline.com", "dover.com", "rippling.com",
    "gem.com", "polymer.co", "pinpointhq.com", "teamtailor.com",
    "recruiting.paylocity.com", "myworkday.com", "avature.net",
    "cornerstoneondemand.com", "phenompeople.com", "eightfold.ai",
  ];

  // ── Structural signals (work on ATS platforms not in the domain list) ─
  function hasJobPostingSchema() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const type = item && (item["@type"] || (item["@graph"] && item["@graph"][0] && item["@graph"][0]["@type"]));
          if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return true;
        }
      } catch (e) {
        // ignore malformed JSON-LD
      }
    }
    return false;
  }

  function hasAtsFingerprint() {
    if (document.querySelector('[data-greenhouse], [id*="greenhouse"], [class*="greenhouse"]')) return true;
    if (document.querySelector('[data-qa="apply-button"], [data-qa*="apply"]')) return true;
    const forms = document.querySelectorAll("form[action]");
    for (const f of forms) {
      const action = (f.getAttribute("action") || "").toLowerCase();
      if (/apply|greenhouse|lever|workday|icims|taleo|smartrecruiters/.test(action)) return true;
    }
    return false;
  }

  function isJobPage() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const title = document.title.toLowerCase();

    let score = 0;
    if (JOB_DOMAINS.some((d) => url.includes(d))) score += 2;
    if (/\/(jobs|careers|openings|positions|apply|job)\b/.test(path)) score += 2;
    if (/\b(job|career|position|opening|apply|hiring|intern)\b/.test(title)) score += 1;
    if (hasJobPostingSchema()) score += 3; // strong structural signal, enough on its own
    if (hasAtsFingerprint()) score += 2;

    return score >= 2;
  }

  if (!isJobPage()) return;

  // ── Boilerplate blocks to down-rank / ignore ──────────────────────────
  // Paragraphs matching these are generic EEO/legal disclosures, not the
  // actual eligibility clause for this specific role.
  const BOILERPLATE_RE =
    /(is an equal opportunity employer|equal employment opportunity|reasonable accommodation|pay transparency|background check(?:s)? (?:will|may) be (?:conducted|performed)|participates? in e-?verify|committed to (?:a diverse|building a diverse|diversity))/i;

  function splitParagraphs(text) {
    return text.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  }

  function getScanText() {
    const widget = document.getElementById("visa-check-ext");
    const hide = widget && (widget.style.display = "none");
    const region =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("article");
    let text = region && region.innerText && region.innerText.trim().length > 200
      ? region.innerText
      : document.body.innerText;
    if (widget) widget.style.display = "";
    return text;
  }

  // ── Negation words that flip the meaning of a nearby sponsor/visa hit ─
  const NEGATION_RE = /\b(not|no|never|unable|n't|without)\b/i;

  function isNegatedContext(text, matchIndex) {
    const start = Math.max(0, matchIndex - 40);
    const window_ = text.slice(start, matchIndex);
    return NEGATION_RE.test(window_);
  }

  // ── Keyword patterns, weighted: higher weight = stronger phrase-level
  // signal, lower weight = ambiguous single-keyword signal. ────────────
  const PATTERNS = [
    // RED signals (phrase-level, high confidence)
    { re: /\b(u\.?s\.?\s*citizen(s|ship)?)\b/gi, signal: "red", weight: 2, label: "U.S. citizenship mentioned" },
    { re: /\b(must\s+be\s+(a\s+)?u\.?s\.?\s*(citizen|national|person))/gi, signal: "red", weight: 3, label: "Must be U.S. citizen" },
    { re: /\b(permanent\s+resident)\b/gi, signal: "red", weight: 2, label: "Permanent resident mentioned" },
    { re: /\b(green\s*card)\b/gi, signal: "red", weight: 2, label: "Green card mentioned" },
    { re: /\b(security\s+clearance)\b/gi, signal: "red", weight: 2, label: "Security clearance required" },
    { re: /\b(not?\s+(able\s+to\s+)?sponsor|cannot\s+sponsor|unable\s+to\s+sponsor|does\s+not\s+sponsor|do\s+not\s+sponsor|will\s+not\s+sponsor|won'?t\s+sponsor|doesn'?t\s+sponsor)/gi, signal: "red", weight: 3, label: "Does not sponsor visas" },
    // catches phrasing with a verb between the negation and "sponsor", e.g.
    // "will not pursue visa sponsorship", "does not offer visa sponsorship"
    { re: /\b(will|does|do|cannot|can't|won't)\s+not\s+(?:\w+\s+){0,3}(?:visa\s+)?sponsor(ship)?/gi, signal: "red", weight: 3, label: "Will not pursue visa sponsorship" },
    { re: /\b(no\s+sponsorship\s+for\s+(?:employment\s+)?visa)/gi, signal: "red", weight: 3, label: "No sponsorship for employment visa" },
    { re: /\b(without\s+(the\s+)?need\s+for\s+.*?sponsor)/gi, signal: "red", weight: 3, label: "No sponsorship available" },
    { re: /\b(sponsorship\s+is\s+not\s+available)\b/gi, signal: "red", weight: 3, label: "Sponsorship not available" },
    { re: /\b(no\s+(visa\s+)?sponsorship\s+(is\s+)?(available|offered|provided)\s+for\s+this\s+(position|role))/gi, signal: "red", weight: 3, label: "No sponsorship for this role" },
    { re: /\b(not\s+eligible\s+for\s+.*?visa\s+sponsor)/gi, signal: "red", weight: 3, label: "Not eligible for visa sponsorship" },
    { re: /\b(authorized\s+to\s+work\s+in\s+the\s+(u\.?s\.?|united\s+states)\s+without\s+(any\s+)?(current\s+or\s+future\s+)?sponsor)/gi, signal: "red", weight: 3, label: "Must be authorized without sponsorship" },
    { re: /\b(legally\s+(authorized|eligible)\s+to\s+work.{0,40}without\s+(need\s+(for\s+)?)?(visa\s+)?sponsor)/gi, signal: "red", weight: 3, label: "Must be legally authorized without sponsorship" },
    { re: /\b(candidates?\s+must\s+have\s+current\s+work\s+authorization)/gi, signal: "red", weight: 2, label: "Must have current work authorization" },
    { re: /\b(authorized\s+to\s+work\s+without\s+restriction)/gi, signal: "red", weight: 2, label: "Must be authorized without restriction" },
    { re: /\b(itar)\b/gi, signal: "red", weight: 2, label: "ITAR restrictions" },

    // GREEN signals (phrase-level, high confidence)
    { re: /\b(we\s+(do\s+)?sponsor|will\s+sponsor|offer(s)?\s+(visa\s+)?sponsor|provides?\s+(visa\s+)?sponsor|sponsor(s|ship)?\s+(is\s+)?(available|offered|provided))/gi, signal: "green", weight: 3, label: "Offers visa sponsorship", negatable: true },
    { re: /\b(h-?1b\s+sponsor)/gi, signal: "green", weight: 3, label: "H-1B sponsorship mentioned", negatable: true },
    { re: /\b(open\s+to\s+.*?(international|all\s+candidates|global))/gi, signal: "green", weight: 2, label: "Open to international candidates" },
    { re: /\b(regardless\s+of\s+.*?(citizenship|nationality|immigration))/gi, signal: "green", weight: 3, label: "Open regardless of citizenship" },
    { re: /\b(visa\s+support)\b/gi, signal: "green", weight: 2, label: "Visa support mentioned" },
    { re: /\b(we\s+welcome\s+applicants\s+(requiring|who\s+require)\s+.*?sponsor)/gi, signal: "green", weight: 3, label: "Welcomes applicants needing sponsorship" },
    { re: /\b(f-?1\s*(\/|,|\s+and\s+)?\s*(opt|cpt)|opt\/cpt)\b.{0,30}(welcome|eligible|encouraged)/gi, signal: "green", weight: 2, label: "F-1/OPT/CPT candidates welcome" },
    { re: /\b(no\s+citizenship\s+required)/gi, signal: "green", weight: 3, label: "No citizenship required" },

    // YELLOW signals (ambiguous single-keyword, low confidence)
    { re: /\b(work\s+authorization)\b/gi, signal: "yellow", weight: 1, label: "Work authorization mentioned", negatable: true },
    { re: /\b(sponsor(ship|ed)?)\b/gi, signal: "yellow", weight: 1, label: "Sponsorship keyword found", negatable: true },
    { re: /\b(visa)\b/gi, signal: "yellow", weight: 1, label: "Visa keyword found", negatable: true },
    { re: /\b(eligible\s+to\s+work)\b/gi, signal: "yellow", weight: 1, label: "Work eligibility mentioned", negatable: true },
    { re: /\b(employment\s+eligibility\s+verification)\b/gi, signal: "yellow", weight: 1, label: "Employment eligibility verification", negatable: true },
    { re: /\b(e-?verify)\b/gi, signal: "yellow", weight: 1, label: "E-Verify mentioned", negatable: true },
  ];

  // ── Scan ─────────────────────────────────────────────────────────────
  function scan() {
    const fullText = getScanText();
    const paragraphs = splitParagraphs(fullText);
    // Text with boilerplate paragraphs removed, used for phrase-level matching
    const filteredText = paragraphs.filter((p) => !BOILERPLATE_RE.test(p)).join("\n");

    const hits = [];
    const seen = new Set();

    for (const p of PATTERNS) {
      // Phrase-level (weight >= 2) patterns run against filtered text so
      // boilerplate EEO/legal paragraphs don't trigger them. Single-keyword
      // yellow patterns (weight 1) still run against the full text but are
      // down-weighted, so they only tip the balance when nothing stronger exists.
      const searchText = p.weight >= 2 ? filteredText : fullText;
      const matches = searchText.match(p.re);
      if (!matches || seen.has(p.label)) continue;

      const idx = searchText.search(p.re);
      if (p.negatable && isNegatedContext(searchText, idx)) {
        // A preceding negation ("does not provide sponsorship", "not eligible
        // to work") flips or voids this pattern's naive positive meaning —
        // skip it since a more specific negated-phrase pattern should catch
        // the real (usually red) signal instead.
        continue;
      }

      seen.add(p.label);
      const start = Math.max(0, idx - 60);
      const end = Math.min(searchText.length, idx + matches[0].length + 60);
      let snippet = searchText.slice(start, end).replace(/\s+/g, " ").trim();
      if (start > 0) snippet = "…" + snippet;
      if (end < searchText.length) snippet += "…";
      hits.push({
        signal: p.signal,
        label: p.label,
        matchedText: matches[0],
        snippet,
        count: matches.length,
        weight: p.weight,
      });
    }
    return hits;
  }

  function classify(hits) {
    const hasRed = hits.some((h) => h.signal === "red");

    if (hasRed) {
      return { verdict: "no", color: "#E5484D", emoji: "🚫", title: "Does Not Sponsor", subtitle: "This posting explicitly requires citizenship/PR or says it won't sponsor a visa." };
    }
    if (hits.length === 0) {
      return { verdict: "yes", color: "#30A46C", emoji: "✅", title: "Can Apply", subtitle: "No citizenship or sponsorship restrictions were found on this page." };
    }
    return { verdict: "mixed", color: "#F5A623", emoji: "⚠️", title: "Mixed Signals", subtitle: "Found visa/sponsorship-related language — read carefully to understand the policy." };
  }

  // ── Widget state ────────────────────────────────────────────────────
  let panelOpen = false;

  function render(result, hits) {
    // Pause observer so our own DOM changes don't trigger a rescan
    observer.disconnect();

    let container = document.getElementById("visa-check-ext");
    if (!container) {
      container = document.createElement("div");
      container.id = "visa-check-ext";
      document.body.appendChild(container);
    }

    container.innerHTML = `
      <div class="vc-badge" style="--vc-accent: ${result.color}">
        <div class="vc-badge-bar" id="vc-toggle">
          <span class="vc-emoji">${result.emoji}</span>
          <span class="vc-title">${result.title}</span>
          <span class="vc-chevron" id="vc-chevron">▾</span>
        </div>
        <div class="vc-panel ${panelOpen ? "vc-open" : ""}" id="vc-panel">
          <p class="vc-subtitle">${result.subtitle}</p>
          ${hits.length > 0
            ? `<div class="vc-hits">
                ${hits.map((h) => `
                  <div class="vc-hit vc-hit--${h.signal}">
                    <span class="vc-dot"></span>
                    <div>
                      <strong>${h.label}</strong>
                      <span class="vc-snippet">"${h.snippet}"</span>
                    </div>
                  </div>`).join("")}
              </div>`
            : ""}
          <button class="vc-rescan" id="vc-rescan">↻ Re-scan page</button>
        </div>
      </div>
    `;

    // Restore chevron rotation if open
    if (panelOpen) {
      document.getElementById("vc-chevron").style.transform = "rotate(180deg)";
    }

    // Toggle panel on click
    document.getElementById("vc-toggle").addEventListener("click", () => {
      panelOpen = !panelOpen;
      document.getElementById("vc-panel").classList.toggle("vc-open", panelOpen);
      document.getElementById("vc-chevron").style.transform = panelOpen ? "rotate(180deg)" : "";
    });

    // Re-scan button
    document.getElementById("vc-rescan").addEventListener("click", (e) => {
      e.stopPropagation();
      run();
    });

    // Resume observer after a tick so our own changes settle
    setTimeout(() => {
      observer.observe(document.body, { childList: true, subtree: true });
    }, 100);
  }

  function run() {
    const hits = scan();
    const result = classify(hits);
    render(result, hits);
  }

  // ── MutationObserver for SPA navigation ─────────────────────────────
  let debounce;
  const observer = new MutationObserver((mutations) => {
    // Ignore mutations that only touch our widget
    const widget = document.getElementById("visa-check-ext");
    if (widget && mutations.every((m) => widget.contains(m.target))) return;

    clearTimeout(debounce);
    debounce = setTimeout(run, 2000);
  });

  // Initial run
  run();
})();
