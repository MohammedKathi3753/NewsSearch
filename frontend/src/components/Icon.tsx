import Ionicons from "@react-native-vector-icons/ionicons";
import type { ComponentProps } from "react";

export function Icon(props: ComponentProps<typeof Ionicons>) {
  return <Ionicons {...props} />;
}

export type IconName = ComponentProps<typeof Ionicons>["name"];
