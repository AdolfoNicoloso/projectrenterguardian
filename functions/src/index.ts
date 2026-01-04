/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at
 * https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

// Secrets must exist in Google Secret Manager with these exact names:
const DIRECTUS_URL = defineSecret("DIRECTUS_URL");
const DIRECTUS_SERVICE_TOKEN = defineSecret("DIRECTUS_SERVICE_TOKEN");

// Initialize Admin SDK once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Extracts the bearer token from the Authorization header.
 * @param {string} authHeader The Authorization header value.
 * @return {string | null} The token if found, null otherwise.
 */
function extractBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

/**
 * Gets the bearer token from the request Authorization header.
 * @param {unknown} req Express request object.
 * @return {string | null} The token if found, null otherwise.
 */
function getBearerToken(req: unknown): string | null {
  const reqTyped = req as {get: (name: string) => string | undefined};
  const authHeader =
    reqTyped.get("Authorization") || reqTyped.get("authorization") || "";
  return extractBearerToken(authHeader);
}

/**
 * Verifies Firebase ID token and returns decoded token.
 * @param {unknown} req Express request object.
 * @return {Promise<admin.auth.DecodedIdToken>} The decoded Firebase token.
 * @throws {Error} If token is missing or invalid.
 */
async function verifyFirebaseUser(
  req: unknown
): Promise<admin.auth.DecodedIdToken> {
  const idToken = getBearerToken(req);
  if (!idToken) {
    throw new Error(
      "Missing Authorization header. Expected: Bearer <Firebase ID token>"
    );
  }
  return await admin.auth().verifyIdToken(idToken);
}

/**
 * Safely extracts error message from unknown error object.
 * @param {unknown} err The error object.
 * @return {string} A string representation of the error message.
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Sets CORS headers on the response.
 * @param {unknown} res Express response object.
 * @param {unknown} req Express request object.
 */
function setCorsHeaders(res: unknown, req: unknown): void {
  // Type assertion needed for Express request/response
  const reqTyped = req as {get: (name: string) => string | undefined};
  const resTyped = res as {
    set: (name: string, value: string) => void;
  };
  const origin = reqTyped.get("origin") || reqTyped.get("Origin") || "*";
  resTyped.set("Access-Control-Allow-Origin", origin);
  resTyped.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  resTyped.set("Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With");
  resTyped.set("Access-Control-Max-Age", "3600");
}

/**
 * Handles CORS preflight (OPTIONS) requests.
 * @param {unknown} req Express request object.
 * @param {unknown} res Express response object.
 * @return {boolean} True if request was handled, false otherwise.
 */
function handleCorsPreflight(req: unknown, res: unknown): boolean {
  const reqTyped = req as {method?: string};
  const resTyped = res as {
    status: (code: number) => {send: (body: string) => void};
  };
  if (reqTyped.method === "OPTIONS") {
    setCorsHeaders(res, req);
    resTyped.status(204).send("");
    return true;
  }
  return false;
}

/**
 * Returns a 1x1 transparent PNG image.
 * Used for error responses in getFile so Image components don't fail.
 * @return {Buffer} A transparent PNG image buffer.
 */
function getTransparentPng(): Buffer {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGA" +
    "WjR9awAAAABJRU5ErkJggg==";
  return Buffer.from(pngBase64, "base64");
}

/**
 * Sends an error response as a transparent PNG image.
 * This prevents Image components from failing when errors occur.
 * @param {unknown} res Express response object.
 * @param {unknown} req Express request object.
 * @param {number} statusCode HTTP status code.
 */
function sendImageError(
  res: unknown,
  req: unknown,
  statusCode: number
): void {
  setCorsHeaders(res, req);
  const resTyped = res as {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => {send: (body: Buffer) => void};
  };
  resTyped.setHeader("Content-Type", "image/png");
  resTyped.setHeader("Cache-Control", "no-cache");
  resTyped.status(statusCode).send(getTransparentPng());
}

/**
 * Directus API response wrapper type.
 */
interface DirectusResponse<T> {
  data?: T | T[];
}

/**
 * Makes an authenticated request to Directus using the service token.
 * @param {string} path The Directus API path (e.g., "/items/properties").
 * @param {object} options Request options (method, body).
 * @return {Promise<unknown>} The JSON response from Directus.
 */
async function directusRequest(
  path: string,
  options: {method?: string; body?: object} = {}
): Promise<unknown> {
  const directusUrl =
    (DIRECTUS_URL.value() || "").replace(/\/+$/, "");
  const directusToken = DIRECTUS_SERVICE_TOKEN.value() || "";

  if (!directusUrl) {
    throw new Error("DIRECTUS_URL secret is empty.");
  }
  if (!directusToken) {
    throw new Error("DIRECTUS_SERVICE_TOKEN secret is empty.");
  }

  const url = `${directusUrl}${path}`;
  const method = options.method || "GET";
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${directusToken}`,
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (options.body && method !== "GET") {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let errorMessage = `Directus request failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.errors && Array.isArray(errorJson.errors)) {
        errorMessage += ` - ${JSON.stringify(errorJson.errors)}`;
      } else {
        errorMessage += ` - ${errorText}`;
      }
    } catch {
      errorMessage += ` - ${errorText}`;
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const text = await response.text();
    if (!text || text.trim() === "") {
      return null;
    }
    return JSON.parse(text);
  }

  return null;
}

/**
 * Gets or creates an app_profile for a Firebase user.
 * @param {object} params User information from Firebase token.
 * @param {string} params.uid Firebase user UID.
 * @param {string | null} params.email User email address.
 * @param {string | null} params.name User display name.
 * @return {Promise<string>} The app_profile ID.
 */
async function getOrCreateAppProfile(params: {
  uid: string;
  email: string | null;
  name: string | null;
}): Promise<string> {
  // Query for existing app_profile by firebase_uid
  // URL encode the UID to handle special characters
  const encodedUid = encodeURIComponent(params.uid);
  const existingProfiles = await directusRequest(
    `/items/app_profiles?filter[firebase_uid][_eq]=${encodedUid}`
  ) as DirectusResponse<{id: string}>;

  if (existingProfiles?.data) {
    const dataArray = Array.isArray(existingProfiles.data) ?
      existingProfiles.data : [existingProfiles.data];
    if (dataArray.length > 0) {
      return dataArray[0].id;
    }
  }

  // Create new app_profile
  // Note: Directus field is "name", not "display_name" (per SQL schema)
  // Don't use email as fallback for name - let onboarding flow prompt user
  console.log("[getOrCreateAppProfile] Creating profile with:", {
    uid: params.uid,
    email: params.email,
    name: params.name,
  });
  const newProfile = await directusRequest("/items/app_profiles", {
    method: "POST",
    body: {
      firebase_uid: params.uid,
      email: params.email || "",
      // Don't use email as fallback - let onboarding handle it
      name: params.name || null,
    },
  }) as DirectusResponse<{id: string}>;

  if (!newProfile?.data) {
    throw new Error("Failed to create app_profile");
  }

  const profileData = Array.isArray(newProfile.data) ?
    newProfile.data[0] : newProfile.data;

  if (!profileData?.id) {
    throw new Error("Failed to create app_profile");
  }

  return profileData.id;
}

/**
 * Smoke test:
 * - Requires Authorization: Bearer <Firebase ID token>
 * - Reads DIRECTUS_URL + DIRECTUS_SERVICE_TOKEN from Secret Manager
 * - Calls Directus /server/ping with the Directus service token
 */
