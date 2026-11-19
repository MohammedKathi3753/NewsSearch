import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";

import { AppButton } from "@/src/components/AppButton";
import { AppHeader, Screen } from "@/src/components/Screen";
import { TextField } from "@/src/components/TextField";
import { useSession } from "@/src/hooks/useSession";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";

export default function SignUpScreen() {
  useLocale();
  const { configured, signUp } = useSession();
  const router = useRouter();
  const styles = useStyles();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and a password.");
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    const result = await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setNeedsConfirmation(true);
      return;
    }
    router.replace("/analyze");
  };

  return (
    <View style={styles.root}>
      <AppHeader title={t("common.appName")} />
      <Screen mode="form" withTopInset={false} fullScreen testID="sign-up-screen">
        <Text style={styles.tagline}>{t("common.tagline")}</Text>
        {!configured ? (
          <View style={styles.warnBanner} testID="signup-not-configured-banner">
            <Text style={styles.bannerTitle}>{t("auth.notConfiguredTitle")}</Text>
            <Text style={styles.bannerBody}>{t("auth.notConfiguredBody")}</Text>
          </View>
        ) : null}
        <View style={styles.card}>
          {needsConfirmation ? (
            <View style={styles.stack} testID="signup-check-email-view">
              <Text style={styles.title}>{t("auth.checkEmailTitle")}</Text>
              <Text style={styles.subtitle}>{t("auth.checkEmailBody")}</Text>
              <Link href="/sign-in" replace asChild>
                <Pressable testID="signup-back-to-signin-link">
                  <Text style={styles.link}>{t("auth.switchToSignIn")}</Text>
                </Pressable>
              </Link>
            </View>
          ) : (
            <View style={styles.stack}>
              <Text style={styles.title}>{t("auth.signUpTitle")}</Text>
              <Text style={styles.subtitle}>{t("auth.signUpSubtitle")}</Text>
              {error ? (
                <View style={styles.errorBanner} testID="signup-error-banner">
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <TextField
                label={t("auth.emailLabel")}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                testID="signup-email-input"
              />
              <TextField
                label={t("auth.passwordLabel")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="signup-password-input"
              />
              <TextField
                label={t("auth.confirmPasswordLabel")}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                testID="signup-confirm-password-input"
              />
              <AppButton
                label={loading ? t("auth.signUpSubmitting") : t("auth.signUpButton")}
                loading={loading}
                onPress={submit}
                testID="signup-submit-button"
              />
              <Link href="/sign-in" replace asChild>
                <Pressable testID="signup-signin-link">
                  <Text style={styles.link}>{t("auth.switchToSignIn")}</Text>
                </Pressable>
              </Link>
            </View>
          )}
        </View>
        <View style={styles.legalBlock}>
          <Text style={styles.legalPrompt}>{t("auth.termsPrompt")}</Text>
          <View style={styles.legalLinks}>
            <Link href="/terms" asChild>
              <Pressable testID="signup-terms-link">
                <Text style={styles.legalLink}>{t("settings.terms")}</Text>
              </Pressable>
            </Link>
            <Link href="/privacy" asChild>
              <Pressable testID="signup-privacy-link">
                <Text style={styles.legalLink}>{t("settings.privacy")}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </Screen>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  tagline: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontFamily: fonts.extraBold, fontSize: fontSizes.xl, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted },
  stack: { gap: spacing.md },
  link: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.info, textAlign: "center" },
  warnBanner: { borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.surfaceSecondary, padding: spacing.md },
  bannerTitle: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface },
  bannerBody: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.onSurfaceSecondary, lineHeight: 20, marginTop: spacing.xs },
  errorBanner: { borderWidth: 1, borderColor: colors.error, padding: spacing.md },
  errorText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.error },
  legalBlock: { marginTop: spacing.lg, gap: spacing.sm },
  legalPrompt: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, textAlign: "center" },
  legalLinks: { flexDirection: "row", justifyContent: "center", gap: spacing.lg },
  legalLink: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.info, textDecorationLine: "underline" },
}));
