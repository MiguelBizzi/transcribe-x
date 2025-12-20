import { Elysia } from "elysia";
import { env } from "@repo/env";
import { Auth } from "./service";
import { AuthModel } from "./model";

export const auth = new Elysia({ prefix: "/auth" })
  .post(
    "/sign-in",
    async ({ body, cookie }) => {
      const response = await Auth.signIn(body);

      if (cookie.session) {
        cookie.session.value = response.token;
        cookie.session.httpOnly = true;
        cookie.session.secure = env.NODE_ENV === "production";
        cookie.session.sameSite = "lax";
      }

      return response;
    },
    {
      body: AuthModel.signInBody,
      response: {
        200: AuthModel.signInResponse,
        400: AuthModel.signInInvalid,
      },
    }
  )
  .post(
    "/sign-up",
    async ({ body, cookie }) => {
      const response = await Auth.signUp(body);

      if (cookie.session) {
        cookie.session.value = response.token;
        cookie.session.httpOnly = true;
        cookie.session.secure = env.NODE_ENV === "production";
        cookie.session.sameSite = "lax";
      }

      return response;
    },
    {
      body: AuthModel.signUpBody,
      response: {
        200: AuthModel.signUpResponse,
        409: AuthModel.signUpConflict,
      },
    }
  )
  .post("/sign-out", ({ cookie }) => {
    if (cookie.session) {
      cookie.session.remove();
    }
    return { message: "Signed out successfully" };
  });
