const axios = require("axios");

const LEAGUE_MAP = {
  epl:        { code: "PL",  name: "Premier League",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  laliga:     { code: "PD",  name: "La Liga",         flag: "🇪🇸" },
  bundesliga: { code: "BL1", name: "Bundesliga",      flag: "🇩🇪" },
  seriea:     { code: "SA",  name: "Serie A",         flag: "🇮🇹" },
  ligue1:     { code: "FR",  name: "Ligue 1",         flag: "🇫🇷" },
};

const LEAGUE_ALIASES = {
  "epl-table": "epl", "pl-table": "epl", "premierleague": "epl", pl: "epl",
  "pd-table": "laliga", "la-liga": "laliga",
  "bl-table": "bundesliga", "bl1": "bundesliga",
  "serie-a": "seriea", "sa-table": "seriea",
  "ligue-1": "ligue1", "fr-table": "ligue1",
};

function resolveLeague(input) {
  const key = input.toLowerCase().replace(/\s+/g, "");
  return LEAGUE_MAP[key] || LEAGUE_MAP[LEAGUE_ALIASES[key]];
}

function validateJsonResponse(data, context) {
  if (typeof data === "string" && data.trim().startsWith("<")) {
    throw new Error(`${context} returned HTML instead of JSON — API may be down`);
  }
  if (data === null || data === undefined) {
    throw new Error(`${context} returned empty response`);
  }
}

async function getStandings(leagueKey) {
  const league = resolveLeague(leagueKey);
  if (!league) return { error: `Unknown league. Available: ${Object.keys(LEAGUE_MAP).join(", ")}` };
  try {
    const { data } = await axios.get(`https://api.dreaded.site/api/standings/${league.code}`, { timeout: 15000 });
    validateJsonResponse(data, `${league.name} standings`);
    if (!data.data || (typeof data.data === "string" && !data.data.trim())) {
      return { error: `No standings data available for ${league.name}.` };
    }
    return { text: `${league.flag} *${league.name} Standings*\n\n${data.data}`, league };
  } catch (e) {
    return { error: `Could not fetch ${league.name} standings: ${e.message || "API may be down."}` };
  }
}

async function getFixtures() {
  const leagues = [
    { code: "PL", name: "Premier League", flag: "🇬🇧" },
    { code: "PD", name: "La Liga",        flag: "🇪🇸" },
    { code: "BL1", name: "Bundesliga",    flag: "🇩🇪" },
    { code: "SA", name: "Serie A",        flag: "🇮🇹" },
    { code: "FR", name: "Ligue 1",        flag: "🇫🇷" },
  ];

  let message = "⚽ *Today's Football Fixtures*\n\n";
  let anySuccess = false;
  for (const league of leagues) {
    try {
      const { data } = await axios.get(`https://api.dreaded.site/api/matches/${league.code}`, { timeout: 10000 });
      validateJsonResponse(data, `${league.name} fixtures`);
      const matchData = data.data;
      if (typeof matchData === "string" && matchData.trim()) {
        message += `${league.flag} *${league.name}:*\n${matchData}\n\n`;
        anySuccess = true;
      } else if (Array.isArray(matchData) && matchData.length > 0) {
        message += `${league.flag} *${league.name}:*\n`;
        for (const match of matchData) {
          if (match.game) {
            message += `${match.game}\nDate: ${match.date || "?"} | Time: ${match.time || "?"}\n`;
          }
        }
        message += "\n";
        anySuccess = true;
      } else {
        message += `${league.flag} *${league.name}:* No matches scheduled\n\n`;
      }
    } catch {
      message += `${league.flag} *${league.name}:* Unable to fetch\n\n`;
    }
  }
  if (!anySuccess) {
    message += "\n⚠️ _Sports API may be temporarily unavailable. Try again later._";
  }
  return message;
}

module.exports = { getStandings, getFixtures, resolveLeague, LEAGUE_MAP, LEAGUE_ALIASES };
