// Design tokens for NewsSearch. Light theme only (per the design guidelines).
// Values come from /app/design_guidelines.json and the user's brand palette:
// oat sand #FDFBF7, deep charcoal #2C2A29, terracotta #C87965, olive #7D846C.
//
// The keys match the "color" block of /app/design_guidelines.json. Keep every
// key; do not add a second theme or colors file; do not write color literals
// in components.
//
// Styling: build sheets with makeStyles so colors and layout live together:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//   }));
// For color props that are not styles (icon color, placeholderTextColor) read
// useTheme().colors inside the component.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme, ViewStyle, TextStyle, ImageStyle } from "react-native";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FDFBF7",
  onSurface: "#2C2A29",
  surfaceSecondary: "#F4F0E8",
  onSurfaceSecondary: "#2C2A29",
  surfaceTertiary: "#EAE3D5",
  onSurfaceTertiary: "#2C2A29",
  surfaceInverse: "#2C2A29",
  onSurfaceInverse: "#FDFBF7",
  muted: "#76726E",

  // Brand
  brand: "#C87965",
  onBrand: "#FDFBF7",
  brandPrimary: "#C87965",
  onBrandPrimary: "#FDFBF7",
  brandSecondary: "#7D846C",
  onBrandSecondary: "#FDFBF7",
  brandTertiary: "#EAE3D5",
  onBrandTertiary: "#2C2A29",

  // Status (semantic only)
  success: "#7D846C",
  onSuccess: "#FDFBF7",
  warning: "#D4A373",
  onWarning: "#2C2A29",
  error: "#B65A45",
  onError: "#FDFBF7",
  info: "#7D846C",
  onInfo: "#FDFBF7",

  // Lines
  border: "#2C2A29",
  borderStrong: "#2C2A29",
  divider: "#EAE3D5",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// Typography: Nunito (user choice), bundled as static TTFs in assets/fonts.
export const fonts = {
  regular: "Nunito-Regular",
  semiBold: "Nunito-SemiBold",
  bold: "Nunito-Bold",
  extraBold: "Nunito-ExtraBold",
};

export const fontSizes = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// Sharp structural edges: zero radius everywhere (user choice).
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  pill: 0,
} as const;

export const defaultRadius = 0;

// In-app theme toggle: light-only app, so scheme is pinned.
export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
