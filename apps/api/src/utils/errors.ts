import { status } from "elysia";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createError(
  statusCode: number,
  message: string,
  details?: unknown
) {
  const response: { error: string; details?: unknown } = {
    error: message,
  };
  if (details) {
    response.details = details;
  }
  return status(statusCode, response);
}

export const HttpStatus = {
  badRequest: (message: string, details?: unknown) =>
    createError(400, message, details),
  unauthorized: (message: string = "Unauthorized", details?: unknown) =>
    createError(401, message, details),
  forbidden: (message: string = "Forbidden", details?: unknown) =>
    createError(403, message, details),
  notFound: (message: string = "Not Found", details?: unknown) =>
    createError(404, message, details),
  conflict: (message: string, details?: unknown) =>
    createError(409, message, details),
  internalServerError: (
    message: string = "Internal Server Error",
    details?: unknown
  ) => createError(500, message, details),
} as const;
