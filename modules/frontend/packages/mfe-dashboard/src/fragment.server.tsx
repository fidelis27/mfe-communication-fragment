import { createFragmentHandler } from "@lib-core-mfe/fragment-frontend/server";
import Root from "./Root";

export function createFragmentProvider({
  clientScript,
  integrity,
  styles,
}: {
  clientScript: string;
  integrity?: string;
  styles?: string;
}) {
  return createFragmentHandler({
    appName: "mfe-dashboard",
    basePath: "/api/fragments",
    fragments: {
      dashboard: { Component: Root, clientScript, integrity, styles, getProps: () => ({}) },
    },
    onError: (error) => console.error("[mfe-dashboard] render error", error),
  });
}
