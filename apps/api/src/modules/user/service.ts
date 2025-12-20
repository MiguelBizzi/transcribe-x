import { status } from "elysia";
import type {
  userProfile,
  userNotFound,
  updateUserBody,
  updateUserResponse,
} from "./model";

export abstract class User {
  static async getProfile(userId: string): Promise<userProfile> {
    if (userId === "not-found") {
      throw status(404, "User not found" satisfies userNotFound);
    }

    return {
      id: userId,
      username: "example_user",
      email: "user@example.com",
      createdAt: new Date().toISOString(),
    };
  }

  static async getById(id: string): Promise<userProfile> {
    if (id === "not-found") {
      throw status(404, "User not found" satisfies userNotFound);
    }

    return {
      id,
      username: "example_user",
      email: "user@example.com",
      createdAt: new Date().toISOString(),
    };
  }

  static async update(
    id: string,
    data: updateUserBody
  ): Promise<updateUserResponse> {
    if (id === "not-found") {
      throw status(404, "User not found" satisfies userNotFound);
    }

    return {
      id,
      username: "example_user",
      email: data.email,
      updatedAt: new Date().toISOString(),
    };
  }
}
