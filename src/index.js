import "./tools/index.js";
import { handleInteraction } from "./discord/interactions.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    if (url.pathname !== "/interactions") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "POST" }
      });
    }

    return handleInteraction(request, env, ctx);
  }
};
