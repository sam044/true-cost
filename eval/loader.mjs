// Node resolve hook so `npm run eval` can load the app's TypeScript in lib/
// without a bundler: maps "@/x" to the repo root, adds the ".ts" extension that
// the app's imports leave out, and stubs "server-only" (it only guards against
// client bundles, which the eval isn't).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export {}", shortCircuit: true };
  }
  let url;
  if (specifier.startsWith("@/")) url = new URL(specifier.slice(2), root);
  else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))
    url = new URL(specifier, context.parentURL);
  if (url) {
    const file = fileURLToPath(url);
    for (const candidate of [file, `${file}.ts`, `${file}/index.ts`]) {
      if (/\.[cm]?[jt]sx?$/.test(candidate) && existsSync(candidate)) {
        return next(pathToFileURL(candidate).href, context);
      }
    }
  }
  return next(specifier, context);
}
