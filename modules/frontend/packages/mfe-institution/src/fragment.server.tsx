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
    appName: "mfe-institution",
    basePath: "/api/fragments",
    fragments: {
      institution: { Component: Root, clientScript, integrity, styles, getProps: () => ({}) },
    },
    onError: (error) => console.error("[mfe-institution] render error", error),
  });
}
