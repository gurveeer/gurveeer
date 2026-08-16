const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const token = process.env.GHT;
const username = process.argv[2] || "gurveeer";

const GREEN = "#00FF41";
const GREEN_DARK = "#00c530";
const GREEN_DIM = "#0a5c22";
const BG = "#0d1117";
const CARD = "#12181f";
const CARD2 = "#161d26";
const BORDER = "#232a33";
const TEXT = "#c9d1d9";
const MUTED = "#8b949e";
const WHITE = "#f0f6fc";

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
}

const LANGUAGE_COLORS = {
    TypeScript: "#0b74e5",
    JavaScript: "#f1d60c",
    Python: "#0a3960",
    Go: "#0acafa",
    "C++": "#de0747",
    Java: "#b07219",
    Rust: "#dea584",
    HTML: "#ff3604",
    CSS: "#563d7c",
    Shell: "#89e051",
    Dockerfile: "#384d54",
    Jupyter: "#DA5B0B",
    Vue: "#41b883",
    PHP: "#4F5D95",
    Ruby: "#701516",
    MATLAB: "#0076a8",
};

function langColor(name) {
    if (LANGUAGE_COLORS[name]) return LANGUAGE_COLORS[name];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return `hsl(${h},70%,60%)`;
}

function defs() {
    return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="60%" stop-color="#0f141b"/>
      <stop offset="100%" stop-color="${CARD}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="6%" r="55%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
      <path d="M 22 0 L 0 0 0 22" fill="none" stroke="${GREEN}" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
  </defs>`;
}

// Sharp cut-corner frame path (90-degree angular notches)
function framePath(w, h, cut) {
    return `M ${cut} 0 H ${w - cut} L ${w} ${cut} V ${h - cut} L ${w - cut} ${h} H ${cut} L 0 ${h - cut} V ${cut} Z`;
}

function frame(w, h) {
    const cut = 12;
    return `
  <path d="${framePath(w, h, cut)}" fill="url(#bg)"/>
  <path d="${framePath(w, h, cut)}" fill="url(#glow)"/>
  <path d="${framePath(w, h, cut)}" fill="none" stroke="${BORDER}"/>
  <path d="${framePath(w, h, cut)}" fill="none" stroke="${GREEN}" stroke-opacity="0.35" stroke-width="1.4"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#grid)"/>`;
}

function matrixColumn(x, from, to, chars) {
    let out = "";
    for (let i = 0; i < 5; i++) {
        const y = from + i * 14;
        const ch = chars[(x * 7 + i * 3 + from) % chars.length];
        const o = 0.05 + i * 0.035;
        out += `    <text x="${x}" y="${y}" font-family="monospace" font-size="8" fill="${GREEN}" fill-opacity="${o}">${ch}</text>`;
    }
    return out;
}

function corners(w, h) {
    const s = 16;
    const l = 2;
    return `
  <path d="M 0 24 V 0 H 24" fill="none" stroke="${GREEN}" stroke-opacity="0.65" stroke-width="${l}"/>
  <path d="M ${w - 24} 0 H ${w} V 24" fill="none" stroke="${GREEN}" stroke-opacity="0.65" stroke-width="${l}"/>
  <path d="M ${w} ${h - 24} V ${h} H ${w - 24}" fill="none" stroke="${GREEN}" stroke-opacity="0.65" stroke-width="${l}"/>
  <path d="M 24 ${h} H 0 V ${h - 24}" fill="none" stroke="${GREEN}" stroke-opacity="0.65" stroke-width="${l}"/>`;
}

function liveDot(x, y) {
    return `
  <circle cx="${x}" cy="${y}" r="3" fill="${GREEN}">
    <animate attributeName="opacity" values="1;0.25;1" dur="2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${GREEN}" stroke-opacity="0.35">
    <animate attributeName="r" values="4;10" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite"/>
  </circle>`;
}

function header(w, title, tag) {
    return `
  <path d="M 16 20 H ${w - 16}" stroke="${BORDER}" stroke-width="1"/>
  <path d="M 24 20 H 150" stroke="${GREEN}" stroke-opacity="0.8" stroke-width="2"/>
  <text x="28" y="16" font-family="'Segoe UI', monospace" font-size="12" letter-spacing="2.5" font-weight="700" fill="${WHITE}">${title}</text>
  <text x="412" y="16" text-anchor="end" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="1.5" fill="${MUTED}">${tag}</text>
  ${liveDot(416, 14)}`;
}

