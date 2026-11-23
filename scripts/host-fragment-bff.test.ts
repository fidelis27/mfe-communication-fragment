// @vitest-environment node
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFragmentBff,
  providersFromEnv,
} from "../modules/frontend/packages/host/server/fragment-bff.mjs";

const providers = { student: "https://student.example.com", admin: "https://admin.example.com" };

function providerResponse(overrides: Record<string, string> = {}) {
  return new Response("<div data-fragment-root>hi</div>", {
    headers: {
      "x-fragment-contract": "1",
      "x-fragment-id": "abc",
      "x-fragment-app": "mfe-student",
      "x-fragment-script": "/api/fragments/assets/student.client.js",
      "x-fragment-integrity": "sha384-xyz",
      ...overrides,
    },
  });
}

async function call(url: string, method = "GET") {
  let body = "";
  const res = {
    statusCode: 200,
    setHeader: () => undefined,
    end: (chunk?: string) => {
      body = chunk ?? "";
    },
  } as unknown as ServerResponse;
  const next = vi.fn();
  await createFragmentBff({ providers })({ method, url } as IncomingMessage, res, next);
  return { status: res.statusCode, body: body ? JSON.parse(body) : null, next };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("host fragment server", () => {
  it("returns fragment metadata and html fetched from the configured provider", async () => {
    const fetchMock = vi.fn((_url: URL) =>
      Promise.resolve(
        providerResponse({ "x-fragment-styles": "/api/fragments/assets/student.css" }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { status, body } = await call("/api/fragments/student");

    expect(status).toBe(200);
    expect(body.html).toBe("<div data-fragment-root>hi</div>");
    expect(body.fragment).toEqual({
      id: "abc",
      name: "student",
      appName: "mfe-student",
      script: "https://student.example.com/api/fragments/assets/student.client.js",
      integrity: "sha384-xyz",
      styles: "https://student.example.com/api/fragments/assets/student.css",
    });
    // Styles travel as a URL the Consumer links; the BFF does not fetch them.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://student.example.com/api/fragments/student",
    );
  });

  it("omits styles when the provider declares none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(providerResponse())),
    );

    const { body } = await call("/api/fragments/student");

    expect(body.fragment).not.toHaveProperty("styles");
  });

  it("does not contact anything for an unknown module", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await call("/api/fragments/evil")).status).toBe(404);
    expect((await call("/api/fragments/__proto__")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a provider script outside the allowlist", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(providerResponse({ "x-fragment-script": "https://evil.example.com/x.js" })),
      ),
    );

    expect((await call("/api/fragments/student")).status).toBe(502);
  });

  it("answers 502 when the provider fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("no", { status: 500 }))),
    );

    expect((await call("/api/fragments/admin")).status).toBe(502);
  });

  it("only answers GET and passes other paths on", async () => {
    expect((await call("/api/fragments/student", "POST")).status).toBe(405);
    expect((await call("/other")).next).toHaveBeenCalled();
  });

  it("reads provider origins from the Host environment", () => {
    expect(providersFromEnv({ VITE_MFE_ADMIN_URL: "https://a.test" }).admin).toBe("https://a.test");
    expect(providersFromEnv({}).student).toBe("http://localhost:4173");
  });
});
