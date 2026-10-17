export type FakeInit = Omit<RequestInit, "headers" | "body"> & {
  headers: Record<string, string>;
  body: string;
};
export type FakeCall = FakeInit & { url: string; data: Record<string, unknown> };

// Bun's `typeof fetch` includes `fetch.preconnect`, so a bare function does not satisfy it.
export function fakeFetch(
  handler: (url: string, init: FakeInit) => Response | Promise<Response>,
): typeof fetch {
  return Object.assign(
    async (input: string | URL | Request, init: RequestInit = {}) =>
      handler(input instanceof Request ? input.url : String(input), {
        ...init,
        headers: (init.headers ?? {}) as Record<string, string>,
        body: typeof init.body === "string" ? init.body : "",
      }),
    { preconnect() {} },
  );
}
