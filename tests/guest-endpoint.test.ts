import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/guest-invitation/index.ts", import.meta.url), "utf8");
const compiled = await new Bun.Transpiler({ loader: "ts" }).transform(
  source.replace("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'", ""),
);

const png = `data:image/png;base64,${btoa(String.fromCharCode(...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))}`;
const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};
const origin = "https://app.example";
const baseInput = {
  title: "မင်္ဂလာဆောင်",
  person_a: "သီဟ",
  person_b: "မေမြတ်",
  parent_a: "ဦးအောင်",
  parent_b: "ဒေါ်ခင်",
  event_date: "2027-02-14",
  event_time: "18:30",
  venue: "Yangon Hall",
  message: "Welcome",
  map_url: "https://maps.google.com/maps?q=16,96",
  template: "thazin",
  theme: "sage",
  project_type: "wedding",
};

type RpcResult = { data: unknown; error: { message: string } | null };
type Harness = {
  handler: (request: Request) => Promise<Response>;
  env: Record<string, string | undefined>;
  rpcArgs: Record<string, unknown>[];
  setRpcResult: (result: RpcResult) => void;
};

function makeHarness(): Harness {
  const env: Record<string, string | undefined> = {
    ALLOWED_ORIGINS: origin,
    IP_HASH_SALT: "strongtest",
    SUPABASE_URL: "https://supabase.example",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    GUEST_UPLOAD_BRIDGE_SECRET: "gateway-only-secret-for-unit-tests-32",
  };
  const rpcArgs: Record<string, unknown>[] = [];
  let rpcResult: RpcResult = { data: null, error: null };
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const DenoStub = {
    env: { get: (key: string) => env[key] },
    serve: (captured: (request: Request) => Promise<Response>) => { handler = captured; },
  };
  const createClient = () => ({
    rpc: async (_name: string, args: Record<string, unknown>) => {
      rpcArgs.push(args);
      return rpcResult.data === null && !rpcResult.error
        ? {
            data: {
              ...(args.p_input as Record<string, unknown>),
              photos: args.p_photos,
              status: "published",
              public_key: "test",
              username: "guest-test",
            },
            error: null,
          }
        : rpcResult;
    },
  });
  new Function("Deno", "createClient", compiled)(DenoStub, createClient);
  if (!handler) throw new Error("Deno.serve did not capture a handler");
  return { handler, env, rpcArgs, setRpcResult: (result) => { rpcResult = result; } };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://edge.example/guest-invitation", {
    method: "POST",
    headers: { origin, "x-forwarded-for": "203.0.113.5", "content-type": "application/json", "x-invitation-upload-bridge": "gateway-only-secret-for-unit-tests-32", ...headers },
    body: JSON.stringify(body),
  });
}
function validBody(input: Record<string, unknown> = baseInput, photos = [{ dataUrl: png, caption: "" }]) {
  return { input, photos };
}
async function json(response: Response) { return await response.json() as Record<string, any>; }

