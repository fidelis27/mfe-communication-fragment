import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { vi } from "vitest";

expect.extend(toHaveNoViolations);

const authMocks = vi.hoisted(() => ({
  initializeAuth: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  subscribeToAuthState: vi.fn(),
  captureHostError: vi.fn(),
  useDispatch: vi.fn(() => vi.fn()),
  useDomainEvents: vi.fn(() => ({ events: [], connection: "connected" })),
  useListen: vi.fn(),
}));

vi.mock("@mfe/shared", () => authMocks);
vi.mock("@lib-core-mfe/fragment-frontend/consumer", async () => {
  const React = await import("react");
  const { default: RemoteAppMock } = await import("./__mocks__/RemoteAppMock");

  function FragmentSlotMock({ onReady }: { onReady?: () => void }) {
    React.useEffect(() => onReady?.(), [onReady]);
    return React.createElement(RemoteAppMock);
  }

  return { FragmentSlot: FragmentSlotMock };
});

const fragmentResponse = () =>
  new Response(
    JSON.stringify({
      fragment: {
        id: "fragment-1",
        name: "student",
        appName: "mfe-student",
        script: "http://localhost:4173/api/fragments/assets/student.client.js",
      },
      html: "<div data-fragment-root></div>",
    }),
  );

async function renderHost() {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(fragmentResponse())),
  );
  vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-key");
  window.history.pushState({}, "", "/admin");
  authMocks.initializeAuth.mockResolvedValue(true);
  authMocks.subscribeToAuthState.mockReturnValue(() => {});

  const { default: App } = await import("./App");
  return render(<App />);
}

describe("Host accessibility", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("has no detectable axe violations in the authenticated shell", async () => {
    const { container } = await renderHost();

    await waitFor(() => expect(screen.getByTestId("remote-mock")).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
  });
});