function statsCard(data) {
    const w = 440;
    const h = 200;
    const metrics = [
        { label: "REPOSITORIES", value: formatNumber(data.repos), icon: "▤" },
        { label: "STARS EARNED", value: formatNumber(data.stars), icon: "★" },
        { label: "TOTAL FORKS", value: formatNumber(data.forks), icon: "⑂" },
        { label: "FOLLOWERS", value: formatNumber(data.followers), icon: "●" },
    ];

    const rows = metrics
        .map((m, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 20 + col * 210;
            const y = 40 + row * 72;
            return `
    <g>
      <path d="M ${x + 8} ${y} H ${x + 188} L ${x + 196} ${y + 8} V ${y + 50} H ${x + 8} Z" fill="${CARD2}" stroke="${BORDER}" stroke-width="1"/>
      <rect x="${x}" y="${y + 8}" width="4" height="34" fill="url(#accent)"/>
      <text x="${x + 20}" y="${y + 30}" text-anchor="middle" font-family="monospace" font-size="12" fill="${GREEN}">${m.icon}</text>
      <text x="${x + 36}" y="${y + 20}" font-family="'Segoe UI', monospace" font-size="8.5" letter-spacing="1.4" fill="${MUTED}">${m.label}</text>
      <text x="${x + 36}" y="${y + 42}" font-family="'Segoe UI', monospace" font-size="18" font-weight="700" fill="${WHITE}">${m.value}</text>
      <path d="M ${x + 188} ${y} L ${x + 196} ${y + 8}" stroke="${GREEN}" stroke-opacity="0.4" stroke-width="1.2"/>
    </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(13, 44, 110, "01")}
  ${matrixColumn(427, 92, 160, "10")}
  ${header(w, "SYSTEM_STATS", "gurveeer")}
  ${rows}
</svg>
`;
}

function langsCard(data) {
    const w = 440;
    const h = 200;
    const maxPct = data.langs[0] ? data.langs[0].pct : 1;

    const rows = data.langs
        .map((l, i) => {
            const y = 42 + i * 27;
            const color = langColor(l.name);
            const bw = Math.max(10, Math.round((l.pct / maxPct) * 360));
            return `
    <g>
      <text x="28" y="${y}" font-family="'Segoe UI', monospace" font-size="11" fill="${TEXT}">
        <tspan fill="${color}">■</tspan>  ${escapeHtml(l.name)}
      </text>
      <text x="412" y="${y}" text-anchor="end" font-family="'Segoe UI', monospace" font-size="11" font-weight="700" fill="${WHITE}">${l.pct}%</text>
      <rect x="28" y="${y + 8}" width="384" height="5" fill="${BG}" stroke="${BORDER}" stroke-width="0.6"/>
      <rect x="28" y="${y + 8}" width="${bw}" height="5" fill="${color}"/>
      <rect x="${28 + bw}" y="${y + 8}" width="2" height="5" fill="${GREEN}" fill-opacity="0.6"/>
    </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(13, 44, 110, "10")}
  ${matrixColumn(427, 84, 150, "01")}
  ${header(w, "LANG_MATRIX", "by repo count")}
  ${rows}
</svg>
`;
}

function projectCard(repo) {
    const w = 440;
    const h = 200;
    const desc = (repo.description || "No description provided").replace(/\s+/g, " ").trim();
    const shortDesc = desc.length > 56 ? desc.slice(0, 53) + "…" : desc;
    const lang = repo.language || "Unknown";
    const color = langColor(lang);
    const stars = repo.stargazers_count ? formatNumber(repo.stargazers_count) : "0";
    const forks = repo.forks_count ? formatNumber(repo.forks_count) : "0";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(13, 44, 110, "01")}
  ${matrixColumn(427, 92, 160, "10")}

  <rect x="20" y="20" width="8" height="8" fill="${GREEN}"/>
  <text x="36" y="29" font-family="'Segoe UI', monospace" font-size="15" font-weight="700" fill="${WHITE}">${escapeHtml(repo.name)}</text>
  <rect x="${36 + repo.name.length * 9 + 4}" y="24" width="6" height="6" fill="${GREEN}" fill-opacity="0.7"/>

  <text x="28" y="70" font-family="'Segoe UI', sans-serif" font-size="12" fill="${TEXT}">${escapeHtml(shortDesc)}</text>

  <line x1="28" y1="94" x2="412" y2="94" stroke="${BORDER}" stroke-width="1"/>
  <path d="M 28 94 H 120" stroke="${GREEN}" stroke-opacity="0.6" stroke-width="1.6"/>

  <text x="28" y="134" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}">
    <tspan fill="${color}">■</tspan>  ${escapeHtml(lang)}
  </text>

  <text x="412" y="130" text-anchor="end" font-family="'Segoe UI', monospace" font-size="12" font-weight="700" fill="${WHITE}">★ ${stars}</text>
  <text x="412" y="148" text-anchor="end" font-family="'Segoe UI', monospace" font-size="12" font-weight="700" fill="${WHITE}">⑂ ${forks}</text>

  <text x="28" y="${h - 18}" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="2" fill="${GREEN}" fill-opacity="0.7">[ ${escapeHtml(repo.name.toUpperCase())} ]</text>
</svg>
`;
}

async function fetchContributions(username) {
    const https = require("https");
    return new Promise((resolve, reject) => {
        https
            .get(
                `https://github-contributions-api.jogruber.de/v4/${username}?y=last`,
                { headers: { "User-Agent": "stats-gen" } },
                (r) => {
                    let d = "";
                    r.on("data", (c) => (d += c));
                    r.on("end", () => {
                        try {
                            resolve(JSON.parse(d));
                        } catch (e) {
                            reject(e);
                        }
                    });
                }
            )
            .on("error", reject);
    });
}

