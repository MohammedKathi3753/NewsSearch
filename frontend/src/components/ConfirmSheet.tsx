import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "./AppButton";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "solid";
  onConfirm: () => void;
  onCancel: () => void;
  testIDPrefix: string;
};

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  onCancel,
  testIDPrefix,
}: Props) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onCancel} testID={`${testIDPrefix}-backdrop`} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.notchBar} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.row}>
            <View style={styles.grow}>
              <AppButton
                label={cancelLabel ?? "Cancel"}
                onPress={onCancel}
                testID={`${testIDPrefix}-cancel-button`}
                variant="outline"
              />
            </View>
            <View style={styles.grow}>
              <AppButton
                label={confirmLabel}
                onPress={onConfirm}
                testID={`${testIDPrefix}-confirm-button`}
                variant={tone === "danger" ? "danger" : "solid"}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(44, 42, 41, 0.4)", justifyContent: "flex-end" },
  backdropPress: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  notchBar: { width: 36, height: 3, backgroundColor: colors.divider, marginBottom: spacing.md },
  title: { fontFamily: fonts.extraBold, fontSize: fontSizes.lg, color: colors.onSurface, marginBottom: spacing.sm },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted, lineHeight: 22, marginBottom: spacing.lg },
  row: { flexDirection: "row", gap: spacing.md },
  grow: { flex: 1 },
}));
