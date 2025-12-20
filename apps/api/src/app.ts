import { Elysia } from "elysia";

import { auth } from "./modules/auth";
import { user } from "./modules/user";

export const app = new Elysia()
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation Error",
        details: error instanceof Error ? error.message : String(error),
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Not Found",
        message: "The requested resource was not found",
      };
    }

    set.status = 500;
    return {
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : String(error),
    };
  })
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .use(auth)
  .use(user);