function computeStreaks(contributions) {
    let current = 0;
    let longest = 0;
    let run = 0;
    contributions.forEach((day) => {
        if (day.count > 0) {
            run++;
            longest = Math.max(longest, run);
        } else {
            run = 0;
        }
    });
    for (let i = contributions.length - 1; i >= 0; i--) {
        if (contributions[i].count > 0) current++;
        else break;
    }
    return { current, longest };
}

function streakCard(data) {
    const w = 440;
    const h = 200;
    const metrics = [
        { label: "CURRENT STREAK", value: `${data.current} ${data.current === 1 ? "DAY" : "DAYS"}`, icon: "▮" },
        { label: "LONGEST STREAK", value: `${data.longest} ${data.longest === 1 ? "DAY" : "DAYS"}`, icon: "◭" },
        { label: "TOTAL CONTRIB", value: formatNumber(data.total), icon: "◆" },
        { label: "ACTIVE DAYS", value: formatNumber(data.activeDays), icon: "▣" },
    ];

    const rows = metrics
        .map((m, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 20 + col * 210;
            const y = 40 + row * 72;
            return `
    <g>
      <path d="M ${x + 8} ${y} H ${x + 188} L ${x + 196} ${y + 8} V ${y + 50} H ${x + 8} Z" fill="${CARD2}" stroke="${BORDER}" stroke-width="1"/>
      <rect x="${x}" y="${y + 8}" width="4" height="34" fill="url(#accent)"/>
      <text x="${x + 20}" y="${y + 30}" text-anchor="middle" font-family="monospace" font-size="12" fill="${GREEN}">${m.icon}</text>
      <text x="${x + 36}" y="${y + 20}" font-family="'Segoe UI', monospace" font-size="8.5" letter-spacing="1.4" fill="${MUTED}">${m.label}</text>
      <text x="${x + 36}" y="${y + 42}" font-family="'Segoe UI', monospace" font-size="18" font-weight="700" fill="${WHITE}">${m.value}</text>
      <path d="M ${x + 188} ${y} L ${x + 196} ${y + 8}" stroke="${GREEN}" stroke-opacity="0.4" stroke-width="1.2"/>
    </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(13, 44, 110, "01")}
  ${matrixColumn(427, 92, 160, "10")}
  ${header(w, "STREAK_TRACK", "gurveeer")}
  ${rows}
</svg>
`;
}

function commitsCard(data) {
    const w = 440;
    const h = 200;
    const metrics = [
        { label: "TOTAL COMMITS", value: formatNumber(data.commits), icon: "✓" },
        { label: "PULL REQUESTS", value: formatNumber(data.prs), icon: "⇄" },
        { label: "ISSUES OPENED", value: formatNumber(data.issues), icon: "!" },
        { label: "YEARS ACTIVE", value: formatNumber(data.years), icon: "◷" },
    ];

    const rows = metrics
        .map((m, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 20 + col * 210;
            const y = 40 + row * 72;
            return `
    <g>
      <path d="M ${x + 8} ${y} H ${x + 188} L ${x + 196} ${y + 8} V ${y + 50} H ${x + 8} Z" fill="${CARD2}" stroke="${BORDER}" stroke-width="1"/>
      <rect x="${x}" y="${y + 8}" width="4" height="34" fill="url(#accent)"/>
      <text x="${x + 20}" y="${y + 30}" text-anchor="middle" font-family="monospace" font-size="12" fill="${GREEN}">${m.icon}</text>
      <text x="${x + 36}" y="${y + 20}" font-family="'Segoe UI', monospace" font-size="8.5" letter-spacing="1.4" fill="${MUTED}">${m.label}</text>
      <text x="${x + 36}" y="${y + 42}" font-family="'Segoe UI', monospace" font-size="18" font-weight="700" fill="${WHITE}">${m.value}</text>
      <path d="M ${x + 188} ${y} L ${x + 196} ${y + 8}" stroke="${GREEN}" stroke-opacity="0.4" stroke-width="1.2"/>
    </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(13, 44, 110, "10")}
  ${matrixColumn(427, 92, 160, "01")}
  ${header(w, "ACTIVITY_LOG", "gurveeer")}
  ${rows}
</svg>
`;
}

function contributionGraphCard(data) {
    const w = 1060;
    const h = 260;
    const days = data.days;
    const total = data.total;
    const maxCount = Math.max(...days.map((d) => d.count), 1);

    const cell = 14;
    const gap = 4;
    const weeks = [];
    let week = [];
    days.forEach((d) => {
        const date = new Date(d.date + "T00:00:00Z");
        const dow = date.getUTCDay();
        while (week.length < dow) week.push({ count: 0, level: 0 });
        week.push(d);
        if (dow === 6) {
            weeks.push(week);
            week = [];
        }
    });
    if (week.length) {
        while (week.length < 7) week.push({ count: 0, level: 0 });
        weeks.push(week);
    }

    const gridW = weeks.length * (cell + gap) - gap;
    const startX = Math.round((w - gridW) / 2);
    const startY = 72;

    let cells = "";
    weeks.forEach((w, wi) => {
        w.forEach((d, di) => {
            const x = startX + wi * (cell + gap);
            const y = startY + di * (cell + gap);
            let fill = BG;
            let stroke = BORDER;
            if (d.count > 0) {
                const ratio = d.count / maxCount;
                const alpha = 0.15 + ratio * 0.85;
                fill = `rgba(0,255,65,${alpha})`;
                stroke = "none";
            }
            cells += `      <rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>`;
        });
    });

    const monthLabels = ["", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", ""];
    let labels = "";
    const labelStep = Math.max(1, Math.round(weeks.length / 12));
    for (let wi = 0; wi < weeks.length; wi += labelStep) {
        const x = startX + wi * (cell + gap);
        const label = monthLabels[Math.floor(wi / (weeks.length / 12))] || "";
        labels += `      <text x="${x}" y="58" font-family="'Segoe UI', monospace" font-size="8" letter-spacing="1" fill="${MUTED}">${label}</text>`;
    }

    const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    let dayLabels = "";
    [1, 3, 5].forEach((di) => {
        const y = startY + di * (cell + gap) + 8;
        dayLabels += `      <text x="${startX - 12}" y="${y}" text-anchor="end" font-family="'Segoe UI', monospace" font-size="8" fill="${MUTED}">${weekdays[di]}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(13, 44, 100, "01")}
  ${matrixColumn(w - 13, 90, 150, "10")}
  ${header(w, "CONTRIB_HEATMAP", "last 365 days")}

  ${labels}
  ${dayLabels}
  ${cells}

  <rect x="${startX + gridW - 214}" y="${h - 24}" width="11" height="11" fill="${BG}" stroke="${BORDER}" stroke-width="0.5"/>
  <text x="${startX + gridW - 196}" y="${h - 15}" font-family="'Segoe UI', monospace" font-size="8" fill="${MUTED}">0</text>
  <rect x="${startX + gridW - 172}" y="${h - 24}" width="11" height="11" fill="rgba(0,255,65,0.15)" stroke="none"/>
  <text x="${startX + gridW - 154}" y="${h - 15}" font-family="'Segoe UI', monospace" font-size="8" fill="${MUTED}">1-4</text>
  <rect x="${startX + gridW - 130}" y="${h - 24}" width="11" height="11" fill="rgba(0,255,65,0.45)"/>
  <text x="${startX + gridW - 112}" y="${h - 15}" font-family="'Segoe UI', monospace" font-size="8" fill="${MUTED}">5-9</text>
  <rect x="${startX + gridW - 88}" y="${h - 24}" width="11" height="11" fill="rgba(0,255,65,0.75)"/>
  <text x="${startX + gridW - 70}" y="${h - 15}" font-family="'Segoe UI', monospace" font-size="8" fill="${MUTED}">10+</text>

  <text x="${startX}" y="${h - 15}" font-family="'Segoe UI', monospace" font-size="11" font-weight="700" fill="${WHITE}">${formatNumber(total)}</text>
  <text x="${startX + 56}" y="${h - 15}" font-family="'Segoe UI', monospace" font-size="8" letter-spacing="1" fill="${MUTED}">TOTAL CONTRIBUTIONS</text>
</svg>
`;
}

const BRAND_LOGOS = {
    LinkedIn:
        '<path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>',
    Gmail:
        '<path fill="#D14836" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>',
    X: '<path fill="#e6edf3" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>',
    Portfolio:
        '<path fill="#00FF41" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm7.753 7.5c.161.803.247 1.633.247 2.5 0 3.313-1.344 6.31-3.514 8.48-.18.18-.36.348-.543.512a9.96 9.96 0 0 1-3.943 1.93V15h1.5a1 1 0 0 0 0-2h-4a1 1 0 0 0 0 2h.5v3.04a9.96 9.96 0 0 1-4.28-2.245c-.233-.211-.458-.434-.675-.666A9.975 9.975 0 0 1 2 10c0-.5.037-.99.107-1.47A9.98 9.98 0 0 0 12 14c5.425 0 9.868-4.326 9.99-9.743a10.04 10.04 0 0 1-2.237 3.243zM12 2c.348 0 .693.022 1.033.064A9.998 9.998 0 0 0 12 9c0 1.497.327 2.918.918 4.194A10.04 10.04 0 0 1 8.5 16.58 10.036 10.036 0 0 1 2 10c0-1.168.2-2.29.565-3.337C4.562 8.594 8.007 9.88 12 9.88c4.046 0 7.534-1.328 9.531-3.29A10.042 10.042 0 0 0 12 2z"/>',
};

function connectCard(platform, handle, url, color, icon, note) {
    const w = 170;
    const h = 54;
    const logo = BRAND_LOGOS[platform] || "";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  <defs>
    <linearGradient id="cb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${CARD}"/>
    </linearGradient>
    <radialGradient id="cg" cx="85%" cy="6%" r="55%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <path d="M 8 0 H 162 L 170 8 V 46 L 162 54 H 8 L 0 46 V 8 Z" fill="url(#cb)"/>
  <path d="M 8 0 H 162 L 170 8 V 46 L 162 54 H 8 L 0 46 V 8 Z" fill="url(#cg)"/>
  <path d="M 8 0 H 162 L 170 8 V 46 L 162 54 H 8 L 0 46 V 8 Z" fill="none" stroke="${BORDER}"/>
  <path d="M 8 0 H 162 L 170 8 V 46 L 162 54 H 8 L 0 46 V 8 Z" fill="none" stroke="${GREEN}" stroke-opacity="0.35" stroke-width="1.2"/>

  <g transform="translate(13 13) scale(0.78)">${logo}</g>

  <text x="46" y="23" font-family="'Segoe UI', monospace" font-size="12" font-weight="700" fill="${WHITE}">${platform}</text>
  <text x="46" y="38" font-family="'Segoe UI', monospace" font-size="8.5" fill="${MUTED}">${handle}</text>

  <path d="M 158 14 H 166" stroke="${GREEN}" stroke-opacity="0.5" stroke-width="1.4"/>
  <path d="M 164 8 V 46" stroke="${GREEN}" stroke-opacity="0.5" stroke-width="1.4"/>
</svg>
`;
}

function footerCard() {
    const w = 920;
    const h = 90;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}

  <text x="28" y="52" font-family="'Segoe UI', monospace" font-size="13" letter-spacing="3" font-weight="700" fill="${GREEN}">[ SYSTEM ONLINE ]</text>

  <text x="420" y="52" text-anchor="middle" font-family="'Segoe UI', monospace" font-size="11" fill="${MUTED}">crafted by</text>
  <text x="460" y="52" font-family="'Segoe UI', monospace" font-size="13" font-weight="700" fill="${WHITE}">GURVEER</text>

  <text x="892" y="52" text-anchor="end" font-family="'Segoe UI', monospace" font-size="10" fill="${MUTED}">access granted ✓</text>

  ${liveDot(892, 56)}
</svg>
`;
}

function snakeCard(data) {
    const w = 1060;
    const h = 260;
    const days = data.days || [];
    const cell = 14;
    const gap = 4;
    const startY = 72;

    const weeks = [];
    let week = [];
    days.forEach((d) => {
        const date = new Date(d.date + "T00:00:00Z");
        const dow = date.getUTCDay();
        while (week.length < dow) week.push({ count: 0, level: 0 });
        week.push(d);
        if (dow === 6) {
            weeks.push(week);
            week = [];
        }
    });
    if (week.length) {
        while (week.length < 7) week.push({ count: 0, level: 0 });
        weeks.push(week);
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    const gridW = weeks.length * (cell + gap) - gap;
    const startX = Math.round((w - gridW) / 2);

    let cells = "";
    weeks.forEach((ww, wi) => {
        ww.forEach((d, di) => {
            const x = startX + wi * (cell + gap);
            const y = startY + di * (cell + gap);
            let fill = BG;
            let stroke = BORDER;
            if (d.count > 0) {
                const alpha = 0.15 + (d.count / maxCount) * 0.85;
                fill = `rgba(0,255,65,${alpha})`;
                stroke = "none";
                cells += `      <rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}">
        <animate attributeName="opacity" values="0.55;1;0.55" dur="2.4s" begin="${(wi * 3) % 12}s" repeatCount="indefinite"/>
      </rect>`;
            } else {
                cells += `      <rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>`;
            }
        });
    });

    let pathD = "";
    let first = true;
    weeks.forEach((ww, wi) => {
        const order = wi % 2 === 0 ? [0, 1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1, 0];
        order.forEach((di) => {
            const cx = startX + wi * (cell + gap) + cell / 2;
            const cy = startY + di * (cell + gap) + cell / 2;
            pathD += (first ? "M" : "L") + ` ${cx.toFixed(1)} ${cy.toFixed(1)} `;
            first = false;
        });
        if (wi < weeks.length - 1) {
            const nextCx = startX + (wi + 1) * (cell + gap) + cell / 2;
            const lastDi = wi % 2 === 0 ? 6 : 0;
            const cy = startY + lastDi * (cell + gap) + cell / 2;
            pathD += `L ${nextCx.toFixed(1)} ${cy.toFixed(1)} `;
        }
    });

    let trail = "";
    for (let i = 1; i <= 6; i++) {
        const r = 4.2 - i * 0.5;
        const o = 0.55 - i * 0.07;
        trail += `    <circle r="${r.toFixed(1)}" fill="${GREEN}" fill-opacity="${o.toFixed(2)}">
      <animateMotion dur="26s" repeatCount="indefinite" begin="-${i * 0.35}s" path="${pathD}"/>
    </circle>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(13, 44, 100, "01")}
  ${matrixColumn(w - 13, 90, 150, "10")}
  ${header(w, "CONTRIB_SNAKE", "auto feeder")}

  ${cells}

  <g filter="url(#blur)">${trail}</g>
  <circle r="4.6" fill="${GREEN}" fill-opacity="0.9" filter="url(#blur)">
    <animateMotion dur="26s" repeatCount="indefinite" path="${pathD}"/>
  </circle>
  <circle r="2.4" fill="#d8ffde">
    <animateMotion dur="26s" repeatCount="indefinite" path="${pathD}"/>
  </circle>

  <text x="${startX}" y="${h - 18}" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="2" fill="${GREEN}" fill-opacity="0.7">[ FEED THE SERPENT ]</text>
</svg>
`;
}

function heroCard() {
    const w = 1060;
    const h = 260;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${corners(w, h)}
  ${matrixColumn(24, 80, 180, "01")}
  ${matrixColumn(w - 24, 80, 180, "10")}
  ${liveDot(w - 60, 40)}

  <text x="40" y="40" font-family="'Segoe UI', monospace" font-size="10" letter-spacing="3" fill="${GREEN}" fill-opacity="0.8">[ SYSTEM BOOT ]</text>
  <text x="${w - 200}" y="40" text-anchor="end" font-family="'Segoe UI', monospace" font-size="10" letter-spacing="2" fill="${MUTED}">gurveeer@github</text>

  <text x="40" y="120" font-family="'Segoe UI', monospace" font-size="42" font-weight="700" fill="${WHITE}">Hi, I'm <tspan fill="${GREEN}">Gurveer</tspan></text>

  <text x="40" y="162" font-family="'Segoe UI', monospace" font-size="18" fill="${TEXT}">AI Infrastructure Engineer</text>

  <path d="M 40 178 H 1020" stroke="${BORDER}" stroke-width="1"/>
  <path d="M 40 178 H 260" stroke="${GREEN}" stroke-opacity="0.8" stroke-width="2"/>

  <text x="40" y="210" font-family="'Segoe UI', monospace" font-size="13" fill="${MUTED}">Building context engines &amp; RAG systems · vector &amp; graph databases · event-driven AI pipelines</text>

  <text x="40" y="${h - 24}" font-family="'Segoe UI', monospace" font-size="10" letter-spacing="3" fill="${GREEN}" fill-opacity="0.7">[ IIT ROORKEE '23 ]</text>
</svg>
`;
}

function aboutCard() {
    const w = 1060;
    const h = 520;
    const A = "#f0f6fc";
    const AMUTED = "#aab3c0";

    const spec = [
        "Context Engines & RAG Systems",
        "Vector Databases (Qdrant, Pinecone)",
        "Graph Databases (Neo4j, ArangoDB)",
        "Event Streaming (Kafka, RabbitMQ)",
        "Search Engines (OpenSearch, Elasticsearch)",
        "AI Agent Orchestration",
    ];
    const stack = [
        { k: "vectorDB", v: "Qdrant, Pinecone, Weaviate" },
        { k: "graphDB", v: "Neo4j, ArangoDB" },
        { k: "search", v: "OpenSearch, Elasticsearch" },
        { k: "streaming", v: "Kafka, RabbitMQ" },
        { k: "databases", v: "PostgreSQL, MongoDB, Redis" },
        { k: "ai", v: "LangChain, LlamaIndex, CrewAI" },
        { k: "backend", v: "Node.js, Python, FastAPI" },
        { k: "cloud", v: "AWS, Docker, Kubernetes" },
    ];
    const working = [
        "Building context-aware AI systems with vector & graph DBs",
        "Learning advanced RAG patterns & multi-agent systems",
        "Interested in semantic search & LLM orchestration",
        "Debugging vector embeddings & Kafka streams at 3 AM!",
    ];
    const expertise = [
        "Context Engines & RAG",
        "Vector & Graph Search",
        "Real-time AI Pipelines",
        "Multi-Agent Systems",
    ];

    let specRows = spec
        .map(
            (s, i) => `    <text x="72" y="${190 + i * 22}" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}">
      <tspan fill="${GREEN}" fill-opacity="0.8">▸</tspan>  ${escapeHtml(s)}
    </text>`
        )
        .join("");

    let stackRows = stack
        .map(
            (s, i) => `    <text x="560" y="${190 + i * 22}" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}">
      <tspan fill="${AMUTED}">${escapeHtml(s.k)}</tspan><tspan fill="${GREEN}" fill-opacity="0.6">:</tspan> <tspan fill="${A}">${escapeHtml(s.v)}</tspan>
    </text>`
        )
        .join("");

    let workRows = working
        .map(
            (s, i) => `    <text x="72" y="${412 + i * 22}" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}">
      <tspan fill="${GREEN}" fill-opacity="0.8">▸</tspan>  ${escapeHtml(s)}
    </text>`
        )
        .join("");

    let expRows = expertise
        .map(
            (s, i) => `    <text x="560" y="${412 + i * 22}" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}">
      <tspan fill="${GREEN}" fill-opacity="0.8">▸</tspan>  ${escapeHtml(s)}
    </text>`
        )
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  <defs>
    <linearGradient id="ab" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0f14"/>
      <stop offset="100%" stop-color="#131920"/>
    </linearGradient>
    <linearGradient id="aw" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${A}"/>
      <stop offset="100%" stop-color="${AMUTED}"/>
    </linearGradient>
    <radialGradient id="ag" cx="90%" cy="6%" r="50%">
      <stop offset="0%" stop-color="${A}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${A}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="aw-grid" width="22" height="22" patternUnits="userSpaceOnUse">
      <path d="M 22 0 L 0 0 0 22" fill="none" stroke="${A}" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
  </defs>

  <path d="M 12 0 H 1048 L 1060 12 V 508 L 1048 520 H 12 L 0 508 V 12 Z" fill="url(#ab)"/>
  <path d="M 12 0 H 1048 L 1060 12 V 508 L 1048 520 H 12 L 0 508 V 12 Z" fill="url(#ag)"/>
  <path d="M 12 0 H 1048 L 1060 12 V 508 L 1048 520 H 12 L 0 508 V 12 Z" fill="none" stroke="${BORDER}"/>
  <path d="M 12 0 H 1048 L 1060 12 V 508 L 1048 520 H 12 L 0 508 V 12 Z" fill="none" stroke="${A}" stroke-opacity="0.22" stroke-width="1.2"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#aw-grid)"/>

  <path d="M 0 24 V 0 H 24" fill="none" stroke="${A}" stroke-opacity="0.5" stroke-width="2"/>
  <path d="M 1036 0 H 1060 V 24" fill="none" stroke="${A}" stroke-opacity="0.5" stroke-width="2"/>
  <path d="M 1060 496 V 520 H 1036" fill="none" stroke="${A}" stroke-opacity="0.5" stroke-width="2"/>
  <path d="M 24 520 H 0 V 496" fill="none" stroke="${A}" stroke-opacity="0.5" stroke-width="2"/>
  ${matrixColumn(24, 90, 180, "01")}
  ${matrixColumn(w - 24, 200, 300, "10")}

  <path d="M 16 20 H 1044" stroke="${BORDER}" stroke-width="1"/>
  <path d="M 24 20 H 150" stroke="${A}" stroke-opacity="0.7" stroke-width="2"/>
  <text x="28" y="16" font-family="'Segoe UI', monospace" font-size="12" letter-spacing="2.5" font-weight="700" fill="${A}">USER_PROFILE</text>
  <text x="412" y="16" text-anchor="end" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="1.5" fill="${AMUTED}">gurveeer@github</text>
  ${liveDot(416, 14)}

  <text x="40" y="64" font-family="'Segoe UI', monospace" font-size="22" font-weight="700" fill="${A}">Gurveer <tspan fill="${GREEN}">Singh</tspan></text>
  <text x="40" y="86" font-family="'Segoe UI', monospace" font-size="13" fill="${AMUTED}">AI Infrastructure Engineer · IIT Roorkee '23</text>

  <text x="40" y="116" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}" fill-opacity="0.9">Building next-generation context engines &amp; intelligent systems</text>
  <text x="40" y="136" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}" fill-opacity="0.9">that power AI applications at scale.</text>

  <text x="40" y="168" font-family="'Segoe UI', monospace" font-size="10" letter-spacing="2" fill="${A}" fill-opacity="0.85">▮ SPECIALIZATION</text>
  <path d="M 40 176 H 500" stroke="${BORDER}" stroke-width="1"/>
  ${specRows}

  <text x="528" y="168" font-family="'Segoe UI', monospace" font-size="10" letter-spacing="2" fill="${A}" fill-opacity="0.85">▮ TECH STACK</text>
  <path d="M 528 176 H 1020" stroke="${BORDER}" stroke-width="1"/>
  ${stackRows}

  <line x1="40" y1="384" x2="1020" y2="384" stroke="${BORDER}" stroke-width="1"/>

  <text x="40" y="404" font-family="'Segoe UI', monospace" font-size="10" letter-spacing="2" fill="${A}" fill-opacity="0.85">▮ CURRENTLY WORKING ON</text>
  <path d="M 40 412 H 500" stroke="${BORDER}" stroke-width="1"/>
  ${workRows}

  <text x="528" y="404" font-family="'Segoe UI', monospace" font-size="10" letter-spacing="2" fill="${A}" fill-opacity="0.85">▮ CORE EXPERTISE</text>
  <path d="M 528 412 H 1020" stroke="${BORDER}" stroke-width="1"/>
  ${expRows}

  <text x="40" y="${h - 24}" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="2" fill="${A}" fill-opacity="0.6">[ SINGH / GURVEER ]</text>
  <text x="${w - 40}" y="${h - 24}" text-anchor="end" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="2" fill="${A}" fill-opacity="0.6">[ RAG · VECTOR · GRAPH · STREAM ]</text>
</svg>
`;
}

async function main() {
    if (!token) {
        console.error("GHT token not provided");
        process.exit(1);
    }

    const octokit = new Octokit({
        auth: token,
        log: { debug() {}, info() {}, warn: console.warn, error: console.error },
    });

    const user = (await octokit.request("GET /users/{username}", { username })).data;
    const repos = await octokit.paginate("GET /users/{owner}/repos", { owner: username });

    let stars = 0;
    let forks = 0;
    const langCount = {};
    repos.forEach((r) => {
        stars += r.stargazers_count;
        forks += r.forks_count;
        if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
    });
    const totalLang = Object.values(langCount).reduce((a, b) => a + b, 0);
    const langs = Object.entries(langCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, pct: Math.round((count / totalLang) * 100) }));

    const data = {
        username,
        repos: user.public_repos,
        followers: user.followers,
        stars,
        forks,
        langs,
    };

    const featured = ["Hel-kit", "WiFi-NetHunter"];
    featured.forEach((name) => {
        const repo = repos.find((r) => r.name === name);
        if (repo) {
            fs.writeFileSync(
                path.join(__dirname, "..", "assets", `project-${name.toLowerCase()}.svg`),
                projectCard(repo)
            );
        } else {
            console.warn(`Repo ${name} not found`);
        }
    });

    fs.writeFileSync(path.join(__dirname, "..", "assets", "github-stats.svg"), statsCard(data));
    fs.writeFileSync(path.join(__dirname, "..", "assets", "github-langs.svg"), langsCard(data));

    const [commitRes, prRes, issueRes, contribData] = await Promise.all([
        octokit.search.commits({ q: `author:${username}` }),
        octokit.search.issuesAndPullRequests({ q: `type:pr author:${username}` }),
        octokit.search.issuesAndPullRequests({ q: `type:issue author:${username}` }),
        fetchContributions(username),
    ]);

    const streaks = computeStreaks(contribData.contributions || []);
    const activeDays = (contribData.contributions || []).filter((d) => d.count > 0).length;

    fs.writeFileSync(
        path.join(__dirname, "..", "assets", "github-streak.svg"),
        streakCard({
            current: streaks.current,
            longest: streaks.longest,
            total: contribData.total ? contribData.total.lastYear : 0,
            activeDays,
        })
    );
    fs.writeFileSync(
        path.join(__dirname, "..", "assets", "github-commits.svg"),
        commitsCard({
            commits: commitRes.data.total_count,
            prs: prRes.data.total_count,
            issues: issueRes.data.total_count,
            years: new Date().getFullYear() - new Date(user.created_at).getFullYear(),
        })
    );
    fs.writeFileSync(
        path.join(__dirname, "..", "assets", "github-contrib.svg"),
        contributionGraphCard({
            days: contribData.contributions || [],
            total: contribData.total ? contribData.total.lastYear : 0,
        })
    );
    fs.writeFileSync(
        path.join(__dirname, "..", "assets", "github-snake.svg"),
        snakeCard({ days: contribData.contributions || [] })
    );

    const connects = [
        { file: "connect-linkedin", platform: "LinkedIn", handle: "@gurveeer", url: "https://www.linkedin.com/in/gurveeer/", color: "#0A66C2", icon: "in", note: "Connect on LinkedIn" },
        { file: "connect-gmail", platform: "Gmail", handle: "singh5134957@gmail.com", url: "mailto:singh5134957@gmail.com", color: "#D14836", icon: "@", note: "Drop an email anytime" },
        { file: "connect-x", platform: "X", handle: "@gurveeer", url: "https://twitter.com/Gurveeeeeer", color: "#e6edf3", icon: "𝕏", note: "Follow on X / Twitter" },
        { file: "connect-portfolio", platform: "Portfolio", handle: "gurveeer.github.io", url: "https://gurveeer.github.io/new-portfolio/", color: "#00FF41", icon: "◉", note: "Explore my work" },
    ];
    connects.forEach((c) => {
        fs.writeFileSync(
            path.join(__dirname, "..", "assets", `${c.file}.svg`),
            connectCard(c.platform, c.handle, c.url, c.color, c.icon, c.note)
        );
    });

    fs.writeFileSync(path.join(__dirname, "..", "assets", "footer.svg"), footerCard());
    fs.writeFileSync(path.join(__dirname, "..", "assets", "hero.svg"), heroCard());
    fs.writeFileSync(path.join(__dirname, "..", "assets", "about.svg"), aboutCard());

    console.log("Custom stats, streak, commits, heatmap, connect, footer & project cards generated for", username);
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { statsCard, langsCard, projectCard, streakCard, commitsCard, contributionGraphCard, connectCard, footerCard, heroCard, aboutCard, snakeCard, fetchContributions, computeStreaks, formatNumber, langColor, escapeHtml };