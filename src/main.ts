import "./style.css";
import { ChibiDockWidget } from "./core/Widget";
import sampleManifest from "./registry/sample-manifest.json";
import type { ModelManifest } from "./core/types";

const manifest = sampleManifest as ModelManifest;
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

const root = app;

root.innerHTML = `
  <section class="demo-shell">
    <header class="demo-header">
      <p class="demo-kicker">Ark-waifu MVP</p>
      <h1>Lightweight Spine widget demo</h1>
      <p class="demo-copy">
        The sample manifest points to /models/sample/. Add local Spine 3.8 assets there or update
        the manifest to test a real Ark-Models export.
      </p>
    </header>
    <div class="demo-panel" aria-label="Animation controls">
      ${Object.keys(manifest.actions)
        .map((action) => `<button type="button" data-action="${action}">${action}</button>`)
        .join("")}
    </div>
  </section>
`;

async function bootstrap(): Promise<void> {
  const widget = new ChibiDockWidget();
  await widget.load(manifest);

  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action) {
        widget.play(action);
      }
    });
  });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  root.insertAdjacentHTML(
    "beforeend",
    `<p class="demo-error">Failed to initialize Ark-waifu: ${message}</p>`
  );
  console.error("[Ark-waifu] Demo bootstrap failed", error);
});
