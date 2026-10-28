import { Text, View } from "react-native";

import { AppButton } from "./AppButton";
import { Icon, type IconName } from "./Icon";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";

type Props = {
  icon?: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; testID: string };
};

export function EmptyState({ icon, title, body, action }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.container} testID="empty-state">
      {icon ? <Icon name={icon} size={28} color={colors.muted} /> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <AppButton label={action.label} onPress={action.onPress} testID={action.testID} variant="outline" />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "flex-start",
  },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.onSurface },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted, lineHeight: 22 },
}));
