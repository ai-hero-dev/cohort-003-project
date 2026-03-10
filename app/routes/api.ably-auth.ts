import type { LoaderFunctionArgs } from "react-router";
import Ably from "ably";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = getUserById(userId);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ABLY_API_KEY not configured" },
      { status: 500 }
    );
  }

  const client = new Ably.Rest(apiKey);
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: String(user.id),
  });

  return Response.json(tokenRequest);
}
