import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";

import { useSession } from "./useSession";

/** Redirects to sign-in when the session is missing (remembering where the
 * user was headed). Returns true when signed-in content may render. */
export function useAuthGuard() {
  const { initialized, user, configured } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (initialized && !user) {
      const next = pathname?.startsWith("/shared/") ? pathname : undefined;
      router.replace(next ? { pathname: "/sign-in", params: { next } } : "/sign-in");
    }
  }, [initialized, user, router, pathname]);

  return initialized && Boolean(user) && configured;
}