export const smokeTest = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      // 1) Verify Firebase ID token
      const authHeader = req.get("Authorization") || "";
      const idToken = extractBearerToken(authHeader);
      if (!idToken) {
        res.status(401).json({
          error: "Missing Authorization header. " +
            "Expected: Bearer <Firebase ID token>",
        });
        return;
      }

      const decoded = await admin.auth().verifyIdToken(idToken);

      // 2) Read secrets
      const directusUrl =
        (DIRECTUS_URL.value() || "").replace(/\/+$/, "");
      const directusToken = DIRECTUS_SERVICE_TOKEN.value() || "";

      if (!directusUrl) {
        res.status(500).json({error: "DIRECTUS_URL secret is empty."});
        return;
      }
      if (!directusToken) {
        res.status(500).json(
          {error: "DIRECTUS_SERVICE_TOKEN secret is empty."});
        return;
      }

      // 3) Call Directus (server-to-server)
      // Directus supports /server/ping (returns "pong" or similar).
      const pingUrl = `${directusUrl}/server/ping`;

      const pingResp = await fetch(pingUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${directusToken}`,
        },
      });

      const pingText = await pingResp.text();

      // 4) Return success payload
      const signInProvider =
        decoded.firebase?.sign_in_provider ?? null;
      res.status(200).json({
        ok: true,
        firebase: {
          uid: decoded.uid,
          email: decoded.email ?? null,
          provider: signInProvider,
        },
        directus: {
          url: directusUrl,
          pingUrl,
          status: pingResp.status,
          responseText: pingText,
        },
      });
    } catch (err: unknown) {
      // Common failures: missing secret access, bad ID token, etc
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Bootstrap profile:
 * - Verifies Firebase ID token
 * - Gets or creates app_profile in Directus
 * - Returns app_profile_id
 */
export const bootstrapProfile = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST" && req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json(
          {error: "Method not allowed. Use POST or GET."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      // Firebase token may have name or displayName depending on provider
      const tokenName = (decoded as {name?: string}).name;
      const tokenDisplayName = (decoded as {displayName?: string}).displayName;
      console.log("[bootstrapProfile] Token name fields:", {
        name: tokenName,
        displayName: tokenDisplayName,
        email: decoded.email,
      });
      const displayName = tokenName || tokenDisplayName || null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      setCorsHeaders(res, req);
      res.status(200).json({app_profile_id: appProfileId});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get my properties:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Queries Directus for properties filtered by app_profile
 * - Returns properties list
 */
export const getMyProperties = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      // Firebase token may have name or displayName depending on provider
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Query properties filtered by app_profile
      const propertiesResponse = await directusRequest(
        `/items/properties?filter[app_profile][_eq]=${appProfileId}`
      ) as DirectusResponse<unknown>;

      const properties = propertiesResponse?.data ?
        (Array.isArray(propertiesResponse.data) ?
          propertiesResponse.data : [propertiesResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: properties});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get a single property by ID:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Queries Directus for property filtered by ID and app_profile
 * - Returns property only if it belongs to the user
 */
export const getProperty = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get property ID from query params
      const reqTyped = req as {query: {id?: string}};
      const propertyId = reqTyped.query?.id;
      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing property ID in query params."});
        return;
      }

      // 3) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 4) Query property filtered by ID and app_profile (ownership check)
      const encodedId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const filterPath =
        `/items/properties?filter[id][_eq]=${encodedId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertiesResponse = await directusRequest(
        filterPath
      ) as DirectusResponse<unknown>;

      const properties = propertiesResponse?.data ?
        (Array.isArray(propertiesResponse.data) ?
          propertiesResponse.data : [propertiesResponse.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: properties[0]});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Update a property:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Accepts property updates from client
 * - Updates property in Directus
 * - Returns updated property
 */
export const updateProperty = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "PATCH") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use PATCH."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        id?: string;
        nickname?: string;
        address_free_text?: string;
        lease_start_date?: string;
        lease_end_date?: string;
        state_code?: string;
        status?: string;
        street?: string;
        unit?: string;
        city?: string;
        zip?: number;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      // 4) Validate required fields
      if (!input.id) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required field: id",
        });
        return;
      }

      // 5) Verify property ownership
      const encodedId = encodeURIComponent(input.id);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 6) Build update data (only include fields that are provided)
      const updateData: Record<string, unknown> = {};
      if (input.nickname !== undefined) {
        updateData.nickname = input.nickname || null;
      }
      if (input.address_free_text !== undefined) {
        updateData.address_free_text = input.address_free_text;
      }
      if (input.lease_start_date !== undefined) {
        updateData.lease_start_date = input.lease_start_date;
      }
      if (input.lease_end_date !== undefined) {
        updateData.lease_end_date = input.lease_end_date || null;
      }
      if (input.state_code !== undefined) {
        updateData.state_code = input.state_code || null;
      }
      if (input.status !== undefined) {
        updateData.status = input.status;
      }
      if (input.street !== undefined) {
        updateData.street = input.street || null;
      }
      if (input.unit !== undefined) {
        updateData.unit = input.unit || null;
      }
      if (input.city !== undefined) {
        updateData.city = input.city || null;
      }
      if (input.zip !== undefined) {
        updateData.zip = input.zip || null;
      }

      // 7) Update property in Directus
      console.log("[updateProperty] Updating property via /items/properties", {
        endpoint: `/items/properties/${encodedId}`,
        method: "PATCH",
        updateData,
      });

      const propertyResponse = await directusRequest(
        `/items/properties/${encodedId}`,
        {
          method: "PATCH",
          body: updateData,
        }
      ) as DirectusResponse<unknown>;

      if (!propertyResponse?.data) {
        console.error("[updateProperty] Failed: No data in response", {
          response: propertyResponse,
        });
        setCorsHeaders(res, req);
        res.status(500).json({
          error: "Failed to update property in Directus.",
        });
        return;
      }

      const updatedProperty = Array.isArray(propertyResponse.data) ?
        propertyResponse.data[0] : propertyResponse.data;

      console.log("[updateProperty] Property updated successfully:", {
        propertyId: (updatedProperty as {id?: string})?.id,
        property: updatedProperty,
      });

      setCorsHeaders(res, req);
      res.status(200).json({data: updatedProperty});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Delete a property:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Deletes property from Directus
 * - Returns success response
 */
