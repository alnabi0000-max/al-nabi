/**
 * Anti-Analysis WAF — BuiltWith / Wappalyzer / scrapers / AI bots
 */

const BLOCKED_UA_PATTERNS: RegExp[] = [
  /builtwith/i,
  /wappalyzer/i,
  /whatweb/i,
  /webtech/i,
  /stack.?analyzer/i,
  /technology.?profiler/i,
  /netcraft/i,
  /ptengine/i,
  /scrapy/i,
  /httrack/i,
  /site.?analyzer/i,
  /httpclient/i,
  /python-requests/i,
  /python-urllib/i,
  /aiohttp/i,
  /httpx\//i,
  /go-http-client/i,
  /java\/\d/i,
  /libwww-perl/i,
  /mechanize/i,
  /phantomjs/i,
  /headlesschrome/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /gptbot/i,
  /chatgpt-user/i,
  /claudebot/i,
  /anthropic/i,
  /bytespider/i,
  /ccbot/i,
  /google-extended/i,
  /diffbot/i,
  /dataforseo/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /amazonbot/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /slackbot-linkexpanding/i,
  /discordbot/i,
  /preview.?bot/i,
  /url.?analyzer/i,
  /link.?checker/i,
  /sitechecker/i,
  /screaming.?frog/i,
  /nutch/i,
];

/** Bo'sh analyzer UA */
const EMPTY_OR_SUSPECT = /^(curl|wget|httpie|postmanruntime|insomnia|rest-client)\//i;

export function isAnalyzerUserAgent(ua: string | null): boolean {
  if (!ua || ua.trim().length < 8) return true;
  const s = ua.trim();
  if (BLOCKED_UA_PATTERNS.some((re) => re.test(s))) return true;
  if (EMPTY_OR_SUSPECT.test(s)) return true;
  // Wappalyzer / BuiltWith ba'zan oddiy Chrome UA + maxsus header
  return false;
}

export function hasAnalyzerHeaders(headers: Headers): boolean {
  const suspects = [
    "x-builtwith",
    "x-wappalyzer",
    "x-scanner",
    "x-probe",
    "x-purpose",
  ];
  for (const h of suspects) {
    if (headers.get(h)) return true;
  }
  const purpose = headers.get("purpose") || headers.get("x-purpose") || "";
  if (/prefetch|preview|analyze|scan/i.test(purpose) && !headers.get("sec-fetch-mode")) {
    return true;
  }
  return false;
}

/** Analyzerlarga — texnologiya oshkor qilinmagan blank */
export const ANALYZER_BLANK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="robots" content="noindex,nofollow,noarchive"/>
<meta name="generator" content="Alnabiy"/>
<title>Alnabiy</title>
</head>
<body></body>
</html>`;
