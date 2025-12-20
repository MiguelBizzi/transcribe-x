import { app } from "./app";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || "0.0.0.0";

app.listen({
  port: PORT,
  hostname: HOST,
});

console.log(`🚀 API server is running at http://${HOST}:${PORT}`);
