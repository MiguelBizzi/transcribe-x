import { app } from "./app";
import { env } from "@repo/env";

app.listen({
  port: env.API_PORT,
});

console.log(`🚀 API server is running at the port ${env.API_PORT}`);
