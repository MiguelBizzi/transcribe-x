import { t } from "elysia";

export const signInBody = t.Object({
  username: t.String({ minLength: 3, maxLength: 50 }),
  password: t.String({ minLength: 8 }),
});

export type signInBody = typeof signInBody.static;

export const signInResponse = t.Object({
  username: t.String(),
  token: t.String(),
});

export type signInResponse = typeof signInResponse.static;

export const signInInvalid = t.Literal("Invalid username or password");
export type signInInvalid = typeof signInInvalid.static;

export const signUpBody = t.Object({
  username: t.String({ minLength: 3, maxLength: 50 }),
  password: t.String({ minLength: 8 }),
  email: t.Optional(t.String({ format: "email" })),
});

export type signUpBody = typeof signUpBody.static;

export const signUpResponse = t.Object({
  username: t.String(),
  token: t.String(),
});

export type signUpResponse = typeof signUpResponse.static;

export const signUpConflict = t.Literal("Username already exists");
export type signUpConflict = typeof signUpConflict.static;

export const AuthModel = {
  signInBody,
  signInResponse,
  signInInvalid,
  signUpBody,
  signUpResponse,
  signUpConflict,
} as const;
