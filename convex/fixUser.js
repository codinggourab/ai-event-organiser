// convex/fixUser.js - Run once to reset
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";

export const resetFreeEvents = mutation({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      freeEventsCreated: 0,
    });

    return { success: true, userId: user._id };
  },
});