import { env } from "@repo/env";
import { spawn } from "node:child_process";

const port = env.LANDING_PORT.toString();

const nextDev = spawn("next", ["dev", "--port", port], {
  stdio: "inherit",
  shell: true,
});

nextDev.on("error", (error) => {
  console.error("Failed to start Next.js dev server:", error);
  process.exit(1);
});

nextDev.on("exit", (code) => {
  process.exit(code ?? 0);
});
