const readEnvString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const workflowId = (() => {
  const id = readEnvString(import.meta.env.VITE_CHATKIT_WORKFLOW_ID);
  if (!id || id.startsWith("wf_replace")) {
    throw new Error("Set VITE_CHATKIT_WORKFLOW_ID in your .env file.");
  }
  return id;
})();

// ✅ SESSION ID FIX (NEW ADD)
function getSessionId() {
  let sessionId = localStorage.getItem("session_id");

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("session_id", sessionId);
  }

  return sessionId;
}

export function createClientSecretFetcher(
  workflow: string,
  endpoint = `${import.meta.env.VITE_API_URL}/api/create-session`
) {
  return async (currentSecret: string | null) => {

    // ✅ session id use karo (NEW ADD)
    const sessionId = getSessionId();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      
      // ✅ BODY UPDATED (IMPORTANT FIX)
      body: JSON.stringify({
        workflow: { id: workflow },
        user: sessionId, // 🔥 ye line fix hai
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      client_secret?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to create session");
    }

    if (!payload.client_secret) {
      throw new Error("Missing client secret in response");
    }

    return payload.client_secret;
  };
}