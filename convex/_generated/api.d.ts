/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as audit from "../audit.js";
import type * as categories from "../categories.js";
import type * as files from "../files.js";
import type * as items from "../items.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_lifecycle from "../lib/lifecycle.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_members from "../lib/members.js";
import type * as lib_mutations from "../lib/mutations.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_validators from "../lib/validators.js";
import type * as memberships from "../memberships.js";
import type * as notifications from "../notifications.js";
import type * as roles from "../roles.js";
import type * as supportGrants from "../supportGrants.js";
import type * as transactions from "../transactions.js";
import type * as units from "../units.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  audit: typeof audit;
  categories: typeof categories;
  files: typeof files;
  items: typeof items;
  "lib/audit": typeof lib_audit;
  "lib/authz": typeof lib_authz;
  "lib/errors": typeof lib_errors;
  "lib/lifecycle": typeof lib_lifecycle;
  "lib/logger": typeof lib_logger;
  "lib/members": typeof lib_members;
  "lib/mutations": typeof lib_mutations;
  "lib/permissions": typeof lib_permissions;
  "lib/validators": typeof lib_validators;
  memberships: typeof memberships;
  notifications: typeof notifications;
  roles: typeof roles;
  supportGrants: typeof supportGrants;
  transactions: typeof transactions;
  units: typeof units;
  users: typeof users;
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
