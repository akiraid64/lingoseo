// Stub for lingo.dev SDK identity tracking.
// The SDK calls /users/me on init to get the user's email for PostHog analytics.
// We return a minimal response so the SDK doesn't error out.

export async function GET() {
  return Response.json({ email: "engine@lingoseo.local" });
}
