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
    appName: "mfe-student",
    basePath: "/api/fragments",
    fragments: {
      student: { Component: Root, clientScript, integrity, styles, getProps: () => ({}) },
    },
    onError: (error) => console.error("[mfe-student] render error", error),
  });
}
