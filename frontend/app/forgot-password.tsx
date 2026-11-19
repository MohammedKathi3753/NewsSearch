import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { Link } from "expo-router";

import { AppButton } from "@/src/components/AppButton";
import { AppHeader, Screen } from "@/src/components/Screen";
import { TextField } from "@/src/components/TextField";
import { supabase } from "@/src/lib/supabase";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";

export default function ForgotPasswordScreen() {
  useLocale();
  const styles = useStyles();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError(t("auth.emailLabel"));
      return;
    }
    setLoading(true);
    const redirectTo =
      Platform.OS === "web" && typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : Linking.createURL("reset-password");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    // Rate-limit errors are shown; everything else gets the same generic message (no account enumeration).
    if (resetError && resetError.status === 429) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <View style={styles.root}>
      <AppHeader title={t("forgot.title")} onBack />
      <Screen mode="form" withTopInset={false} fullScreen testID="forgot-password-screen">
        <View style={styles.card}>
          {sent ? (
            <Text style={styles.body} testID="forgot-sent-message">
              {t("forgot.sent")}
            </Text>
          ) : (
            <>
              <Text style={styles.body}>{t("forgot.body")}</Text>
              {error ? (
                <Text style={styles.error} testID="forgot-error">
                  {error}
                </Text>
              ) : null}
              <TextField
                label={t("auth.emailLabel")}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                testID="forgot-email-input"
              />
              <AppButton spaced label={t("forgot.submit")} loading={loading} onPress={submit} testID="forgot-submit-button" />
            </>
          )}
          <Link href="/sign-in" replace asChild>
            <Pressable testID="forgot-back-link">
              <Text style={styles.link}>{t("forgot.back")}</Text>
            </Pressable>
          </Link>
        </View>
      </Screen>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  card: { borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 22 },
  error: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.error },
  link: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.info, textAlign: "center" },
}));
