// convex/debug.js
import { internal } from "./_generated/api";
import { query } from "./_generated/server";

export const debugUser = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    return {
      id: user?._id,
      isPro: user?.isPro,
      freeEventsCreated: user?.freeEventsCreated,
      raw: user,
    };
  },
});