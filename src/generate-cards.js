const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const token = process.env.GHT;
const username = process.argv[2] || "gurveeer";

const GREEN = "#00FF41";
const GREEN_DARK = "#00c530";
const GREEN_DIM = "#0a5c22";
const BG = "#0d1117";
const CARD = "#131920";
const BORDER = "#21262d";
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
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Go: "#00ADD8",
    "C++": "#f34b7d",
    Java: "#b07219",
    Rust: "#dea584",
    HTML: "#e34c26",
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
      <stop offset="55%" stop-color="#0f141c"/>
      <stop offset="100%" stop-color="${CARD}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="8%" r="55%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>
  </defs>`;
}

function frame(w, h) {
    return `
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="url(#glow)"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="none" stroke="${BORDER}"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="none" stroke="${GREEN}" stroke-opacity="0.28" stroke-width="1.2"/>`;
}

function matrixColumn(x, from, to, chars) {
    const n = 4;
    let out = "";
    for (let i = 0; i < n; i++) {
        const y = from + i * 14;
        const ch = chars[(x * 7 + i * 3 + from) % chars.length];
        const o = 0.06 + i * 0.04;
        out += `    <text x="${x}" y="${y}" font-family="monospace" font-size="8" fill="${GREEN}" fill-opacity="${o}">${ch}</text>`;
    }
    return out;
}

function corners(w, h) {
    const s = 14;
    const l = 1.6;
    return `
  <path d="M 0 ${s} L 0 0 L ${s} 0" fill="none" stroke="${GREEN}" stroke-opacity="0.5" stroke-width="${l}"/>
  <path d="M ${w - s} 0 L ${w} 0 L ${w} ${s}" fill="none" stroke="${GREEN}" stroke-opacity="0.5" stroke-width="${l}"/>
  <path d="M ${w} ${h - s} L ${w} ${h} L ${w - s} ${h}" fill="none" stroke="${GREEN}" stroke-opacity="0.5" stroke-width="${l}"/>
  <path d="M ${s} ${h} L 0 ${h} L 0 ${h - s}" fill="none" stroke="${GREEN}" stroke-opacity="0.5" stroke-width="${l}"/>`;
}

function scanlines(w, h) {
    return `
  <pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse">
    <rect width="3" height="1.5" fill="#000" fill-opacity="0.10"/>
  </pattern>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#scan)"/>`;
}

function liveDot(x, y) {
    return `
  <circle cx="${x}" cy="${y}" r="3.2" fill="${GREEN}">
    <animate attributeName="opacity" values="1;0.25;1" dur="2.2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${GREEN}" stroke-opacity="0.35">
    <animate attributeName="r" values="4;10" dur="2.2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.5;0" dur="2.2s" repeatCount="indefinite"/>
  </circle>`;
}

