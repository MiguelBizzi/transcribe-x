import { z } from "zod";
import { config } from "dotenv";
import { resolve, parse } from "node:path";
import { existsSync } from "node:fs";

if (typeof window !== "undefined") {
  throw new Error(
    "@repo/env cannot be imported in client-side code. Use server-only environment variables."
  );
}

function findEnvFile(startDir: string): string {
  let currentDir = startDir;
  const root = parse(currentDir).root;

  while (currentDir !== root) {
    const envPath = resolve(currentDir, ".env");
    if (existsSync(envPath)) {
      return envPath;
    }
    currentDir = resolve(currentDir, "..");
  }

  return resolve(startDir, ".env");
}

const envPath = findEnvFile(process.cwd());
config({ path: envPath });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  API_PORT: z
    .string()
    .default("3001")
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive()),
  WEB_APP_PORT: z
    .string()
    .default("3000")
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive()),
});

function getEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables. Check your .env file.");
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = getEnv();

export type Env = z.infer<typeof envSchema>;
