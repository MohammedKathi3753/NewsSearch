import { Text, View } from "react-native";

import { AppHeader, Screen } from "@/src/components/Screen";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { getLegal, t, useLocale } from "@/src/i18n";

export default function TermsScreen() {
  useLocale();
  const styles = useStyles();
  return (
    <View style={styles.root} testID="terms-screen">
      <AppHeader title={t("terms.title")} onBack />
      <Screen withTopInset={false}>
        <View testID="terms-content">
          <Text style={styles.updated}>{t("legal.updated")}</Text>
          {getLegal("terms").map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              <Text style={styles.body}>{section.body}</Text>
            </View>
          ))}
        </View>
      </Screen>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  updated: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.muted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  heading: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface, marginBottom: spacing.xs },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurfaceSecondary, lineHeight: 23 },
}));
