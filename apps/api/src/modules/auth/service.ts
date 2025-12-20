import { status } from "elysia";
import { prisma } from "@repo/database";
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
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.password !== password) {
      throw status(400, "Invalid username or password" satisfies signInInvalid);
    }

    // TODO: Implement proper JWT token generation
    const token = "mock-jwt-token-" + Date.now();

    return {
      username: user.username,
      token,
    };
  }

  static async signUp({
    username,
    password,
    email,
  }: signUpBody): Promise<signUpResponse> {
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw status(409, "Username already exists" satisfies signUpConflict);
    }

    // TODO: Hash password before storing (use bcrypt or similar)
    const user = await prisma.user.create({
      data: {
        username,
        password, // In production, hash this password
        email: email ?? null,
      },
    });

    // TODO: Implement proper JWT token generation
    const token = "mock-jwt-token-" + Date.now();

    return {
      username: user.username,
      token,
    };
  }
}