export const deleteProperty = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "DELETE") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use DELETE."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {propertyId?: string; id?: string};
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      // Support both propertyId and id for backward compatibility
      const propertyId = input.propertyId || input.id;
      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required field: propertyId",
        });
        return;
      }

      // Log deletion attempt
      console.log("[deleteProperty] Deletion request:", {
        propertyId,
        userId: decoded.uid,
        appProfileId,
      });

      const encodedId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyOwnershipCheckPath =
        `/items/properties?filter[id][_eq]=${encodedId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyOwnershipCheck = await directusRequest(
        propertyOwnershipCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyOwnershipCheck?.data ?
        (Array.isArray(propertyOwnershipCheck.data) ?
          propertyOwnershipCheck.data : [propertyOwnershipCheck.data]) : [];

      if (properties.length === 0) {
        console.log("[deleteProperty] Access denied:", {
          propertyId,
          userId: decoded.uid,
          reason: "Property not found or does not belong to user",
        });
        setCorsHeaders(res, req);
        res.status(403).json({
          error: "Access denied: Property not found or " +
            "does not belong to user.",
        });
        return;
      }

      // Delete only the property record - Directus Flow handles cascade deletes
      console.log("[deleteProperty] Deleting property via Directus:", {
        propertyId,
        endpoint: `/items/properties/${encodedId}`,
      });

      const deleteResponse = await directusRequest(
        `/items/properties/${encodedId}`,
        {
          method: "DELETE",
        }
      );

      // Log Directus response (may be null for successful DELETE)
      console.log("[deleteProperty] Directus DELETE response:", {
        propertyId,
        userId: decoded.uid,
        directusResponse: deleteResponse,
        status: "success",
      });

      setCorsHeaders(res, req);
      res.status(200).json({
        ok: true,
        message: "Property deleted successfully",
      });
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get spaces for a property:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Queries Directus for spaces filtered by property
 * - Returns spaces list
 */
export const getSpaces = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get property ID from query params
      const reqTyped = req as {query: {propertyId?: string}};
      const propertyId = reqTyped.query?.propertyId;
      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing propertyId in query params."});
        return;
      }

      // 3) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 4) Verify property ownership
      const encodedId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 5) Query spaces filtered by property
      const spacesResponse = await directusRequest(
        `/items/spaces?filter[property][_eq]=${encodedId}`
      ) as DirectusResponse<unknown>;

      const spaces = spacesResponse?.data ?
        (Array.isArray(spacesResponse.data) ?
          spacesResponse.data : [spacesResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: spaces});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Create a new property:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Accepts property input from client
 * - FORCES app_profile = app_profile_id server-side (never trust client)
 * - Creates property in Directus
 * - Returns created property
 */
export const createProperty = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use POST."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        address_free_text?: string;
        lease_start_date?: string;
        lease_end_date?: string;
        lease_term?: number;
        nickname?: string;
        state_code?: string;
        street?: string;
        unit?: string;
        city?: string;
        zip?: number;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      // 4) Validate required fields
      if (!input.address_free_text || !input.lease_start_date) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required fields: address_free_text, lease_start_date",
        });
        return;
      }

      // 5) Create property in Directus
      // CRITICAL: Force app_profile server-side, never trust client input
      const propertyData = {
        address_free_text: input.address_free_text,
        lease_start_date: input.lease_start_date,
        lease_end_date: input.lease_end_date || null,
        lease_term: input.lease_term || null,
        nickname: input.nickname && input.nickname.trim() ?
          input.nickname.trim() : null,
        state_code: input.state_code || null,
        street: input.street || null,
        unit: input.unit || null,
        city: input.city || null,
        zip: input.zip || null,
        app_profile: appProfileId, // Enforced server-side
        status: "active", // Default status
      };

      // Log property creation request for debugging
      console.log("[createProperty] Creating property via /items/properties", {
        endpoint: "/items/properties",
        method: "POST",
        propertyData: {
          ...propertyData,
          app_profile: appProfileId, // Log app_profile for verification
        },
      });

      const propertyResponse = await directusRequest("/items/properties", {
        method: "POST",
        body: propertyData,
      }) as DirectusResponse<unknown>;

      // Log response for debugging
      const responseType =
        Array.isArray(propertyResponse?.data) ? "array" : "object";
      console.log("[createProperty] Directus response:", {
        hasData: !!propertyResponse?.data,
        responseType,
      });

      if (!propertyResponse?.data) {
        console.error("[createProperty] Failed: No data in response", {
          response: propertyResponse,
        });
        setCorsHeaders(res, req);
        res.status(500).json({
          error: "Failed to create property in Directus.",
        });
        return;
      }

      const createdProperty = Array.isArray(propertyResponse.data) ?
        propertyResponse.data[0] : propertyResponse.data;

      // Log created property ID for flow debugging
      const propertyId = (createdProperty as {id?: string})?.id;
      console.log("[createProperty] Property created successfully:", {
        propertyId,
        property: createdProperty,
      });

      // 6) Create default spaces for the property
      if (propertyId) {
        try {
          const defaultSpaces = [
            {
              property: propertyId,
              display_name: "Bedroom 1",
              space_type: "bedroom",
              ordinal: 10,
              is_default: true,
            },
            {
              property: propertyId,
              display_name: "Bathroom 1",
              space_type: "bathroom",
              ordinal: 20,
              is_default: true,
            },
            {
              property: propertyId,
              display_name: "Kitchen",
              space_type: "kitchen",
              ordinal: 30,
              is_default: true,
            },
            {
              property: propertyId,
              display_name: "Living Room",
              space_type: "living_room",
              ordinal: 40,
              is_default: true,
            },
          ];

          console.log(
            "[createProperty] Creating default spaces for property:",
            propertyId
          );

          const spacesResponse = await directusRequest("/items/spaces", {
            method: "POST",
            body: defaultSpaces,
          }) as DirectusResponse<unknown>;

          if (spacesResponse?.data) {
            const createdSpaces = Array.isArray(spacesResponse.data) ?
              spacesResponse.data : [spacesResponse.data];
            console.log(
              "[createProperty] Default spaces created:",
              createdSpaces.length
            );
          } else {
            console.warn(
              "[createProperty] Failed to create default spaces, " +
              "but property was created successfully"
            );
          }
        } catch (spaceError: unknown) {
          // Log error but don't fail property creation
          console.error(
            "[createProperty] Error creating default spaces:",
            getErrorMessage(spaceError)
          );
          // Property creation succeeded, spaces can be created manually
        }
      }

      setCorsHeaders(res, req);
      res.status(201).json({data: createdProperty});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Create a new space for a property:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Accepts space input from client (property, space_type, display_name)
 * - Creates space in Directus
 * - Returns created space
 */
export const createSpace = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use POST."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        property?: string;
        space_type?: string;
        display_name?: string;
        custom_space_type?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      // 4) Validate required fields
      if (!input.property || !input.space_type || !input.display_name) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required fields: property, space_type, display_name",
        });
        return;
      }

      // Validate space_type is one of the allowed values
      const validSpaceTypes = [
        "living_room",
        "kitchen",
        "hallway",
        "bedroom",
        "bathroom",
        "garage",
        "dining_room",
        "custom_space_type",
      ];
      if (!validSpaceTypes.includes(input.space_type)) {
        setCorsHeaders(res, req);
        const validTypesStr = validSpaceTypes.join(", ");
        res.status(400).json({
          error: `Invalid space_type. Must be one of: ${validTypesStr}`,
        });
        return;
      }

      // 5) Verify property ownership
      const encodedPropertyId = encodeURIComponent(input.property);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 6) Create space in Directus
      const spaceData: Record<string, unknown> = {
        property: input.property,
        space_type: input.space_type,
        display_name: input.display_name.trim(),
      };

      // Include custom_space_type only if space_type is "custom_space_type"
      if (input.space_type === "custom_space_type" && input.custom_space_type) {
        spaceData.custom_space_type = input.custom_space_type.trim();
      }

      console.log("[createSpace] Creating space via /items/spaces", {
        endpoint: "/items/spaces",
        method: "POST",
        spaceData,
      });

      const spaceResponse = await directusRequest("/items/spaces", {
        method: "POST",
        body: spaceData,
      }) as DirectusResponse<unknown>;

      if (!spaceResponse?.data) {
        console.error("[createSpace] Failed: No data in response", {
          response: spaceResponse,
        });
        setCorsHeaders(res, req);
        res.status(500).json({
          error: "Failed to create space in Directus.",
        });
        return;
      }

      const createdSpace = Array.isArray(spaceResponse.data) ?
        spaceResponse.data[0] : spaceResponse.data;

      console.log("[createSpace] Space created successfully:", {
        spaceId: (createdSpace as {id?: string})?.id,
        space: createdSpace,
      });

      setCorsHeaders(res, req);
      res.status(201).json({data: createdSpace});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Update a space:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership (through space's property)
 * - Accepts space updates from client
 * - Updates space in Directus
 * - Returns updated space
 */
export const updateSpace = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "PATCH") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use PATCH."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        id?: string;
        display_name?: string;
        space_type?: string;
        custom_space_type?: string;
        ordinal?: number;
        is_default?: boolean;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      // 4) Validate required fields
      const spaceId = input.id;
      if (!spaceId) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required field: id",
        });
        return;
      }

      // 5) Get the space to find its property
      const encodedSpaceId = encodeURIComponent(spaceId);
      const spaceCheck = await directusRequest(
        `/items/spaces?filter[id][_eq]=${encodedSpaceId}`
      ) as DirectusResponse<unknown>;

      const spaces = spaceCheck?.data ?
        (Array.isArray(spaceCheck.data) ?
          spaceCheck.data : [spaceCheck.data]) : [];

      if (spaces.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Space not found.",
        });
        return;
      }

      const space = spaces[0] as {property?: string};
      const propertyId = space.property;
      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Space has no associated property.",
        });
        return;
      }

      // 6) Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 7) Build update data (only include fields that are provided)
      const updateData: Record<string, unknown> = {};
      if (input.display_name !== undefined) {
        updateData.display_name = input.display_name;
      }
      if (input.space_type !== undefined) {
        updateData.space_type = input.space_type;
      }
      // Handle custom_space_type: only set if space_type is "custom_space_type"
      // NOTE: The custom_space_type field must exist in Directus.
      // If the field doesn't exist, this will be skipped to avoid errors.
      // To create the field in Directus:
      // 1. Go to Directus Admin > Settings > Data Model > Spaces collection
      // 2. Add field: "custom_space_type" (String, max 255, nullable: Yes)
      // 3. Set permissions for service token
      if (input.custom_space_type !== undefined &&
          input.space_type === "custom_space_type" &&
          input.custom_space_type &&
          input.custom_space_type.trim()) {
        // Only include if we're setting it to a non-empty value
        // Don't try to clear it if field doesn't exist
        updateData.custom_space_type = input.custom_space_type.trim();
      }
      if (input.ordinal !== undefined) {
        updateData.ordinal = input.ordinal;
      }
      if (input.is_default !== undefined) {
        updateData.is_default = input.is_default;
      }

      // 8) Update space in Directus
      const spaceResponse = await directusRequest(
        `/items/spaces/${encodedSpaceId}`,
        {
          method: "PATCH",
          body: updateData,
        }
      ) as DirectusResponse<unknown>;

      if (!spaceResponse?.data) {
        console.error("[updateSpace] Failed: No data in response", {
          response: spaceResponse,
        });
        setCorsHeaders(res, req);
        res.status(500).json({
          error: "Failed to update space in Directus.",
        });
        return;
      }

      const updatedSpace = Array.isArray(spaceResponse.data) ?
        spaceResponse.data[0] : spaceResponse.data;

      setCorsHeaders(res, req);
      res.status(200).json({data: updatedSpace});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Delete a space:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership (via space's property link)
 * - Deletes space from Directus
 * - Returns success response
 */
export const deleteSpace = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "DELETE") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use DELETE."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {id?: string};
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      const spaceId = input.id;
      if (!spaceId) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required field: id",
        });
        return;
      }

      const encodedSpaceId = encodeURIComponent(spaceId);
      const spaceCheck = await directusRequest(
        `/items/spaces?filter[id][_eq]=${encodedSpaceId}&fields=property`
      ) as DirectusResponse<{property: string}>;

      const spaces = spaceCheck?.data ?
        (Array.isArray(spaceCheck.data) ?
          spaceCheck.data : [spaceCheck.data]) : [];

      if (spaces.length === 0 || !spaces[0].property) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Space not found or property link missing.",
        });
        return;
      }
      const propertyId = spaces[0].property;

      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyOwnershipCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyOwnershipCheck = await directusRequest(
        propertyOwnershipCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyOwnershipCheck?.data ?
        (Array.isArray(propertyOwnershipCheck.data) ?
          propertyOwnershipCheck.data : [propertyOwnershipCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(403).json({
          error: "Access denied: Property not found or " +
            "does not belong to user.",
        });
        return;
      }

      await directusRequest(
        `/items/spaces/${encodedSpaceId}`,
        {
          method: "DELETE",
        }
      );

      setCorsHeaders(res, req);
      res.status(200).json({
        ok: true,
        message: "Space deleted successfully",
      });
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get photos for a property:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Queries Directus for photos filtered by property
 * - Optionally filters by spaceId or status
 * - Returns photos list
 */
export const getPhotos = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get property ID and optional filters from query params
      const reqTyped = req as {
        query: {propertyId?: string; spaceId?: string; status?: string};
      };
      const propertyId = reqTyped.query?.propertyId;
      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing propertyId in query params."});
        return;
      }
      const spaceId = reqTyped.query?.spaceId;

      // 3) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 4) Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 5) Build query filter for photos
      let filterPath =
        `/items/photos?filter[property][_eq]=${encodedPropertyId}`;

      // Optional: filter by spaceId
      if (spaceId) {
        const encodedSpaceId = encodeURIComponent(spaceId);
        filterPath += `&filter[space][_eq]=${encodedSpaceId}`;
      }

      // Optional: filter by status
      // Note: A photo is "assigned" if assignment_status='confirmed' OR
      // if it has a space assigned (even if assignment_status='unassigned')
      // A photo is "unassigned" if assignment_status='unassigned'
      // We'll fetch all photos and filter in post-processing for accuracy
      const statusFilter = reqTyped.query?.status;

      // 6) Query photos (fetch all if status filter, then filter in code)
      const photosResponse = await directusRequest(
        filterPath
      ) as DirectusResponse<unknown>;

      let photos = photosResponse?.data ?
        (Array.isArray(photosResponse.data) ?
          photosResponse.data : [photosResponse.data]) : [];

      // 7) Post-process for status filter
      // A photo is "assigned" if assignment_status='confirmed'
      // OR if it has a space assigned (handles edge case where
      // assignment_status wasn't updated for existing photos)
      // A photo is "unassigned" if assignment_status='unassigned'
      // AND it doesn't have a space (or has a default space)
      if (statusFilter === "assigned") {
        photos = photos.filter((photo: {
          assignment_status?: string;
          space?: string | {id?: string} | null;
        }) => {
          // Check if space exists (could be string ID or object)
          const hasSpace = photo.space &&
            (typeof photo.space === "string" ||
              (typeof photo.space === "object" && photo.space.id));
          return photo.assignment_status === "confirmed" || hasSpace;
        });
      } else if (statusFilter === "unassigned") {
        // Only show truly unassigned photos
        // Exclude photos that have a space assigned
        // (even if status is unassigned)
        photos = photos.filter((photo: {
          assignment_status?: string;
          space?: string | {id?: string} | null;
        }) => {
          if (photo.assignment_status !== "unassigned") {
            return false;
          }
          // Also exclude if space is set (handles edge case)
          const hasSpace = photo.space &&
            (typeof photo.space === "string" ||
              (typeof photo.space === "object" &&
                photo.space.id));
          return !hasSpace;
        });
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: photos});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Upload a file to Directus:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Accepts file as base64 or multipart/form-data
 * - Uploads to Directus /files endpoint
 * - Returns Directus file ID
 */
export const uploadFile = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use POST."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      // (for logging/audit, not required for file upload)
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        uri?: string;
        type?: string;
        name?: string;
        base64?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.name || (!input.uri && !input.base64)) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required fields: name, and either uri or base64",
        });
        return;
      }

      // 4) Get file data
      let fileBuffer: Buffer;
      let mimeType = input.type || "image/jpeg";

      if (input.base64) {
        // Handle base64 encoded file (data URI format)
        // Extract MIME type from data URI if present
        if (input.base64.startsWith("data:")) {
          const mimeMatch = input.base64.match(/^data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          const base64Data = input.base64.replace(/^data:[^;]*;base64,/, "");
          fileBuffer = Buffer.from(base64Data, "base64");
        } else {
          // Plain base64 string
          fileBuffer = Buffer.from(input.base64, "base64");
        }
      } else if (input.uri) {
        // For React Native, uri might be a local file path
        // We need to fetch it or handle it differently
        // For now, if it's a data URI, extract base64
        if (input.uri.startsWith("data:")) {
          const base64Data = input.uri.replace(/^data:.*,/, "");
          fileBuffer = Buffer.from(base64Data, "base64");
          const mimeMatch = input.uri.match(/^data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
        } else {
          // For local file URIs (React Native), we'd need to read the file
          // For MVP, we'll require base64 encoding from the client
          setCorsHeaders(res, req);
          res.status(400).json({
            error: "File upload requires base64 encoding. " +
              "Please convert the file to base64 before uploading.",
          });
          return;
        }
      } else {
        setCorsHeaders(res, req);
        res.status(400).json({error: "No file data provided."});
        return;
      }

      // 4.5) Check for HEIC/HEIF files (reject - client should convert)
      const isHeic =
        mimeType.includes("heic") ||
        mimeType.includes("heif") ||
        mimeType === "image/heic" ||
        mimeType === "image/heif" ||
        input.name.toLowerCase().endsWith(".heic") ||
        input.name.toLowerCase().endsWith(".heif");

      if (isHeic) {
        console.warn(
          "[uploadFile] HEIC/HEIF file detected. " +
          "Server-side conversion not supported. " +
          "Client should convert using preferredAssetRepresentationMode."
        );
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "HEIC files are not supported. " +
            "Please use JPEG format. " +
            "If using an iPhone, the app should automatically convert " +
            "HEIC to JPEG. If you see this error, please try selecting " +
            "the photo again or convert it to JPEG using your device's " +
            "photo app.",
        });
        return;
      }

      // Use original values (no conversion needed)
      const finalBuffer = fileBuffer;
      const finalMimeType = mimeType;
      const finalFilename = input.name;

      // 5) Upload to Directus
      const directusUrl =
        (DIRECTUS_URL.value() || "").replace(/\/+$/, "");
      const directusToken = DIRECTUS_SERVICE_TOKEN.value() || "";

      // Create multipart/form-data for Directus
      const boundary = `----WebKitFormBoundary${Date.now()}`;
      const escapedFilename = finalFilename.replace(/"/g, "\\\"");
      const formDataParts: string[] = [];

      formDataParts.push("--" + boundary);
      formDataParts.push(
        "Content-Disposition: form-data; name=\"file\"; " +
        "filename=\"" + escapedFilename + "\""
      );
      formDataParts.push("Content-Type: " + finalMimeType);
      formDataParts.push("");

      const formDataBuffer = Buffer.concat([
        Buffer.from(formDataParts.join("\r\n") + "\r\n"),
        finalBuffer,
        Buffer.from("\r\n--" + boundary + "--\r\n"),
      ]);

      const uploadResponse = await fetch(`${directusUrl}/files`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${directusToken}`,
          "Content-Type":
            `multipart/form-data; boundary=${boundary}`,
        },
        body: formDataBuffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => "");
        setCorsHeaders(res, req);
        res.status(uploadResponse.status).json({
          error: `Directus upload failed: ${errorText}`,
        });
        return;
      }

      const fileData =
        await uploadResponse.json() as DirectusResponse<{id: string}>;
      const file = fileData?.data ?
        (Array.isArray(fileData.data) ?
          fileData.data[0] : fileData.data) : null;

      if (!file?.id) {
        setCorsHeaders(res, req);
        res.status(500).json({error: "Failed to upload file to Directus."});
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: {id: file.id}});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Create a photo:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Creates photo record in Directus
 * - Returns created photo
 */
