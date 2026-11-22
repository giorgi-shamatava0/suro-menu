/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as lib_password from "../lib/password.js";
import type * as loyalty from "../loyalty.js";
import type * as loyaltyRules from "../loyaltyRules.js";
import type * as menu from "../menu.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  crons: typeof crons;
  "lib/password": typeof lib_password;
  loyalty: typeof loyalty;
  loyaltyRules: typeof loyaltyRules;
  menu: typeof menu;
  seed: typeof seed;
  seedData: typeof seedData;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
