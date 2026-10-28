import { Pressable, Text } from "react-native";

import { fonts, makeStyles } from "@/src/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID: string;
};

export function Chip({ label, selected = false, onPress, testID }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
    >
      <Text style={[styles.label, selected ? styles.selectedLabel : styles.unselectedLabel]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  chip: {
    height: 36,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
  },
  selected: { borderColor: colors.border, backgroundColor: colors.brandTertiary },
  unselected: { borderColor: colors.divider, backgroundColor: colors.surface },
  label: { fontFamily: fonts.semiBold, fontSize: 13 },
  selectedLabel: { color: colors.onSurface },
  unselectedLabel: { color: colors.muted },
}));
