const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const token = process.env.GHT;
const username = process.argv[2] || "gurveeer";

const GREEN = "#00FF41";
const GREEN_DARK = "#00c530";
const BG = "#0d1117";
const CARD = "#161b22";
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
};

function langColor(name) {
    if (LANGUAGE_COLORS[name]) return LANGUAGE_COLORS[name];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return `hsl(${h},70%,60%)`;
}

function statsCard(data) {
    const w = 440;
    const h = 200;
    const metrics = [
        { label: "Repositories", value: formatNumber(data.repos), icon: "▤" },
        { label: "Stars Earned", value: formatNumber(data.stars), icon: "★" },
        { label: "Total Forks", value: formatNumber(data.forks), icon: "⑂" },
        { label: "Followers", value: formatNumber(data.followers), icon: "●" },
    ];

    const rows = metrics
        .map((m, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = 26 + col * 200;
            const y = 64 + row * 56;
            return `
        <g>
          <rect x="${x}" y="${y - 14}" width="188" height="42" rx="8" fill="${CARD}" stroke="${BORDER}" stroke-width="1"/>
          <text x="${x + 12}" y="${y + 4}" font-family="'Segoe UI', monospace" font-size="11" fill="${MUTED}">${m.icon}  ${m.label}</text>
          <text x="${x + 12}" y="${y + 20}" font-family="'Segoe UI', monospace" font-size="18" font-weight="700" fill="${WHITE}">${m.value}</text>
        </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  <defs>
    <linearGradient id="sb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${CARD}"/>
    </linearGradient>
    <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN_DARK}"/>
    </linearGradient>
  </defs>

  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="url(#sb)" stroke="${BORDER}"/>
  <rect x="0.5" y="0.5" width="4" height="${h - 1}" rx="2" fill="url(#sg)"/>

  <text x="26" y="30" font-family="'Segoe UI', monospace" font-size="15" font-weight="700" fill="${WHITE}">GitHub Stats</text>
  <text x="414" y="30" text-anchor="end" font-family="monospace" font-size="10" fill="${MUTED}">@${escapeHtml(data.username)}</text>

  ${rows}

  <text x="26" y="${h - 12}" font-family="monospace" font-size="9" fill="${MUTED}">auto-generated · updated daily</text>
</svg>
`;
}

function langsCard(data) {
    const w = 440;
    const h = 200;
    const maxPct = data.langs[0] ? data.langs[0].pct : 1;

    const rows = data.langs
        .map((l, i) => {
            const y = 56 + i * 26;
            const color = langColor(l.name);
            return `
        <g>
          <text x="26" y="${y}" font-family="'Segoe UI', monospace" font-size="12" fill="${TEXT}">
            <tspan fill="${color}">●</tspan> ${escapeHtml(l.name)}
          </text>
          <text x="414" y="${y}" text-anchor="end" font-family="monospace" font-size="12" fill="${WHITE}">${l.pct}%</text>
          <rect x="26" y="${y + 6}" width="388" height="6" rx="3" fill="${CARD}" stroke="${BORDER}" stroke-width="0.5"/>
          <rect x="26" y="${y + 6}" width="${Math.max(6, (l.pct / maxPct) * 388)}" height="6" rx="3" fill="${color}"/>
        </g>`;
        })
        .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  <defs>
    <linearGradient id="lb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${CARD}"/>
    </linearGradient>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN_DARK}"/>
    </linearGradient>
  </defs>

  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="url(#lb)" stroke="${BORDER}"/>
  <rect x="0.5" y="0.5" width="4" height="${h - 1}" rx="2" fill="url(#lg)"/>

  <text x="26" y="30" font-family="'Segoe UI', monospace" font-size="15" font-weight="700" fill="${WHITE}">Most Used Languages</text>

  ${rows}

  <text x="26" y="${h - 12}" font-family="monospace" font-size="9" fill="${MUTED}">by repo count · auto-generated</text>
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

    fs.writeFileSync(path.join(__dirname, "..", "assets", "github-stats.svg"), statsCard(data));
    fs.writeFileSync(path.join(__dirname, "..", "assets", "github-langs.svg"), langsCard(data));
    console.log("Custom stats cards generated for", username);
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { statsCard, langsCard, formatNumber, langColor, escapeHtml };
