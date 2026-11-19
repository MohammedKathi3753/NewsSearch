import { useEffect } from "react";
import { ActivityIndicator, LogBox, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { QueryClientProvider } from "@tanstack/react-query";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { queryClient } from "@/src/query-client";
import { SessionProvider } from "@/src/hooks/useSession";
import { LocaleProvider } from "@/src/i18n";
import { fonts, fontSizes } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

SplashScreen.preventAutoHideAsync().catch(() => {});

function BootSplash() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashTitle}>NewsSearch</Text>
      <Text style={styles.splashTagline}>Hybrid fake news analysis</Text>
      <ActivityIndicator size="small" color="#C87965" />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Nunito-Regular": require("../assets/fonts/Nunito-Regular.ttf"),
    "Nunito-SemiBold": require("../assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("../assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("../assets/fonts/Nunito-ExtraBold.ttf"),
    ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app. GestureHandlerRootView must wrap the whole tree
  // or any gesture/swipe/drawer screen crashes in Expo Go.
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <LocaleProvider>
            <SessionProvider>
              <StatusBar style="dark" />
              {fontsLoaded ? (
                <ToastProvider>
                  <Stack screenOptions={{ headerShown: false }} />
                </ToastProvider>
              ) : (
                <BootSplash />
              )}
            </SessionProvider>
            </LocaleProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  splashTitle: {
    fontFamily: fonts.extraBold,
    fontSize: fontSizes.xxl,
    color: "#2C2A29",
  },
  splashTagline: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: "#76726E",
  },
});