export const createPhoto = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use POST."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        property?: string;
        space?: string;
        file?: string;
        captured_at?: string;
        exif_datetime_original?: string;
        assignment_status?: string;
        notes?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.property || !input.file || !input.captured_at) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required fields: property, file, captured_at",
        });
        return;
      }

      // 4) Verify property ownership
      const encodedPropertyId = encodeURIComponent(input.property);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 5) If space is provided, verify it belongs to property
      // Otherwise, let Directus handle the default space
      if (input.space) {
        const encodedSpaceId = encodeURIComponent(input.space);
        const spaceCheck = await directusRequest(
          `/items/spaces?filter[id][_eq]=${encodedSpaceId}` +
          `&filter[property][_eq]=${encodedPropertyId}`
        ) as DirectusResponse<unknown>;

        const spaces = spaceCheck?.data ?
          (Array.isArray(spaceCheck.data) ?
            spaceCheck.data : [spaceCheck.data]) : [];

        if (spaces.length === 0) {
          setCorsHeaders(res, req);
          res.status(400).json({
            error: "Space does not belong to property.",
          });
          return;
        }
      }

      // 6) Create photo
      // If space is provided, set assignment_status to 'confirmed'
      // Otherwise, let Directus handle defaults for both space and
      // assignment_status
      const photoData: Record<string, unknown> = {
        property: input.property,
        file: input.file,
        captured_at: input.captured_at,
        uploaded_at: new Date().toISOString(),
      };

      // Only set space and assignment_status if explicitly provided
      // (i.e., when uploading from a space screen)
      if (input.space) {
        photoData.space = input.space;
        // If assignment_status not provided, set to 'confirmed'
        // when space is assigned
        photoData.assignment_status =
          input.assignment_status || "confirmed";
      } else if (input.assignment_status !== undefined) {
        // If assignment_status is explicitly set but no space, use it
        photoData.assignment_status = input.assignment_status;
      }
      // Otherwise, let Directus use its default values

      if (input.exif_datetime_original) {
        photoData.exif_datetime_original = input.exif_datetime_original;
      }
      if (input.notes) {
        photoData.notes = input.notes;
      }

      const photoResponse = await directusRequest(
        "/items/photos",
        {
          method: "POST",
          body: photoData,
        }
      ) as DirectusResponse<unknown>;

      const photo = photoResponse?.data ?
        (Array.isArray(photoResponse.data) ?
          photoResponse.data[0] : photoResponse.data) : null;

      if (!photo) {
        setCorsHeaders(res, req);
        res.status(500).json({error: "Failed to create photo in Directus."});
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: photo});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Update a photo:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership via photo.property
 * - Updates photo in Directus
 * - Returns updated photo
 */
