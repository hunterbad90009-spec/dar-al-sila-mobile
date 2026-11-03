/**
 * Compatibility layer: keeps the original `trpc.<router>.<procedure>.useQuery/useMutation`
 * API used by every screen, but each procedure now calls Supabase directly (lib/data.ts).
 * No custom server is needed.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import * as data from "@/lib/data";

/** Errors carry an optional tRPC-style `data.code` (e.g. "CONFLICT") so screens can branch on it. */
export type AppError = Error & { data?: { code?: string } };
type QueryOpts<O> = Omit<UseQueryOptions<O, AppError, O>, "queryKey" | "queryFn">;
type MutationOpts<I, O> = Omit<UseMutationOptions<O, AppError, I>, "mutationFn">;

function query<I, O>(path: [string, string], fn: (input: I) => Promise<O>) {
  return {
    useQuery: (input?: I, options?: QueryOpts<O>) =>
      useQuery<O, AppError, O>({ queryKey: [...path, input ?? null], queryFn: () => fn(input as I), ...options }),
  };
}

function mutation<I, O>(fn: (input: I) => Promise<O>) {
  return {
    useMutation: (options?: MutationOpts<I, O>) => useMutation<O, AppError, I>({ mutationFn: fn, ...options }),
  };
}

const noInput = <O,>(fn: () => Promise<O>) => (_input: void | undefined) => fn();

export const trpc = {
  auth: {
    permissions: query(["auth", "permissions"], noInput(data.getPermissions)),
    deleteAccount: mutation(noInput(data.deleteAccount)),
    logout: mutation(noInput(data.logout)),
  },
  admin: {
    listings: query(["admin", "listings"], data.adminListings),
    users: query(["admin", "users"], data.adminUsers),
    moderateListing: mutation(data.moderateListing),
  },
  media: {
    uploadForDraft: mutation(data.uploadForDraft),
    detachFromDraft: mutation(data.detachFromDraft),
  },
  chats: {
    list: query(["chats", "list"], noInput(data.listChats)),
    messages: query(["chats", "messages"], data.chatMessages),
    start: mutation(data.startChat),
    send: mutation(data.sendChat),
  },
  stores: {
    list: query(["stores", "list"], noInput(data.listStores)),
    get: query(["stores", "get"], data.getStore),
    myProducts: query(["stores", "myProducts"], noInput(data.getMyProducts)),
    createProduct: mutation(data.createProduct),
    updateProduct: mutation(data.updateProduct),
    deleteProduct: mutation(data.deleteProduct),
  },
  listings: {
    list: query(["listings", "list"], data.listPublicListings),
    get: query(["listings", "get"], data.getPublicListing),
    myListings: query(["listings", "myListings"], noInput(data.getMyListings)),
    saved: query(["listings", "saved"], noInput(data.getSavedListings)),
    recentViews: query(["listings", "recentViews"], noInput(data.getRecentViews)),
    recordView: mutation(data.recordView),
    save: mutation(data.saveListing),
    unsave: mutation(data.unsaveListing),
    rate: mutation(data.rateListing),
    createDraft: mutation(data.createDraft),
    updateDraft: mutation(data.updateDraft),
    submitDraft: mutation(data.submitDraft),
    deleteDraft: mutation(data.deleteDraft),
  },
  account: {
    notifications: query(["account", "notifications"], noInput(data.getNotifications)),
    markNotificationRead: mutation(data.markNotificationRead),
    followedUsers: query(["account", "followedUsers"], noInput(data.getFollowedUsers)),
    follow: mutation(data.followUser),
    unfollow: mutation(data.unfollowUser),
  },
  reports: {
    create: mutation(data.createReport),
    adminList: query(["reports", "adminList"], noInput(data.adminReports)),
    adminUpdate: mutation(data.adminUpdateReport),
  },
  moderation: {
    checkImage: mutation(data.checkImage),
    checkListing: mutation(data.checkListing),
  },
  /** Mirrors tRPC's `useUtils()`: `utils.listings.myListings.invalidate()`. */
  useUtils() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const client = useQueryClient();
    return new Proxy({} as Record<string, Record<string, { invalidate: (input?: unknown) => Promise<void> }>>, {
      get: (_target, routerName: string) =>
        new Proxy({}, {
          get: (_inner, procedureName: string) => ({
            invalidate: (input?: unknown) =>
              client.invalidateQueries({ queryKey: input === undefined ? [routerName, procedureName] : [routerName, procedureName, input] }),
          }),
        }),
    });
  },
};
