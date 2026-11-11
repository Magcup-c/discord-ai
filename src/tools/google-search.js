import { searchGoogleData } from "../integrations/google-oauth.js";

export async function googleSearch(args, context) {
  if (!context?.userId || !context?.env?.DB) {
    throw new Error("Google tools require a Discord user and database context");
  }
  if (typeof args.query !== "string" || !args.query.trim() || args.query.length > 200) {
    throw new Error("Invalid Google search query");
  }
  return searchGoogleData(args, context);
}