export const updatePhoto = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "PATCH") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use PATCH."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        id?: string;
        property?: string;
        space?: string;
        file?: string;
        assignment_status?: string;
        notes?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.id) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing required field: id"});
        return;
      }

      // 4) Get photo to verify ownership
      const encodedPhotoId = encodeURIComponent(input.id);
      const photoResponse = await directusRequest(
        `/items/photos/${encodedPhotoId}?fields=*,property.*`
      ) as DirectusResponse<{property: string | {app_profile?: string}}>;

      if (!photoResponse?.data) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo not found."});
        return;
      }

      const photo = Array.isArray(photoResponse.data) ?
        photoResponse.data[0] : photoResponse.data;
      const propertyId = typeof photo.property === "string" ?
        photo.property : (photo.property as {id?: string})?.id;

      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo property not found."});
        return;
      }

      // 5) Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheck = await directusRequest(
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 6) Build update data
      const updateData: Record<string, unknown> = {};
      if (input.assignment_status !== undefined) {
        updateData.assignment_status = input.assignment_status;
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }
      if (input.file !== undefined) {
        updateData.file = input.file;
      }
      if (input.space !== undefined) {
        // Verify space belongs to the same property
        if (input.space) {
          const encodedSpaceId = encodeURIComponent(input.space);
          const spaceCheck = await directusRequest(
            "/items/spaces?filter[id][_eq]=" + encodedSpaceId +
            "&filter[property][_eq]=" + encodedPropertyId
          ) as DirectusResponse<unknown>;

          const spaces = spaceCheck?.data ?
            (Array.isArray(spaceCheck.data) ?
              spaceCheck.data : [spaceCheck.data]) : [];

          if (spaces.length === 0) {
            setCorsHeaders(res, req);
            res.status(400).json({
              error: "Space does not belong to the photo's property.",
            });
            return;
          }

          // When assigning a space, automatically set
          // assignment_status to 'confirmed' unless it's explicitly
          // being set to something else
          if (input.assignment_status === undefined) {
            updateData.assignment_status = "confirmed";
          }
        } else {
          // When unassigning space (setting to null),
          // set to 'unassigned'
          if (input.assignment_status === undefined) {
            updateData.assignment_status = "unassigned";
          }
        }
        updateData.space = input.space || null;
      }

      // 7) Update photo
      const updatedPhotoResponse = await directusRequest(
        `/items/photos/${encodedPhotoId}`,
        {
          method: "PATCH",
          body: updateData,
        }
      ) as DirectusResponse<unknown>;

      const updatedPhoto = updatedPhotoResponse?.data ?
        (Array.isArray(updatedPhotoResponse.data) ?
          updatedPhotoResponse.data[0] : updatedPhotoResponse.data) : null;

      setCorsHeaders(res, req);
      res.status(200).json({data: updatedPhoto});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get a single photo by ID:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership via photo.property
 * - Returns photo
 */
export const getPhoto = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Get photo ID from query params
      const reqTyped = req as {query: {photoId?: string}};
      const photoId = reqTyped.query?.photoId;
      if (!photoId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing photoId in query params."});
        return;
      }

      // 4) Get photo
      const encodedPhotoId = encodeURIComponent(photoId);
      const photoResponse = await directusRequest(
        `/items/photos/${encodedPhotoId}?fields=*,property.*`
      ) as DirectusResponse<{property: string | {app_profile?: string}}>;

      if (!photoResponse?.data) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo not found."});
        return;
      }

      const photo = Array.isArray(photoResponse.data) ?
        photoResponse.data[0] : photoResponse.data;
      const propertyId = typeof photo.property === "string" ?
        photo.property : (photo.property as {id?: string})?.id;

      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo property not found."});
        return;
      }

      // 5) Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheck = await directusRequest(
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: photo});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Delete a photo:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership via photo.property
 * - Deletes photo from Directus
 * - Returns success status
 */
export const deletePhoto = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "DELETE" && req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({
          error: "Method not allowed. Use DELETE or POST.",
        });
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body or query param for photo ID
      const reqTyped = req as {body: unknown; query: {photoId?: string}};
      let photoId: string | undefined;

      if (req.method === "POST") {
        let input: {id?: string; photoId?: string};
        try {
          input = typeof reqTyped.body === "string" ?
            JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
          photoId = input.id || input.photoId;
        } catch {
          setCorsHeaders(res, req);
          res.status(400).json({error: "Invalid JSON in request body."});
          return;
        }
      } else {
        photoId = reqTyped.query?.photoId;
      }

      if (!photoId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing required field: photoId"});
        return;
      }

      // 4) Get photo to verify ownership
      const encodedPhotoId = encodeURIComponent(photoId);
      const photoResponse = await directusRequest(
        `/items/photos/${encodedPhotoId}?fields=*,property.*`
      ) as DirectusResponse<{property: string | {app_profile?: string}}>;

      if (!photoResponse?.data) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo not found."});
        return;
      }

      const photo = Array.isArray(photoResponse.data) ?
        photoResponse.data[0] : photoResponse.data;
      const propertyId = typeof photo.property === "string" ?
        photo.property : (photo.property as {id?: string})?.id;

      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo property not found."});
        return;
      }

      // 5) Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheck = await directusRequest(
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 6) Delete photo
      await directusRequest(
        `/items/photos/${encodedPhotoId}`,
        {
          method: "DELETE",
        }
      );

      setCorsHeaders(res, req);
      res.status(200).json({ok: true, message: "Photo deleted successfully"});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Create an inspection:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Creates inspection row
 * - Creates all 7 inspection_steps rows
 * - Returns inspection
 */
export const createInspection = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use POST."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {
        property_id?: string;
        inspection_type?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.property_id || !input.inspection_type) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required fields: property_id, inspection_type",
        });
        return;
      }

      // Verify property ownership
      const encodedPropertyId = encodeURIComponent(input.property_id);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // Create inspection
      const now = new Date().toISOString();
      const inspectionData = {
        property_id: input.property_id,
        created_by_user_id: appProfileId,
        inspection_status: "in_progress",
        inspection_type: input.inspection_type,
        started_at: now,
        completed_at: null,
        last_step: null,
        inspections_progress: 0,
      };

      const inspectionResponse = await directusRequest(
        "/items/inspections",
        {
          method: "POST",
          body: inspectionData,
        }
      ) as DirectusResponse<{id: string}>;

      if (!inspectionResponse?.data) {
        setCorsHeaders(res, req);
        res.status(500).json({error: "Failed to create inspection."});
        return;
      }

      const inspectionId = Array.isArray(inspectionResponse.data) ?
        inspectionResponse.data[0].id : inspectionResponse.data.id;

      // Create all 7 steps
      const stepKeys = [
        "intro",
        "choose_property",
        "confirm_scope",
        "capture_overview",
        "capture_spaces",
        "review",
        "complete",
      ];

      for (let i = 0; i < stepKeys.length; i++) {
        const stepKey = stepKeys[i];
        await directusRequest(
          "/items/inspection_steps",
          {
            method: "POST",
            body: {
              inspection_id: inspectionId,
              step_key: stepKey,
              inspection_step_status: i === 0 ? "in_progress" : "not_started",
              payload_json: {},
            },
          }
        );
      }

      // Fetch and return the created inspection
      const createdInspection = await directusRequest(
        `/items/inspections/${inspectionId}`
      ) as DirectusResponse<unknown>;

      const inspection = createdInspection?.data ?
        (Array.isArray(createdInspection.data) ?
          createdInspection.data[0] : createdInspection.data) : null;

      setCorsHeaders(res, req);
      res.status(200).json({data: inspection});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get inspections for the current user:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Queries inspections filtered by created_by_user_id
 * - Optionally filters by status
 * - Returns inspections list
 */
export const getInspections = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {query: {status?: string}};
      let filterPath =
        "/items/inspections?filter[created_by_user_id][_eq]=" +
        encodeURIComponent(appProfileId);

      if (reqTyped.query?.status) {
        filterPath +=
          "&filter[inspection_status][_eq]=" +
          encodeURIComponent(reqTyped.query.status);
      }

      const inspectionsResponse = await directusRequest(
        filterPath
      ) as DirectusResponse<unknown>;

      const inspections = inspectionsResponse?.data ?
        (Array.isArray(inspectionsResponse.data) ?
          inspectionsResponse.data : [inspectionsResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: inspections});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get a single inspection by ID:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies ownership (created_by_user_id)
 * - Returns inspection
 */
