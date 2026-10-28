import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

import { storage } from "@/src/utils/storage";

// Tolerate a project URL pasted with a path (e.g. /rest/v1/).
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/^(https?:\/\/[^/]+).*$/, "$1");
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Placeholder values keep the client constructible before real keys exist;
// auth calls simply fail until the project is configured.
export const supabase = createClient(
  supabaseUrl || "https://newssearch-not-configured.supabase.co",
  supabaseKey || "not-configured",
  {
    auth: {
      storage: {
        getItem: (key: string) => storage.getItem(key, null),
        setItem: async (key: string, value: string) => {
          await storage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          await storage.removeItem(key);
        },
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
