import { Platform } from "react-native";

// iOS 26+ renders true native bottom tabs (liquid glass). Everything else —
// older iOS, Android, web — falls back to the classic JS tab bar.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
