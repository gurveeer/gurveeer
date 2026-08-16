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
    console.log("Custom stats, streak, commits & project cards generated for", username);
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { statsCard, langsCard, projectCard, streakCard, commitsCard, fetchContributions, computeStreaks, formatNumber, langColor, escapeHtml };