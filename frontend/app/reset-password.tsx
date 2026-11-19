import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { Link, useRouter } from "expo-router";

import { AppButton } from "@/src/components/AppButton";
import { AppHeader, Screen } from "@/src/components/Screen";
import { TextField } from "@/src/components/TextField";
import { useToast } from "@/src/components/Toast";
import { initialAuthUrl, supabase } from "@/src/lib/supabase";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";

function paramsFrom(url: string) {
  const [, rest = ""] = url.split("?");
  const [query = "", hash = ""] = rest.includes("#") ? rest.split("#") : [rest, url.split("#")[1] ?? ""];
  const all = new URLSearchParams(`${query}&${hash || (url.split("#")[1] ?? "")}`);
  return {
    code: all.get("code"),
    access_token: all.get("access_token"),
    refresh_token: all.get("refresh_token"),
    error: all.get("error_description") || all.get("error"),
  };
}

export default function ResetPasswordScreen() {
  useLocale();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const styles = useStyles();
  const [state, setState] = useState<"waiting" | "ready" | "invalid">("waiting");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && mounted) setState("ready");
    });

    const consume = async (url: string | null) => {
      if (!url || handled.current.has(url)) return;
      handled.current.add(url);
      const p = paramsFrom(url);
      try {
        if (p.error) throw new Error(p.error);
        if (p.access_token && p.refresh_token) {
          const { error: e } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
          if (e) throw e;
        } else if (p.code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(p.code);
          if (e) throw e;
        }
        const { data } = await supabase.auth.getSession();
        if (mounted) setState(data.session ? "ready" : "invalid");
      } catch {
        if (mounted) setState("invalid");
      }
    };

    if (Platform.OS === "web") {
      // supabase-js already parsed the recovery link on startup; inspect what it saw.
      const url = initialAuthUrl ?? "";
      const p = paramsFrom(url);
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (p.error) setState("invalid");
        else if (data.session && (url.includes("type=recovery") || p.code)) setState("ready");
        else setState((s) => (s === "ready" ? s : "invalid"));
      }, 800);
    } else {
      Linking.getInitialURL().then(consume);
    }
    const linkSub = Platform.OS !== "web" ? Linking.addEventListener("url", ({ url }) => consume(url)) : null;
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      linkSub?.remove();
    };
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 6) return setError(t("auth.passwordTooShort"));
    if (password !== confirm) return setError(t("auth.passwordMismatch"));
    setLoading(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (e) return setError(e.message);
    toast.showToast(t("reset.done"), "success");
    router.replace("/analyze");
  };

  return (
    <View style={styles.root}>
      <AppHeader title={t("reset.title")} onBack />
      <Screen mode="form" withTopInset={false} fullScreen testID="reset-password-screen">
        <View style={styles.card}>
          {state === "waiting" ? (
            <View style={styles.row}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={styles.body}>{t("reset.waiting")}</Text>
            </View>
          ) : state === "invalid" ? (
            <>
              <Text style={styles.body} testID="reset-invalid-message">
                {t("reset.invalid")}
              </Text>
              <Link href="/forgot-password" replace asChild>
                <Pressable testID="reset-request-new-link">
                  <Text style={styles.link}>{t("reset.requestNew")}</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              {error ? <Text style={styles.error} testID="reset-error">{error}</Text> : null}
              <TextField label={t("reset.newPassword")} value={password} onChangeText={setPassword} secureTextEntry testID="reset-password-input" />
              <TextField label={t("auth.confirmPasswordLabel")} value={confirm} onChangeText={setConfirm} secureTextEntry testID="reset-confirm-input" />
              <AppButton spaced label={t("reset.submit")} loading={loading} onPress={submit} testID="reset-submit-button" />
            </>
          )}
        </View>
      </Screen>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  card: { borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 22 },
  error: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.error },
  link: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface, textAlign: "center", textDecorationLine: "underline", paddingVertical: spacing.sm },
}));
