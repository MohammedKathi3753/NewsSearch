import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";

import { AppButton } from "@/src/components/AppButton";
import { AppHeader, Screen } from "@/src/components/Screen";
import { TextField } from "@/src/components/TextField";
import { useSession } from "@/src/hooks/useSession";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { t } from "@/src/i18n";

export default function SignInScreen() {
  const { configured, signIn } = useSession();
  const router = useRouter();
  const styles = useStyles();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace("/analyze");
  };

  return (
    <View style={styles.root}>
      <AppHeader title={t("common.appName")} />
      <Screen mode="form" withTopInset={false} fullScreen testID="sign-in-screen">
        <Text style={styles.tagline}>{t("common.tagline")}</Text>
        {!configured ? (
          <View style={styles.warnBanner} testID="signin-not-configured-banner">
            <Text style={styles.bannerTitle}>{t("auth.notConfiguredTitle")}</Text>
            <Text style={styles.bannerBody}>{t("auth.notConfiguredBody")}</Text>
          </View>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.title}>{t("auth.signInTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.signInSubtitle")}</Text>
          {error ? (
            <View style={styles.errorBanner} testID="signin-error-banner">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.stack}>
            <TextField
              label={t("auth.emailLabel")}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              testID="signin-email-input"
            />
            <TextField
              label={t("auth.passwordLabel")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              testID="signin-password-input"
            />
            <AppButton
              label={loading ? t("auth.signInSubmitting") : t("auth.signInButton")}
              loading={loading}
              onPress={submit}
              testID="signin-submit-button"
            />
          </View>
          <Link href="/sign-up" replace asChild>
            <Pressable testID="signin-signup-link">
              <Text style={styles.link}>{t("auth.switchToSignUp")}</Text>
            </Pressable>
          </Link>
        </View>
        <View style={styles.legalBlock}>
          <Text style={styles.legalPrompt}>{t("auth.termsPrompt")}</Text>
          <View style={styles.legalLinks}>
            <Link href="/terms" asChild>
              <Pressable testID="signin-terms-link">
                <Text style={styles.legalLink}>{t("settings.terms")}</Text>
              </Pressable>
            </Link>
            <Link href="/privacy" asChild>
              <Pressable testID="signin-privacy-link">
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
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted, marginTop: -spacing.sm },
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
