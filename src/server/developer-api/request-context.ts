import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which API key the current request came in on, for code far from the route
 * that has no context to read it from. `logActivity` stamps it on every row,
 * so the activity log can say which integration did what.
 */
type ApiRequest = { keyId: string | null; keyName: string };

const storage = new AsyncLocalStorage<ApiRequest>();

export function runAsApiRequest<T>(request: ApiRequest, run: () => T): T {
  return storage.run(request, run);
}

export function currentApiRequest(): ApiRequest | undefined {
  return storage.getStore();
}
