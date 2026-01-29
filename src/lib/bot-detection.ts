/**
 * Utility functions to detect search engine bots and crawlers
 */

/**
 * Common search engine bot user-agent patterns
 */
const BOT_PATTERNS = [
  // Google
  /googlebot/i,
  /google-inspectiontool/i,
  /mediapartners-google/i,
  /adsbot-google/i,
  
  // Bing
  /bingbot/i,
  /msnbot/i,
  
  // Other major search engines
  /slurp/i, // Yahoo
  /duckduckbot/i, // DuckDuckGo
  /baiduspider/i, // Baidu
  /yandexbot/i, // Yandex
  /sogou/i, // Sogou
  /exabot/i, // Exalead
  /facebot/i, // Facebook
  /ia_archiver/i, // Alexa
  
  // Generic crawler patterns
  /crawler/i,
  /spider/i,
  /bot/i,
  /crawling/i,
];

/**
 * Checks if the given user-agent string belongs to a search engine bot
 */
export function isSearchEngineBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    return false;
  }
  
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Gets the user-agent from Next.js headers and checks if it's a bot
 */
export async function isBotFromHeaders(): Promise<boolean> {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const userAgent = headersList.get("user-agent");
  
  return isSearchEngineBot(userAgent);
}
