import { status } from "elysia";
import { prisma } from "@repo/database";
import type {
  userProfile,
  userNotFound,
  updateUserBody,
  updateUserResponse,
} from "./model";

export abstract class User {
  static async getProfile(userId: string): Promise<userProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw status(404, "User not found" satisfies userNotFound);
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email ?? undefined,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static async getById(id: string): Promise<userProfile> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw status(404, "User not found" satisfies userNotFound);
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email ?? undefined,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static async update(
    id: string,
    data: updateUserBody
  ): Promise<updateUserResponse> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw status(404, "User not found" satisfies userNotFound);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        email: data.email ?? null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        updatedAt: true,
      },
    });

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email ?? undefined,
      updatedAt: updatedUser.updatedAt.toISOString(),
    };
  }
}
