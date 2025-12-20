import { Elysia, t } from "elysia";
import { User } from "./service";
import { UserModel } from "./model";

export const user = new Elysia({ prefix: "/user" })
  .get(
    "/profile",
    async ({ query }) => {
      const userId = query.userId || "current-user";
      return await User.getProfile(userId);
    },
    {
      query: t.Object({
        userId: t.Optional(t.String()),
      }),
      response: {
        200: UserModel.userProfile,
        404: UserModel.userNotFound,
      },
    }
  )
  .get(
    "/:id",
    async ({ params }) => {
      return await User.getById(params.id);
    },
    {
      params: UserModel.getUserParams,
      response: {
        200: UserModel.userProfile,
        404: UserModel.userNotFound,
      },
    }
  )
  .patch(
    "/:id",
    async ({ params, body }) => {
      return await User.update(params.id, body);
    },
    {
      params: UserModel.getUserParams,
      body: UserModel.updateUserBody,
      response: {
        200: UserModel.updateUserResponse,
        404: UserModel.userNotFound,
      },
    }
  );
