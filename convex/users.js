import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Store or update user from Clerk
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (user !== null) {
      const updates = {};

      if (user.name !== identity.name) {
        updates.name = identity.name ?? "Anonymous";
      }
      if (user.email !== identity.email) {
        updates.email = identity.email ?? "";
      }
      if (user.imageUrl !== identity.pictureUrl) {
        updates.imageUrl = identity.pictureUrl;
      }
      if (user.isPro === undefined) {
        updates.isPro = false;
      }
      if (user.freeEventsCreated === undefined) {
        updates.freeEventsCreated = 0;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Date.now();
        await ctx.db.patch(user._id, updates);
      }

      return user._id;
    }

    // New user
    return await ctx.db.insert("users", {
      email: identity.email ?? "",
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? "Anonymous",
      imageUrl: identity.pictureUrl,
      hasCompletedOnboarding: false,
      isPro: false,
      freeEventsCreated: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ✅ FIXED: Added internalQuery import and cleaned up handler
export const getCurrentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    return user;
  },
});

// ✅ FIXED: Restored correct completeOnboarding logic
export const completeOnboarding = mutation({
  args: {
    location: v.object({
      city: v.string(),
      state: v.optional(v.string()),
      country: v.string(),
    }),
    interests: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      location: args.location,
      interests: args.interests,
      hasCompletedOnboarding: true,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

// ✅ Migration: Add isPro and freeEventsCreated to existing users
export const migrateAddProField = mutation({
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    let updated = 0;
    let skipped = 0;

    for (const user of allUsers) {
      if (user.isPro === undefined || user.freeEventsCreated === undefined) {
        await ctx.db.patch(user._id, {
          isPro: user.isPro ?? false,
          freeEventsCreated: user.freeEventsCreated ?? 0,
        });
        updated++;
        console.log(`Updated user: ${user.email}`);
      } else {
        skipped++;
      }
    }

    const message = `Migration complete: ${updated} users updated, ${skipped} already had fields`;
    console.log(message);

    return {
      success: true,
      message,
      updated,
      skipped,
    };
  },
});