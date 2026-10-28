import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "url" | "email-address";
  testID: string;
  error?: string | null;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secureTextEntry = false,
  autoCapitalize = "none",
  keyboardType = "default",
  testID,
  error,
}: Props) {
  const [focused, setFocused] = useState(false);
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType === "url" ? "url" : keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, multiline && styles.multiline, focused && styles.focused]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  label: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.base,
    fontFamily: fonts.regular,
    color: colors.onSurface,
    minHeight: 48,
  },
  multiline: { minHeight: 132, textAlignVertical: "top", paddingTop: spacing.md },
  focused: { borderColor: colors.brandPrimary },
  error: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
}));
