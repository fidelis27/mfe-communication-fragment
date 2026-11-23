import { FragmentSlot } from "@lib-core-mfe/fragment-frontend/consumer";
import type { FragmentInfo } from "@lib-core-mfe/fragment-frontend/shared";
import { captureHostError } from "@mfe/shared";
import { useEffect, useState } from "react";
import { markRemoteReady } from "../../../remoteLoadingMetrics";
import type { ModuleId, ActiveModule } from "../../navigation/modules";
import { RemoteSkeleton } from "./RemoteSkeleton";

const moduleHosts: Record<ModuleId, string> = {
  student: import.meta.env.VITE_MFE_STUDENT_URL ?? "http://localhost:4173",
  institution: import.meta.env.VITE_MFE_INSTITUTION_URL ?? "http://localhost:4175",
  activity: import.meta.env.VITE_MFE_ACTIVITY_URL ?? "http://localhost:4176",
  dashboard: import.meta.env.VITE_MFE_DASHBOARD_URL ?? "http://localhost:4178",
  admin: import.meta.env.VITE_MFE_ADMIN_URL ?? "http://localhost:4179",
};

const moduleLabels: Record<ModuleId, string> = {
  student: "estudantes",
  institution: "instituições",
  activity: "atividade",
  dashboard: "dashboard",
  admin: "administração",
};

type FragmentState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; fragment: FragmentInfo; html: string };

/** Asks the Host server for the Provider's rendered fragment (server to server). */
function useFragment(name: ModuleId, attempt: number): FragmentState {
  const [state, setState] = useState<FragmentState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/fragments/${name}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Fragment request for "${name}" answered ${response.status}`);
        return response.json() as Promise<{ fragment: FragmentInfo; html: string }>;
      })
      .then(({ fragment, html }) => setState({ status: "ready", fragment, html }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        captureHostError(error, { moduleName: name });
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [name, attempt]);

  return state;
}

function RemoteModule({ name }: { name: ModuleId }) {
  const label = moduleLabels[name];
  const [attempt, setAttempt] = useState(0);
  const state = useFragment(name, attempt);

  if (state.status === "loading") return <RemoteSkeleton label={`Carregando ${label}`} />;
  if (state.status === "error") {
    return (
      <section className="remote-state">
        <p className="eyebrow">Falha no carregamento</p>
        <h1>Módulo de {label} indisponível</h1>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <FragmentSlot
      fragment={state.fragment}
      html={state.html}
      allowedHosts={[moduleHosts[name]]}
      onReady={() => markRemoteReady(name)}
      onError={(error) => captureHostError(error, { moduleName: name })}
    />
  );
}

export function RemoteContent({
  activeModule,
  moduleLabel,
}: {
  activeModule: ActiveModule;
  moduleLabel: (moduleId: string) => string;
}) {
  switch (activeModule) {
    case "student":
    case "institution":
    case "activity":
    case "dashboard":
    case "admin":
      return <RemoteModule name={activeModule} />;
    default:
      return (
        <section className="remote-state">
          <p className="eyebrow">Módulo em preparação</p>
          <h1>{moduleLabel(activeModule)}</h1>
          <p>A estrutura está pronta para receber o próximo remote.</p>
        </section>
      );
  }
}
