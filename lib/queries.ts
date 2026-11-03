/**
 * Shared React Query hooks: one cache for taxonomy, favorites and counters, so every
 * screen shows the same data and refreshes together.
 */
import { useNotificationPrefs } from "@/lib/notification-prefs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import * as data from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";

export const keys = {
  categories: ["categories"] as const,
  locations: ["locations"] as const,
  favorites: ["favorites"] as const,
  saved: ["saved"] as const,
  myListings: ["my-listings"] as const,
  listing: (id: string) => ["listing", id] as const,
  search: (filters: unknown) => ["search", filters] as const,
  conversations: ["conversations"] as const,
  messages: (id: string) => ["messages", id] as const,
  notifications: ["notifications"] as const,
  unread: ["unread"] as const,
  myStore: ["my-store"] as const,
  stores: (input: unknown) => ["stores", input] as const,
  store: (id: string) => ["store", id] as const,
};

export function useCategories() {
  const query = useQuery({ queryKey: keys.categories, queryFn: data.getCategories, staleTime: 30 * 60 * 1000 });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const top = useMemo(() => all.filter((c) => !c.parent_id), [all]);
  const childrenOf = (id: number | null) => all.filter((c) => c.parent_id === id);
  const byId = (id: number | null | undefined) => all.find((c) => c.id === id);
  const topOf = (id: number | null | undefined) => data.topCategory(all, id);
  return { ...query, all, top, childrenOf, byId, topOf };
}

export function useLocations() {
  const query = useQuery({ queryKey: keys.locations, queryFn: data.getLocations, staleTime: 60 * 60 * 1000 });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const governorates = useMemo(() => all.filter((l) => l.kind === "governorate"), [all]);
  const wilayatsOf = (id: number | null) => all.filter((l) => l.parent_id === id);
  const label = (id: number | null | undefined) => data.locationLabel(all, id);
  return { ...query, all, governorates, wilayatsOf, label };
}

/** Favorite ids for heart icons + a toggle that updates every screen at once. */
export function useFavorites() {
  const { isAuthenticated } = useAuth();
  const client = useQueryClient();
  const ids = useQuery({ queryKey: keys.favorites, queryFn: data.getFavoriteIds, enabled: isAuthenticated });
  const toggle = useMutation({
    mutationFn: data.toggleFavorite,
    onMutate: async ({ listingId, save }) => {
      const previous = client.getQueryData<Set<string>>(keys.favorites);
      const next = new Set(previous ?? []);
      if (save) next.add(listingId); else next.delete(listingId);
      client.setQueryData(keys.favorites, next);
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && client.setQueryData(keys.favorites, ctx.previous),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.favorites });
      void client.invalidateQueries({ queryKey: keys.saved });
    },
  });
  return { ids: ids.data ?? new Set<string>(), isSaved: (id: string) => Boolean(ids.data?.has(id)), toggle, isAuthenticated };
}

/** Unread messages + notifications for tab badges and header bells. */
export function useUnreadCounts() {
  const { isAuthenticated } = useAuth();
  const prefs = useNotificationPrefs();
  const query = useQuery({
    queryKey: [...keys.unread, prefs.messages, prefs.moderation],
    queryFn: async () => {
      const [messages, notifications] = await Promise.all([data.unreadMessageCount(), data.unreadNotificationCount({ messages: !prefs.messages, moderation: !prefs.moderation })]);
      return { messages, notifications };
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
  return query.data ?? { messages: 0, notifications: 0 };
}
