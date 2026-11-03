import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser, type AppUser } from "@/lib/data";
import { supabase } from "@/lib/supabase";

type UseAuthOptions = {
  autoFetch?: boolean;
};

/** Same return shape as the original hook, backed by the Supabase session. */
export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setUser(await getCurrentUser());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch user"));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }
    void fetchUser();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void fetchUser();
    });
    return () => data.subscription.unsubscribe();
  }, [autoFetch, fetchUser]);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  return { user, loading, error, isAuthenticated, refresh: fetchUser, logout };
}
