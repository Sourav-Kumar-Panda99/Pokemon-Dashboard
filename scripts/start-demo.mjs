// Runs the production build against the embedded offline demo database.
//   npm run build && npm run start:demo
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "start", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DEMO_MODE: "true" },
});
child.on("exit", (code) => process.exit(code ?? 0));