// Every harness owns its env, client, RPC recorder, and captured handler; no globals are mutated.
describe("guest invitation edge endpoint", () => {
  test("answers OPTIONS preflight with the exact CORS contract", async () => {
    const { handler } = makeHarness();
    const response = await handler(new Request("https://edge.example/guest-invitation", {
      method: "OPTIONS", headers: { origin, "x-invitation-upload-bridge": "gateway-only-secret-for-unit-tests-32" },
    }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-methods")).toBe("POST,OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("authorization, apikey, x-client-info, content-type");
  });

  test("creates a public project, returns photo id/url, and strips customer canaries", async () => {
    const harness = makeHarness();
    const input = { ...baseInput, customer_name: "CUSTOMER CANARY", customer_email: "canary@example.test" };
    const response = await harness.handler(request(validBody(input)));
    expect(response.status).toBe(201);
    const project = (await json(response)).project;
    expect(project.photos[0].url).toBe(png);
    expect(project.photos[0].id).toEqual(expect.any(String));
    expect(project.customer_name).toBeUndefined();
    expect(project.customer_email).toBeUndefined();
    expect(harness.rpcArgs[0].p_input).toEqual(baseInput);
  });

  test("preserves Burmese names when the request stream is split at every UTF-8 byte", async () => {
    const harness = makeHarness();
    const payload = JSON.stringify(validBody(baseInput));
    const bytes = new TextEncoder().encode(payload);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); },
    });
    const response = await harness.handler(new Request("https://edge.example/guest-invitation", {
      method: "POST", headers: { origin, "x-forwarded-for": "203.0.113.5", "content-type": "application/json", "x-invitation-upload-bridge": "gateway-only-secret-for-unit-tests-32" }, body: stream,
    }));
    expect(response.status).toBe(201);
    expect((harness.rpcArgs[0].p_input as any).person_a).toBe("သီဟ");
    expect((harness.rpcArgs[0].p_input as any).person_b).toBe("မေမြတ်");
  });

  test("rejects missing server credentials and disallowed origins", async () => {
    const missingSalt = makeHarness(); missingSalt.env.IP_HASH_SALT = undefined; missingSalt.env.SUPABASE_SERVICE_ROLE_KEY = undefined;
    expect((await missingSalt.handler(request(validBody()))).status).toBe(503);
    const { handler } = makeHarness();
    expect((await handler(request(validBody(), { origin: "https://evil.example" }))).status).toBe(403);
  });

  test("rejects direct public calls with forged forwarding IP before consuming the shared quota", async () => {
    const harness = makeHarness();
    const response = await harness.handler(request(validBody(), { "x-invitation-upload-bridge": "", "x-forwarded-for": "198.51.100.99" }));
    expect(response.status).toBe(403);
    expect(harness.rpcArgs).toHaveLength(0);
  });

  test("production defaults use only the exact public origin and built-in server salt", async () => {
    const harness = makeHarness(); harness.env.ALLOWED_ORIGINS = undefined; harness.env.IP_HASH_SALT = undefined;
    expect((await harness.handler(request(validBody(), { origin: "https://love-birds-mm.vercel.app" }))).status).toBe(201);
    expect((await harness.handler(request(validBody(), { origin: "https://evil.example" }))).status).toBe(403);
  });

  test("rejects zero photos, oversized bodies/photos, invalid magic, and invalid calendar dates", async () => {
    const cases: Array<{ body: unknown; headers?: Record<string, string> }> = [
      { body: validBody(baseInput, []) },
      { body: validBody(), headers: { "content-length": String(4.5 * 1024 * 1024 + 1) } },
      { body: validBody(baseInput, [{ dataUrl: `data:image/png;base64,${btoa("not png")}`, caption: "" }]) },
      { body: validBody({ ...baseInput, event_date: "2027-02-31" }) },
    ];
    for (const item of cases) {
      const { handler } = makeHarness();
      expect((await handler(request(item.body, item.headers))).status).toBe(400);
    }
    const oversizedPhoto = `data:image/png;base64,${bytesToBase64(new Uint8Array(9 * 1024 * 1024 + 1).fill(0))}`;
    const { handler } = makeHarness();
    expect((await handler(request(validBody(baseInput, [{ dataUrl: oversizedPhoto, caption: "" }])))).status).toBe(400);
  });

  test("accepts a guest photo above the former 1 MiB cap", async () => {
    const bytes = new Uint8Array(2 * 1024 * 1024);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dataUrl = `data:image/png;base64,${bytesToBase64(bytes)}`;
    const { handler, rpcArgs } = makeHarness();
    const response = await handler(request(validBody(baseInput, [{ dataUrl, caption: "" }])));
    expect(response.status).toBe(201);
    expect((rpcArgs[0].p_photos as Array<{ url: string }>)[0].url).toBe(dataUrl);
  });

  test("maps rate-limit RPC errors to 429", async () => {
    const harness = makeHarness();
    harness.setRpcResult({ data: null, error: { message: "Rate limit exceeded" } });
    const response = await harness.handler(request(validBody()));
    expect(response.status).toBe(429);
    expect(await json(response)).toEqual({ error: "Rate limit exceeded" });
  });
});