function header(w, title, tag) {
    return `
  <text x="28" y="38" font-family="'Segoe UI', monospace" font-size="15" font-weight="700" fill="${WHITE}">${title}</text>
  <text x="412" y="38" text-anchor="end" font-family="'Segoe UI', monospace" font-size="9.5" letter-spacing="1.5" fill="${MUTED}">${tag}</text>
  ${liveDot(416, 46)}`;
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
            const x = 24 + col * 206;
            const y = 58 + row * 58;
            return `
    <g>
      <rect x="${x}" y="${y}" width="196" height="50" rx="9" fill="${CARD}" stroke="${BORDER}" stroke-width="1"/>
      <rect x="${x}" y="${y}" width="3" height="50" rx="1.5" fill="url(#accent)"/>
      <rect x="${x + 12}" y="${y + 12}" width="22" height="22" rx="6" fill="${GREEN_DIM}" fill-opacity="0.25"/>
      <text x="${x + 20}" y="${y + 27}" text-anchor="middle" font-family="monospace" font-size="11" fill="${GREEN}">${m.icon}</text>
      <text x="${x + 42}" y="${y + 20}" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="1.2" fill="${MUTED}">${m.label}</text>
      <text x="${x + 42}" y="${y + 40}" font-family="'Segoe UI', monospace" font-size="17" font-weight="700" fill="${WHITE}">${m.value}</text>
    </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${scanlines(w, h)}
  ${corners(w, h)}
  ${matrixColumn(15, 48, 120, "01")}
  ${matrixColumn(425, 100, 170, "10")}
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
            const y = 48 + i * 26;
            const color = langColor(l.name);
            const bw = Math.max(10, Math.round((l.pct / maxPct) * 372));
            return `
    <g>
      <text x="28" y="${y}" font-family="'Segoe UI', monospace" font-size="11" fill="${TEXT}">
        <tspan fill="${color}">●</tspan>  ${escapeHtml(l.name)}
      </text>
      <text x="412" y="${y}" text-anchor="end" font-family="'Segoe UI', monospace" font-size="11" font-weight="700" fill="${WHITE}">${l.pct}%</text>
      <rect x="28" y="${y + 8}" width="384" height="5" rx="2.5" fill="${BG}" stroke="${BORDER}" stroke-width="0.5"/>
      <rect x="28" y="${y + 8}" width="${bw}" height="5" rx="2.5" fill="${color}"/>
    </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${scanlines(w, h)}
  ${corners(w, h)}
  ${matrixColumn(15, 48, 120, "10")}
  ${matrixColumn(425, 90, 160, "01")}
  ${header(w, "LANG_MATRIX", "by repo count")}
  ${rows}
</svg>
`;
}

function projectCard(repo) {
    const w = 440;
    const h = 200;
    const desc = (repo.description || "No description provided").replace(/\s+/g, " ").trim();
    const shortDesc = desc.length > 58 ? desc.slice(0, 55) + "…" : desc;
    const lang = repo.language || "Unknown";
    const color = langColor(lang);
    const stars = repo.stargazers_count ? formatNumber(repo.stargazers_count) : "0";
    const forks = repo.forks_count ? formatNumber(repo.forks_count) : "0";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  ${defs()}
  ${frame(w, h)}
  ${scanlines(w, h)}
  ${corners(w, h)}
  ${matrixColumn(15, 48, 120, "01")}
  ${matrixColumn(425, 100, 170, "10")}

  <text x="28" y="36" font-family="'Segoe UI', monospace" font-size="16" font-weight="700" fill="${WHITE}">${escapeHtml(repo.name)}</text>
  <rect x="${28 + repo.name.length * 9 + 4}" y="24" width="8" height="8" rx="2" fill="${GREEN}" fill-opacity="0.8"/>

  <text x="28" y="68" font-family="'Segoe UI', sans-serif" font-size="12" fill="${TEXT}">${escapeHtml(shortDesc)}</text>

  <line x1="28" y1="92" x2="412" y2="92" stroke="${BORDER}" stroke-width="1"/>

  <text x="28" y="132" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}">
    <tspan fill="${color}">●</tspan>  ${escapeHtml(lang)}
  </text>

  <text x="412" y="128" text-anchor="end" font-family="'Segoe UI', monospace" font-size="12" font-weight="700" fill="${WHITE}">★ ${stars}</text>
  <text x="412" y="146" text-anchor="end" font-family="'Segoe UI', monospace" font-size="12" font-weight="700" fill="${WHITE}">⑂ ${forks}</text>

  <text x="28" y="${h - 16}" font-family="'Segoe UI', monospace" font-size="9" letter-spacing="1.2" fill="${GREEN}" fill-opacity="0.7">[ ${escapeHtml(repo.name.toUpperCase())} ]</text>
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

    const featured = ["TG-DL-BOT", "hnm-clone"];
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
    console.log("Custom stats & project cards generated for", username);
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { statsCard, langsCard, projectCard, formatNumber, langColor, escapeHtml };