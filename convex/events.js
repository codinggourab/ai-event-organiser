
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    timezone: v.string(),
    locationType: v.union(v.literal("physical"), v.literal("online")),
    venue: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
    capacity: v.number(),
    ticketType: v.union(v.literal("free"), v.literal("paid")),
    ticketPrice: v.optional(v.number()),
    coverImage: v.optional(v.string()),
    themeColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ✅ Move try/catch to not swallow original error stack
   const user = await ctx.runQuery(api.users.getCurrentUser);

    if (!user) {
      throw new Error("User not found");
    }

    // ✅ Get Pro status from user document only
    const isPro = Boolean(user.isPro);
    const freeEventsCreated = user.freeEventsCreated ?? 0;

    // ✅ Enforce free tier limit
    if (!isPro && freeEventsCreated >= 999999) {
      throw new Error(
        "Free event limit reached. Please upgrade to Pro to create more events."
      );
    }

    // ✅ Enforce color restriction for free users
    const defaultColor = "#1e3a8a";
    // if (!isPro && args.themeColor && args.themeColor !== defaultColor) {
    //   throw new Error(
    //     "Custom theme colors are a Pro feature. Please upgrade to Pro."
    //   );
    // }

    const themeColor = isPro ? (args.themeColor ?? defaultColor) : defaultColor;

    const slug = args.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const eventId = await ctx.db.insert("events", {
      ...args,
      themeColor,
      slug: `${slug}-${Date.now()}`,
      organizerId: user._id,
      organizerName: user.name,
      registrationCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // ✅ Only increment counter for free users
    if (!isPro) {
      await ctx.db.patch(user._id, {
        freeEventsCreated: freeEventsCreated + 1,
      });
    }

    return eventId;
  },
});


export const deleteEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);

    if (!user) {
      throw new Error("User not found");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    if (event.organizerId !== user._id) {
      throw new Error("You are not authorized to delete this event");
    }

    // ✅ Delete all registrations for this event
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    for (const registration of registrations) {
      await ctx.db.delete(registration._id);
    }

    await ctx.db.delete(args.eventId);

    // ✅ FIX: Check user.isPro (not event.hasPro which doesn't exist)
    const isPro = user.isPro === true;
    const freeEventsCreated = user.freeEventsCreated ?? 0;

    if (!isPro && freeEventsCreated > 0) {
      await ctx.db.patch(user._id, {
        freeEventsCreated: freeEventsCreated - 1,
      });
    }

    return { success: true };
  },
});

export const getMyEvents = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);

    if (!user) {
      return [];
    }

    return await ctx.db
      .query("events")
      .withIndex("by_organizer", (q) =>
        q.eq("organizerId", user._id)
      )
      .collect();
  },
});
export const getEventById = query({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});
export const getEventBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_slug", (q) =>
        q.eq("slug", args.slug)
      )
      .unique();
  },
});