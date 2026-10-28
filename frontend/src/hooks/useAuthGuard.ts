import { useEffect } from "react";
import { useRouter } from "expo-router";

import { useSession } from "./useSession";

/** Redirects to sign-in when the session is missing. Returns true when the
 * signed-in user content may render/queries may run. */
export function useAuthGuard() {
  const { initialized, user, configured } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (initialized && !user) {
      router.replace("/sign-in");
    }
  }, [initialized, user, router]);

  return initialized && Boolean(user) && configured;
}
