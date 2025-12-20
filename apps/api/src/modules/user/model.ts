import { t } from "elysia";

export const userProfile = t.Object({
  id: t.String(),
  username: t.String(),
  email: t.Optional(t.String()),
  createdAt: t.String(),
});

export type userProfile = typeof userProfile.static;

export const getUserParams = t.Object({
  id: t.String(),
});

export type getUserParams = typeof getUserParams.static;

export const userNotFound = t.Literal("User not found");
export type userNotFound = typeof userNotFound.static;

export const updateUserBody = t.Object({
  email: t.Optional(t.String({ format: "email" })),
});

export type updateUserBody = typeof updateUserBody.static;

export const updateUserResponse = t.Object({
  id: t.String(),
  username: t.String(),
  email: t.Optional(t.String()),
  updatedAt: t.String(),
});

export type updateUserResponse = typeof updateUserResponse.static;

export const UserModel = {
  userProfile,
  getUserParams,
  userNotFound,
  updateUserBody,
  updateUserResponse,
} as const;
