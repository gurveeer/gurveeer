const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const token = process.env.GHT;
const username = process.argv[2] || "gurveeer";

const GREEN = "#00FF41";
const DARK = "#0d1117";
const CARD = "#161b22";
const BORDER = "#30363d";
const TEXT = "#c9d1d9";
const DIM = "#8b949e";

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
    repos.forEach((r) => {
        stars += r.stargazers_count;
        forks += r.forks_count;
    });

    const langCount = {};
    repos.forEach((r) => {
        if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
    });
    const totalLang = Object.values(langCount).reduce((a, b) => a + b, 0);
    const topLangs = Object.entries(langCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, pct: Math.round((count / totalLang) * 100) }));

    const commits = await octokit.search.commits({ q: `author:${username}` }).then((r) => r.data.total_count);

    const stats = {
        username,
        name: user.name || username,
        location: user.location || "Earth",
        repos: user.public_repos,
        followers: user.followers,
        following: user.following,
        stars,
        forks,
        commits,
        avatar: user.avatar_url,
        bio: user.bio || "Building context engines & RAG systems",
        langs: topLangs,
    };

    const svg = renderCard(stats);
    fs.writeFileSync(path.join(__dirname, "..", "github_stats.svg"), svg);
    console.log("github_stats.svg generated for", username);
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderCard(s) {
    const w = 900;
    const h = 420;
    const rowH = 44;
    const metrics = [
        { label: "Stars", value: s.stars, icon: "★" },
        { label: "Forks", value: s.forks, icon: "⑂" },
        { label: "Commits", value: s.commits, icon: "✓" },
        { label: "Repos", value: s.repos, icon: "▤" },
        { label: "Followers", value: s.followers, icon: "●" },
    ];

    let langBars = "";
    let barX = 620;
    let barY = 170;
    const barMaxW = 210;
    s.langs.forEach((l, i) => {
        const bw = Math.max(20, Math.round((l.pct / 100) * barMaxW));
        const hue = (i * 55 + 120) % 360;
        langBars += `
        <rect x="${barX}" y="${barY}" width="${bw}" height="8" rx="4" fill="hsl(${hue},80%,55%)"/>
        <text x="${barX + bw + 8}" y="${barY + 8}" font-family="monospace" font-size="11" fill="${TEXT}">${escapeHtml(l.name)} ${l.pct}%</text>`;
        barY += 22;
    });

    let metricRows = "";
    metrics.forEach((m, i) => {
        const y = 150 + i * rowH;
        metricRows += `
        <rect x="40" y="${y - 20}" width="360" height="30" rx="6" fill="${CARD}" stroke="${BORDER}" stroke-width="1"/>
        <text x="56" y="${y}" font-family="monospace" font-size="13" fill="${GREEN}">${m.icon}</text>
        <text x="84" y="${y}" font-family="monospace" font-size="13" fill="${DIM}">${m.label}</text>
        <text x="380" y="${y}" text-anchor="end" font-family="monospace" font-size="14" font-weight="bold" fill="${GREEN}">${m.value}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${DARK}"/>
      <stop offset="100%" stop-color="${CARD}"/>
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="10%" r="60%">
      <stop offset="0%" stop-color="${GREEN}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" rx="14" fill="url(#bg)"/>
  <rect x="0" y="0" width="${w}" height="${h}" rx="14" fill="url(#glow)"/>
  <rect x="0" y="0" width="${w}" height="${h}" rx="14" fill="none" stroke="${GREEN}" stroke-width="1.5" opacity="0.4"/>

  <!-- Window chrome -->
  <rect x="20" y="20" width="${w - 40}" height="40" rx="8" fill="${CARD}" stroke="${BORDER}"/>
  <circle cx="40" cy="40" r="6" fill="#ff5f56"/>
  <circle cx="58" cy="40" r="6" fill="#ffbd2e"/>
  <circle cx="76" cy="40" r="6" fill="#27c93f"/>
  <text x="450" y="44" text-anchor="middle" font-family="monospace" font-size="12" fill="${DIM}">${escapeHtml(s.username)}@github:~ — github stats</text>

  <!-- Title -->
  <text x="40" y="100" font-family="monospace" font-size="20" font-weight="bold" fill="${GREEN}">${escapeHtml(s.name)}</text>
  <text x="40" y="122" font-family="monospace" font-size="13" fill="${DIM}">${escapeHtml(s.location)} · since 2023</text>
  <text x="40" y="140" font-family="monospace" font-size="12" fill="${TEXT}">${escapeHtml(s.bio)}</text>

  ${metricRows}

  <!-- Right panel: languages -->
  <text x="620" y="145" font-family="monospace" font-size="13" fill="${GREEN}">▸ LANGUAGE BREAKDOWN</text>
  <line x1="620" y1="155" x2="860" y2="155" stroke="${BORDER}"/>
  ${langBars}

  <text x="40" y="${h - 30}" font-family="monospace" font-size="11" fill="${DIM}">generated by gurveer/gurveeer · refreshed daily · @${escapeHtml(s.username)}</text>
</svg>
`;
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { renderCard, escapeHtml };