export const getInspectionById = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {query: {id?: string}};
      const inspectionId = reqTyped.query?.id;
      if (!inspectionId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing id in query params."});
        return;
      }

      const encodedId = encodeURIComponent(inspectionId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const filterPath =
        `/items/inspections?filter[id][_eq]=${encodedId}` +
        `&filter[created_by_user_id][_eq]=${encodedProfileId}`;

      const inspectionResponse = await directusRequest(
        filterPath
      ) as DirectusResponse<unknown>;

      const inspections = inspectionResponse?.data ?
        (Array.isArray(inspectionResponse.data) ?
          inspectionResponse.data : [inspectionResponse.data]) : [];

      if (inspections.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Inspection not found or access denied.",
        });
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: inspections[0]});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get all steps for an inspection:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies inspection ownership
 * - Returns steps list
 */
export const getInspectionSteps = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {query: {inspectionId?: string}};
      const inspectionId = reqTyped.query?.inspectionId;
      if (!inspectionId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing inspectionId in query params."});
        return;
      }

      // Verify inspection ownership
      const encodedId = encodeURIComponent(inspectionId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const inspectionCheck = await directusRequest(
        `/items/inspections?filter[id][_eq]=${encodedId}` +
        `&filter[created_by_user_id][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const inspections = inspectionCheck?.data ?
        (Array.isArray(inspectionCheck.data) ?
          inspectionCheck.data : [inspectionCheck.data]) : [];

      if (inspections.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Inspection not found or access denied.",
        });
        return;
      }

      // Get steps
      const stepsResponse = await directusRequest(
        `/items/inspection_steps?filter[inspection_id][_eq]=${encodedId}`
      ) as DirectusResponse<unknown>;

      const steps = stepsResponse?.data ?
        (Array.isArray(stepsResponse.data) ?
          stepsResponse.data : [stepsResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: steps});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get a single step by inspection ID and step_key:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies inspection ownership
 * - Returns step
 */
export const getInspectionStep = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {
        query: {inspectionId?: string; stepKey?: string};
      };
      const inspectionId = reqTyped.query?.inspectionId;
      const stepKey = reqTyped.query?.stepKey;

      if (!inspectionId || !stepKey) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing inspectionId or stepKey in query params.",
        });
        return;
      }

      // Verify inspection ownership
      const encodedId = encodeURIComponent(inspectionId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const inspectionCheck = await directusRequest(
        `/items/inspections?filter[id][_eq]=${encodedId}` +
        `&filter[created_by_user_id][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const inspections = inspectionCheck?.data ?
        (Array.isArray(inspectionCheck.data) ?
          inspectionCheck.data : [inspectionCheck.data]) : [];

      if (inspections.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Inspection not found or access denied.",
        });
        return;
      }

      // Get step
      const encodedStepKey = encodeURIComponent(stepKey);
      const stepResponse = await directusRequest(
        `/items/inspection_steps?filter[inspection_id][_eq]=${encodedId}` +
        `&filter[step_key][_eq]=${encodedStepKey}`
      ) as DirectusResponse<unknown>;

      const steps = stepResponse?.data ?
        (Array.isArray(stepResponse.data) ?
          stepResponse.data : [stepResponse.data]) : [];

      if (steps.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Step not found.",
        });
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: steps[0]});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Update an inspection step:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies inspection ownership
 * - Updates step
 * - Returns updated step
 */
export const updateInspectionStep = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "PATCH") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use PATCH."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {
        id?: string;
        payload_json?: unknown;
        inspection_step_status?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.id) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing required field: id"});
        return;
      }

      // Get step to find inspection_id
      const encodedStepId = encodeURIComponent(input.id);
      const stepResponse = await directusRequest(
        `/items/inspection_steps/${encodedStepId}?fields=inspection_id`
      ) as DirectusResponse<{inspection_id: string}>;

      if (!stepResponse?.data) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Step not found."});
        return;
      }

      const stepData = Array.isArray(stepResponse.data) ?
        stepResponse.data[0] : stepResponse.data;
      const inspectionId = stepData.inspection_id;

      // Verify inspection ownership
      const encodedInspectionId = encodeURIComponent(inspectionId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const inspectionCheck = await directusRequest(
        `/items/inspections?filter[id][_eq]=${encodedInspectionId}` +
        `&filter[created_by_user_id][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const inspections = inspectionCheck?.data ?
        (Array.isArray(inspectionCheck.data) ?
          inspectionCheck.data : [inspectionCheck.data]) : [];

      if (inspections.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Inspection not found or access denied.",
        });
        return;
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (input.payload_json !== undefined) {
        updateData.payload_json = input.payload_json;
      }
      if (input.inspection_step_status !== undefined) {
        updateData.inspection_step_status = input.inspection_step_status;
      }

      // Update step
      const updatedStepResponse = await directusRequest(
        `/items/inspection_steps/${encodedStepId}`,
        {
          method: "PATCH",
          body: updateData,
        }
      ) as DirectusResponse<unknown>;

      const updatedStep = updatedStepResponse?.data ?
        (Array.isArray(updatedStepResponse.data) ?
          updatedStepResponse.data[0] : updatedStepResponse.data) : null;

      setCorsHeaders(res, req);
      res.status(200).json({data: updatedStep});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Update an inspection:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies inspection ownership
 * - Updates inspection
 * - Returns updated inspection
 */
export const updateInspection = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "PATCH") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use PATCH."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {
        id?: string;
        last_step?: string | null;
        inspections_progress?: number;
        inspection_status?: string;
        completed_at?: string | null;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.id) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing required field: id"});
        return;
      }

      // Verify inspection ownership
      const encodedId = encodeURIComponent(input.id);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const inspectionCheck = await directusRequest(
        `/items/inspections?filter[id][_eq]=${encodedId}` +
        `&filter[created_by_user_id][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const inspections = inspectionCheck?.data ?
        (Array.isArray(inspectionCheck.data) ?
          inspectionCheck.data : [inspectionCheck.data]) : [];

      if (inspections.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Inspection not found or access denied.",
        });
        return;
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (input.last_step !== undefined) {
        updateData.last_step = input.last_step;
      }
      if (input.inspections_progress !== undefined) {
        updateData.inspections_progress = input.inspections_progress;
      }
      if (input.inspection_status !== undefined) {
        updateData.inspection_status = input.inspection_status;
      }
      if (input.completed_at !== undefined) {
        updateData.completed_at = input.completed_at;
      }

      // Update inspection
      const updatedInspectionResponse = await directusRequest(
        `/items/inspections/${encodedId}`,
        {
          method: "PATCH",
          body: updateData,
        }
      ) as DirectusResponse<unknown>;

      const updatedInspection = updatedInspectionResponse?.data ?
        (Array.isArray(updatedInspectionResponse.data) ?
          updatedInspectionResponse.data[0] :
          updatedInspectionResponse.data) : null;

      setCorsHeaders(res, req);
      res.status(200).json({data: updatedInspection});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Create a report:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Creates report
 * - Returns report
 */
export const createReport = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use POST."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {
        property?: string;
        report_type?: string;
        status?: string;
        snapshot_json?: unknown;
        context_state_code?: string;
        disclaimer_version?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.property || !input.report_type ||
          !input.status || !input.snapshot_json) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required fields: property, report_type, " +
            "status, snapshot_json",
        });
        return;
      }

      // Verify property ownership
      const encodedPropertyId = encodeURIComponent(input.property);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // Create report
      const reportData: Record<string, unknown> = {
        property: input.property,
        report_type: input.report_type,
        status: input.status,
        snapshot_json: input.snapshot_json,
        generated_at: new Date().toISOString(),
      };

      if (input.context_state_code) {
        reportData.context_state_code = input.context_state_code;
      }
      if (input.disclaimer_version) {
        reportData.disclaimer_version = input.disclaimer_version;
      }

      const reportResponse = await directusRequest(
        "/items/reports",
        {
          method: "POST",
          body: reportData,
        }
      ) as DirectusResponse<unknown>;

      const report = reportResponse?.data ?
        (Array.isArray(reportResponse.data) ?
          reportResponse.data[0] : reportResponse.data) : null;

      setCorsHeaders(res, req);
      res.status(200).json({data: report});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get reports for a property:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Returns reports list
 */
export const getReports = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {query: {propertyId?: string}};
      const propertyId = reqTyped.query?.propertyId;
      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing propertyId in query params."});
        return;
      }

      // Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // Get reports
      const reportsResponse = await directusRequest(
        `/items/reports?filter[property][_eq]=${encodedPropertyId}`
      ) as DirectusResponse<unknown>;

      const reports = reportsResponse?.data ?
        (Array.isArray(reportsResponse.data) ?
          reportsResponse.data : [reportsResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: reports});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get a single report by ID:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership via report.property
 * - Returns report
 */
export const getReportById = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {query: {id?: string}};
      const reportId = reqTyped.query?.id;
      if (!reportId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing id in query params."});
        return;
      }

      // Get report
      const encodedReportId = encodeURIComponent(reportId);
      const reportResponse = await directusRequest(
        `/items/reports/${encodedReportId}?fields=*,property.*`
      ) as DirectusResponse<{property: string | {app_profile?: string}}>;

      if (!reportResponse?.data) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Report not found."});
        return;
      }

      const report = Array.isArray(reportResponse.data) ?
        reportResponse.data[0] : reportResponse.data;

      // Verify property ownership
      const propertyId = typeof report.property === "string" ?
        report.property : (report.property as {id?: string})?.id;

      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Report property not found."});
        return;
      }

      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheck = await directusRequest(
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: report});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get user preferences:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Returns user preferences or null
 */
