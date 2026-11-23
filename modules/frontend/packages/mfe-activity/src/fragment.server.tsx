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
    appName: "mfe-activity",
    basePath: "/api/fragments",
    fragments: {
      activity: { Component: Root, clientScript, integrity, styles, getProps: () => ({}) },
    },
    onError: (error) => console.error("[mfe-activity] render error", error),
  });
}
