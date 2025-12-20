import { env } from "@repo/env";
import { spawn } from "node:child_process";

const port = env.WEB_APP_PORT.toString();

const nextStart = spawn("next", ["start", "--port", port], {
  stdio: "inherit",
  shell: true,
});

nextStart.on("error", (error) => {
  console.error("Failed to start Next.js server:", error);
  process.exit(1);
});

nextStart.on("exit", (code) => {
  process.exit(code ?? 0);
});