export const getUserPreferences = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // Get preferences
      // Use direct field name app_profile_id (not a relationship field)
      const encodedProfileId = encodeURIComponent(appProfileId);
      console.log("[getUserPreferences] Querying user_preferences", {
        appProfileId: appProfileId,
        encodedProfileId: encodedProfileId,
        filter: `filter[app_profile_id][_eq]=${encodedProfileId}`,
      });

      const prefsResponse = await directusRequest(
        "/items/user_preferences?filter[app_profile_id][_eq]=" +
        encodedProfileId
      ) as DirectusResponse<unknown>;

      console.log("[getUserPreferences] Directus response", {
        hasData: !!prefsResponse?.data,
        dataType: Array.isArray(prefsResponse?.data) ?
          "array" : typeof prefsResponse?.data,
        dataLength: Array.isArray(prefsResponse?.data) ?
          prefsResponse.data.length : 1,
      });

      const prefs = prefsResponse?.data ?
        (Array.isArray(prefsResponse.data) ?
          prefsResponse.data : [prefsResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: prefs.length > 0 ? prefs[0] : null});
    } catch (err: unknown) {
      // Note: appProfileId may not be in scope if error occurred
      // before it was defined
      console.error("[getUserPreferences] Error:", {
        error: err,
        message: getErrorMessage(err),
      });
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Update user preferences:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Creates or updates preferences
 * - Returns preferences
 */
export const updateUserPreferences = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "PATCH") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use PATCH."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {
        theme_preference?: string;
        preferred_language?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      // Check if preferences exist
      // Use direct field name app_profile_id (not a relationship field)
      const encodedProfileId = encodeURIComponent(appProfileId);
      const prefsResponse = await directusRequest(
        "/items/user_preferences?filter[app_profile_id][_eq]=" +
        encodedProfileId
      ) as DirectusResponse<{id: string}>;

      const existingPrefs = prefsResponse?.data ?
        (Array.isArray(prefsResponse.data) ?
          prefsResponse.data : [prefsResponse.data]) : [];

      let result;
      if (existingPrefs.length > 0) {
        // Update existing
        const updateData: Record<string, unknown> = {};
        if (input.theme_preference !== undefined) {
          updateData.theme_preference = input.theme_preference;
        }
        if (input.preferred_language !== undefined) {
          updateData.preferred_language = input.preferred_language;
        }

        const updatedResponse = await directusRequest(
          `/items/user_preferences/${existingPrefs[0].id}`,
          {
            method: "PATCH",
            body: updateData,
          }
        ) as DirectusResponse<unknown>;

        result = updatedResponse?.data ?
          (Array.isArray(updatedResponse.data) ?
            updatedResponse.data[0] : updatedResponse.data) : null;
      } else {
        // Create new
        const createData: Record<string, unknown> = {
          app_profile_id: appProfileId,
          theme_preference: input.theme_preference || "auto",
        };
        if (input.preferred_language !== undefined) {
          createData.preferred_language = input.preferred_language;
        }

        const createdResponse = await directusRequest(
          "/items/user_preferences",
          {
            method: "POST",
            body: createData,
          }
        ) as DirectusResponse<unknown>;

        result = createdResponse?.data ?
          (Array.isArray(createdResponse.data) ?
            createdResponse.data[0] : createdResponse.data) : null;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: result});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Create a photo-space assignment:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies photo belongs to user's property
 * - Verifies space belongs to same property
 * - Creates assignment in Directus
 * - Returns created assignment
 */
export const createAssignment = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "POST") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use POST."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Parse request body
      const reqTyped = req as {body: unknown};
      let input: {
        photo?: string;
        space?: string;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      if (!input.photo || !input.space) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Missing required fields: photo, space",
        });
        return;
      }

      // 4) Get photo and verify ownership
      const encodedPhotoId = encodeURIComponent(input.photo);
      const photoResponse = await directusRequest(
        "/items/photos/" + encodedPhotoId + "?fields=*,property.*"
      ) as DirectusResponse<{property: string | {id?: string}}>;

      if (!photoResponse?.data) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo not found."});
        return;
      }

      const photo = Array.isArray(photoResponse.data) ?
        photoResponse.data[0] : photoResponse.data;
      const propertyId = typeof photo.property === "string" ?
        photo.property : (photo.property as {id?: string})?.id;

      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo property not found."});
        return;
      }

      // 5) Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheck = await directusRequest(
        "/items/properties?filter[id][_eq]=" + encodedPropertyId +
        "&filter[app_profile][_eq]=" + encodedProfileId
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 6) Verify space belongs to same property
      const encodedSpaceId = encodeURIComponent(input.space);
      const spaceCheck = await directusRequest(
        "/items/spaces?filter[id][_eq]=" + encodedSpaceId +
        "&filter[property][_eq]=" + encodedPropertyId
      ) as DirectusResponse<unknown>;

      const spaces = spaceCheck?.data ?
        (Array.isArray(spaceCheck.data) ?
          spaceCheck.data : [spaceCheck.data]) : [];

      if (spaces.length === 0) {
        setCorsHeaders(res, req);
        res.status(400).json({
          error: "Space does not belong to the photo's property.",
        });
        return;
      }

      // 7) Create assignment
      const assignmentData: Record<string, unknown> = {
        photo: input.photo,
        space: input.space,
        confirmed_by_app_profile: appProfileId,
        confirmed_at: new Date().toISOString(),
        method: "manual",
      };

      const assignmentResponse = await directusRequest(
        "/items/photo_space_assignments",
        {
          method: "POST",
          body: assignmentData,
        }
      ) as DirectusResponse<unknown>;

      const assignment = assignmentResponse?.data ?
        (Array.isArray(assignmentResponse.data) ?
          assignmentResponse.data[0] : assignmentResponse.data) : null;

      if (!assignment) {
        setCorsHeaders(res, req);
        res.status(500).json({
          error: "Failed to create assignment in Directus.",
        });
        return;
      }

      setCorsHeaders(res, req);
      res.status(200).json({data: assignment});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Get assignments for a photo:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies photo belongs to user's property
 * - Returns assignments
 */
export const getAssignments = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      // 1) Verify Firebase ID token
      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // 2) Get or create app_profile
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 3) Get photo ID from query params
      const reqTyped = req as {query: {photoId?: string}};
      const photoId = reqTyped.query?.photoId;
      if (!photoId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing photoId in query params."});
        return;
      }

      // 4) Get photo and verify ownership
      const encodedPhotoId = encodeURIComponent(photoId);
      const photoResponse = await directusRequest(
        "/items/photos/" + encodedPhotoId + "?fields=*,property.*"
      ) as DirectusResponse<{property: string | {id?: string}}>;

      if (!photoResponse?.data) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo not found."});
        return;
      }

      const photo = Array.isArray(photoResponse.data) ?
        photoResponse.data[0] : photoResponse.data;
      const propertyId = typeof photo.property === "string" ?
        photo.property : (photo.property as {id?: string})?.id;

      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(404).json({error: "Photo property not found."});
        return;
      }

      // 5) Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheck = await directusRequest(
        "/items/properties?filter[id][_eq]=" + encodedPropertyId +
        "&filter[app_profile][_eq]=" + encodedProfileId
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // 6) Get assignments
      const assignmentsResponse = await directusRequest(
        "/items/photo_space_assignments?filter[photo][_eq]=" + encodedPhotoId
      ) as DirectusResponse<unknown>;

      const assignments = assignmentsResponse?.data ?
        (Array.isArray(assignmentsResponse.data) ?
          assignmentsResponse.data : [assignmentsResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: assignments});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Proxy file requests from Directus:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Fetches file from Directus using service token
 * - Returns file with proper headers
 */
