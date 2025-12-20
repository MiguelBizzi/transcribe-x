import { status } from "elysia";
import type {
  signInBody,
  signInResponse,
  signInInvalid,
  signUpBody,
  signUpResponse,
  signUpConflict,
} from "./model";

export abstract class Auth {
  static async signIn({
    username,
    password,
  }: signInBody): Promise<signInResponse> {
    if (username === "admin" && password === "password123") {
      return {
        username,
        token: "mock-jwt-token-" + Date.now(),
      };
    }

    throw status(400, "Invalid username or password" satisfies signInInvalid);
  }

  static async signUp({ username }: signUpBody): Promise<signUpResponse> {
    if (username === "existing") {
      throw status(409, "Username already exists" satisfies signUpConflict);
    }

    return {
      username,
      token: "mock-jwt-token-" + Date.now(),
    };
  }
}
