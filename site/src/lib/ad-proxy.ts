import { createHash, randomInt } from "node:crypto";
import type { KoahEarning } from "./dashboard.ts";
import { formatUserCode, USER_CODE_ALPHABET, USER_CODE_LENGTH } from "./user-code.ts";

type Environment = Record<string, string | undefined>;
type Device = {
  status: "connected" | "banned" | "pending";
  userId: string | null;
  email: string | null;
};
export type DeviceStore = {
  findDevice: (keyHash: string) => Promise<Device | null>;
  takeAdRequest: (
    keyHash: string,
  ) => Promise<{ status: "connected" | "banned" | "over_limit"; userId: string } | null>;
  startDevice: (device: {
    keyHash: string;
    userCode: string;
    ip: string;
    location: string | null;
  }) => Promise<string>;
};
type Koah = { env: Environment; fetch: typeof fetch };
const DEVICE_KEY = /^Bearer (sq_[A-Za-z0-9_-]{43})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hashDeviceKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateUserCode() {
  return Array.from(
    { length: USER_CODE_LENGTH },
    () => USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)],
  ).join("");
}

// Vercel overwrites x-forwarded-for, so a client cannot supply it. Next sets it to the socket address in dev.
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
}

export function reply(body: object | null, status = 200) {
  const headers = { "Cache-Control": "private, no-store" };
  return body ? Response.json(body, { status, headers }) : new Response(null, { status, headers });
}

const unavailable = () => reply({ error: "Ad service unavailable" }, 502);
const suspended = () => reply({ error: "Account suspended" }, 403);
const unauthorized = () => reply({ error: "Connect Sidequest: run /sidequest-connect" }, 401);

// The mod reads 401 and 403 as account states, so only success, no fill and rate limits pass through. Status 0 is a network failure.
function fromKoah(status: number) {
  if (status === 200 || status === 204 || status === 429) return reply(null, status);
  console.error("Sidequest ad proxy: Koah responded", status);
  return unavailable();
}

function deviceKeyHash(request: Request) {
  const key = request.headers.get("authorization")?.match(DEVICE_KEY)?.[1];
  return key ? hashDeviceKey(key) : null;
}

async function lookupDevice(request: Request, { findDevice }: Pick<DeviceStore, "findDevice">) {
  const keyHash = deviceKeyHash(request);
  let device: Device | null = null;
  try {
    if (keyHash) device = await findDevice(keyHash);
  } catch {
    return unavailable();
  }
  return device?.status === "banned" ? suspended() : device;
}

async function authenticate(request: Request, store: Pick<DeviceStore, "findDevice">) {
  const device = await lookupDevice(request, store);
  if (device instanceof Response) return device;
  return device?.status === "connected" && device.userId ? device.userId : unauthorized();
}

function koahRequest({ env, fetch: fetcher }: Koah, path: string, body?: object, method = "POST") {
  return fetcher(`${env.KOAH_API_URL || "https://app.koah.ai"}/api/v1/server/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.KOAH_SERVING_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
}

export async function fetchUserEarnings(
  koah: Koah,
  userId: string,
  startsAt: string,
  endsAt: string,
) {
  const response = await koahRequest(
    koah,
    `users/${userId}/earnings?starts_at=${startsAt}&ends_at=${endsAt}`,
    undefined,
    "GET",
  );
  if (response.status !== 200) throw new Error(`Koah earnings responded ${response.status}`);
  const { earnings } = (await response.json()) as { earnings: KoahEarning[] };
  return earnings;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

export async function handleAdRequest(
  request: Request,
  deps: Koah & Pick<DeviceStore, "takeAdRequest">,
) {
  const keyHash = deviceKeyHash(request);
  if (!keyHash) return unauthorized();
  const body: Record<string, unknown> | null = await request.json().catch(() => null);
  if (!body) return reply({ error: "Send a JSON body." }, 422);
  const ip = clientIp(request.headers);
  if (!ip) return reply({ error: "Client IP unavailable" }, 503);
  let taken;
  try {
    taken = await deps.takeAdRequest(keyHash);
  } catch {
    return unavailable();
  }
  if (!taken) return unauthorized();
  if (taken.status === "banned") return suspended();
  if (taken.status === "over_limit") return reply(null, 204);
  try {
    const upstream = await koahRequest(deps, "request_ad", {
      publisherId: deps.env.KOAH_PUBLISHER_ID,
      platform: "cli",
      user: { id: taken.userId, ip },
      context: {
        type: "conversation",
        question: text(body.question, 4000),
        answer: text(body.answer, 4000),
        externalConversationId: text(body.conversationId, 64),
      },
      demo: body.demo === true,
    });
    if (upstream.status !== 200) return fromKoah(upstream.status);
    const { impressionLink, ...ad } = await upstream.json();
    const impressionId =
      typeof impressionLink === "string" ? impressionLink.split("/").pop() : undefined;
    return reply({ ...ad, impressionId });
  } catch {
    return fromKoah(0);
  }
}

export async function handleImpression(
  request: Request,
  id: string,
  deps: Koah & Pick<DeviceStore, "findDevice">,
) {
  if (!UUID.test(id)) return reply({ error: "Not found" }, 404);
  const auth = await authenticate(request, deps);
  if (typeof auth !== "string") return auth;
  // No ownership check: query ids are unguessable and Koah credits the query's own visitor, so another user's call gains nothing.
  try {
    const upstream = await koahRequest(deps, `impression/${id}`);
    return fromKoah(upstream.status);
  } catch {
    return fromKoah(0);
  }
}

function cityAndCountry(headers: Headers) {
  const decode = (value: string | null) => {
    try {
      return value ? decodeURIComponent(value) : "";
    } catch {
      return "";
    }
  };
  return (
    [decode(headers.get("x-vercel-ip-city")), decode(headers.get("x-vercel-ip-country"))]
      .filter(Boolean)
      .join(", ") || null
  );
}

export async function startDeviceConnection(
  request: Request,
  { startDevice }: Pick<DeviceStore, "startDevice">,
) {
  const keyHash = deviceKeyHash(request);
  if (!keyHash) return reply({ error: "Invalid device key" }, 400);
  const ip = clientIp(request.headers);
  if (!ip) return reply({ error: "Client IP unavailable" }, 503);
  const userCode = generateUserCode();
  let expiresAt: string;
  try {
    expiresAt = await startDevice({
      keyHash,
      userCode,
      ip,
      location: cityAndCountry(request.headers),
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P0429") return reply({ error: "Too many pending connections" }, 429);
    if (code === "23505") return reply({ error: "Try again" }, 409);
    return unavailable();
  }
  return reply({ userCode: formatUserCode(userCode), expiresAt }, 201);
}

export async function deviceConnectionStatus(
  request: Request,
  store: Pick<DeviceStore, "findDevice">,
) {
  const device = await lookupDevice(request, store);
  if (device instanceof Response) return device;
  if (device?.status === "connected") return reply({ email: device.email });
  if (device?.status === "pending") return reply({}, 202);
  return reply({ error: "Not found" }, 404);
}