export const getFile = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        console.error("[getFile] Method not allowed:", req.method);
        sendImageError(res, req, 405);
        return;
      }

      // 1) Get query params first
      const reqTyped = req as {query: {fileId?: string; token?: string}};
      const fileId = reqTyped.query?.fileId;
      if (!fileId) {
        console.error("[getFile] Missing fileId");
        sendImageError(res, req, 400);
        return;
      }

      console.log("[getFile] Request for fileId:", fileId);

      // 2) Optionally fetch file metadata to check file type
      // This helps detect HEIC files before serving them
      let fileMetadata: {
        type?: string;
        filename_download?: string;
      } | null = null;
      try {
        const metadataResponse = await directusRequest(`/files/${fileId}`);
        if (metadataResponse && typeof metadataResponse === "object") {
          fileMetadata = metadataResponse as {
            type?: string;
            filename_download?: string;
          };
          console.log("[getFile] File metadata:", {
            type: fileMetadata.type,
            filename: fileMetadata.filename_download,
          });
        }
      } catch (metadataError: unknown) {
        // Non-fatal - continue without metadata
        console.warn(
          "[getFile] Could not fetch file metadata:",
          getErrorMessage(metadataError)
        );
      }

      // 3) Verify Firebase ID token
      // Accept token from Authorization header OR query param (for Images)
      const authHeader = req.get("Authorization") || "";
      const idTokenFromHeader = extractBearerToken(authHeader);
      const idTokenFromQuery = reqTyped.query?.token;
      const idToken = idTokenFromHeader || idTokenFromQuery;

      if (!idToken) {
        console.error("[getFile] Missing token");
        sendImageError(res, req, 401);
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
        console.log("[getFile] Token verified for user:", decoded.uid);
      } catch (err: unknown) {
        console.error(
          "[getFile] Token verification failed:",
          getErrorMessage(err)
        );
        sendImageError(res, req, 401);
        return;
      }

      // 3) Get or create app_profile (for logging/audit)
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      // 4) Fetch file from Directus
      const directusUrl =
        (DIRECTUS_URL.value() || "").replace(/\/+$/, "");
      const directusToken = DIRECTUS_SERVICE_TOKEN.value() || "";

      if (!directusUrl || !directusToken) {
        console.error("[getFile] Directus configuration missing");
        sendImageError(res, req, 500);
        return;
      }

      const fileUrl = `${directusUrl}/assets/${fileId}`;
      console.log("[getFile] Fetching from Directus:", fileUrl);
      let fileResponse: Response;
      try {
        fileResponse = await fetch(fileUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${directusToken}`,
          },
        });
        console.log("[getFile] Directus response status:", fileResponse.status);
      } catch (fetchError: unknown) {
        console.error("[getFile] Fetch error:", getErrorMessage(fetchError));
        sendImageError(res, req, 500);
        return;
      }

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text().catch(() => "");
        console.error(
          "[getFile] Directus error response:",
          fileResponse.status,
          errorText
        );
        sendImageError(res, req, fileResponse.status);
        return;
      }

      // 5) Get file content and content type
      let fileBuffer: ArrayBuffer;
      try {
        fileBuffer = await fileResponse.arrayBuffer();
      } catch (bufferError: unknown) {
        console.error("[getFile] Buffer error:", getErrorMessage(bufferError));
        sendImageError(res, req, 500);
        return;
      }

      const contentType =
        fileResponse.headers.get("content-type") ||
        "application/octet-stream";

      // Handle HEIC/HEIF files - browsers and React Native don't support them
      // Check both Content-Type header and file metadata
      const isHeic =
        contentType.includes("heic") ||
        contentType.includes("heif") ||
        contentType === "image/heic" ||
        contentType === "image/heif" ||
        fileMetadata?.type?.includes("heic") ||
        fileMetadata?.type?.includes("heif") ||
        fileMetadata?.filename_download?.toLowerCase().endsWith(".heic") ||
        fileMetadata?.filename_download?.toLowerCase().endsWith(".heif");

      if (isHeic) {
        console.warn(
          "[getFile] HEIC/HEIF file detected. " +
          "Browsers and React Native Image component don't support HEIC. " +
          "Returning error response. Consider converting to JPEG on upload."
        );
        // Return a helpful error as an image
        // The client will see this as a failed image load
        sendImageError(
          res,
          req,
          415
        ); // 415 = Unsupported Media Type
        return;
      }

      console.log(
        "[getFile] File size:",
        fileBuffer.byteLength,
        "bytes, Content-Type:",
        contentType
      );

      // 6) Set appropriate headers and return file as binary
      // Important: Set CORS headers before setting content type
      setCorsHeaders(res, req);
      const resTyped = res as {
        setHeader: (name: string, value: string) => void;
        status: (code: number) => {
          send: (body: Buffer | string) => void;
          end: () => void;
        };
      };
      resTyped.setHeader("Content-Type", contentType);
      resTyped.setHeader("Cache-Control", "public, max-age=31536000");
      resTyped.setHeader("Content-Length", fileBuffer.byteLength.toString());
      resTyped.setHeader("Accept-Ranges", "bytes");
      console.log("[getFile] Sending file response");
      resTyped.status(200).send(Buffer.from(fileBuffer));
    } catch (err: unknown) {
      console.error("[getFile] Unexpected error:", getErrorMessage(err));
      sendImageError(res, req, 500);
    }
  }
);

/**
 * Get app profile:
 * - Verifies Firebase ID token
 * - Gets app_profile from Directus
 * - Returns app_profile
 */
export const getAppProfile = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // Get app_profile by firebase_uid
      const encodedUid = encodeURIComponent(decoded.uid);
      const profileResponse = await directusRequest(
        `/items/app_profiles?filter[firebase_uid][_eq]=${encodedUid}`
      ) as DirectusResponse<unknown>;

      const profiles = profileResponse?.data ?
        (Array.isArray(profileResponse.data) ?
          profileResponse.data : [profileResponse.data]) : [];

      setCorsHeaders(res, req);
      res.status(200).json({data: profiles.length > 0 ? profiles[0] : null});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Update app profile:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Updates app_profile fields (name, onboarding_completed)
 * - Returns updated app_profile
 */
export const updateAppProfile = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "PATCH") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use PATCH."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      // Get or create app_profile (should already exist, but create if missing)
      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        // Use token name if available, but input.name will override
        name: displayName,
      });

      const reqTyped = req as {body: unknown};
      let input: {
        name?: string;
        onboarding_completed?: boolean;
      };
      try {
        input = typeof reqTyped.body === "string" ?
          JSON.parse(reqTyped.body) : reqTyped.body as typeof input;
      } catch {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Invalid JSON in request body."});
        return;
      }

      // Update app_profile
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.onboarding_completed !== undefined) {
        updateData.onboarding_completed = input.onboarding_completed;
      }

      const updatedResponse = await directusRequest(
        `/items/app_profiles/${appProfileId}`,
        {
          method: "PATCH",
          body: updateData,
        }
      ) as DirectusResponse<unknown>;

      const result = updatedResponse?.data ?
        (Array.isArray(updatedResponse.data) ?
          updatedResponse.data[0] : updatedResponse.data) : null;

      setCorsHeaders(res, req);
      res.status(200).json({data: result});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);

/**
 * Check if a property has any inspections:
 * - Verifies Firebase ID token
 * - Resolves app_profile_id
 * - Verifies property ownership
 * - Queries inspections by property_id
 * - Returns boolean indicating if inspections exist
 */
export const propertyHasInspections = onRequest(
  {
    region: "us-central1",
    secrets: [DIRECTUS_URL, DIRECTUS_SERVICE_TOKEN],
    cors: true,
  },
  async (req, res) => {
    if (handleCorsPreflight(req, res)) {
      return;
    }
    setCorsHeaders(res, req);

    try {
      if (req.method !== "GET") {
        setCorsHeaders(res, req);
        res.status(405).json({error: "Method not allowed. Use GET."});
        return;
      }

      let decoded: admin.auth.DecodedIdToken;
      try {
        decoded = await verifyFirebaseUser(req);
      } catch (err: unknown) {
        setCorsHeaders(res, req);
        res.status(401).json({
          error: getErrorMessage(err),
        });
        return;
      }

      const displayName =
        (decoded as {name?: string; displayName?: string}).name ||
        (decoded as {name?: string; displayName?: string}).displayName ||
        null;
      const appProfileId = await getOrCreateAppProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: displayName,
      });

      const reqTyped = req as {query: {propertyId?: string}};
      const propertyId = reqTyped.query?.propertyId;

      if (!propertyId) {
        setCorsHeaders(res, req);
        res.status(400).json({error: "Missing required parameter: propertyId"});
        return;
      }

      // Verify property ownership
      const encodedPropertyId = encodeURIComponent(propertyId);
      const encodedProfileId = encodeURIComponent(appProfileId);
      const propertyCheckPath =
        `/items/properties?filter[id][_eq]=${encodedPropertyId}` +
        `&filter[app_profile][_eq]=${encodedProfileId}`;
      const propertyCheck = await directusRequest(
        propertyCheckPath
      ) as DirectusResponse<unknown>;

      const properties = propertyCheck?.data ?
        (Array.isArray(propertyCheck.data) ?
          propertyCheck.data : [propertyCheck.data]) : [];

      if (properties.length === 0) {
        setCorsHeaders(res, req);
        res.status(404).json({
          error: "Property not found or access denied.",
        });
        return;
      }

      // Query inspections by property_id
      const inspectionsResponse = await directusRequest(
        `/items/inspections?filter[property_id][_eq]=${encodedPropertyId}` +
        "&limit=1"
      ) as DirectusResponse<unknown>;

      const inspections = inspectionsResponse?.data ?
        (Array.isArray(inspectionsResponse.data) ?
          inspectionsResponse.data : [inspectionsResponse.data]) : [];

      const hasInspections = inspections.length > 0;

      setCorsHeaders(res, req);
      res.status(200).json({hasInspections});
    } catch (err: unknown) {
      setCorsHeaders(res, req);
      res.status(500).json({
        ok: false,
        error: getErrorMessage(err),
      });
    }
  }
);
