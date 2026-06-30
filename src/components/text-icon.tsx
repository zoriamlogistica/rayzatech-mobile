import { StyleSheet, Text } from 'react-native';

type TextIconName =
  | 'home'
  | 'sync'
  | 'call'
  | 'whatsapp'
  | 'location'
  | 'scan';

const ICON_LABELS: Record<TextIconName, string> = {
  home: '⌂',
  sync: '↻',
  call: '☎',
  whatsapp: 'WA',
  location: '⌖',
  scan: '▣',
};

export function TextIcon({
  name,
  color = '#137333',
  size = 20,
}: {
  name: TextIconName;
  color?: string;
  size?: number;
}) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        styles.icon,
        {
          color,
          fontSize: size,
          lineHeight: size + 2,
        },
      ]}
    >
      {ICON_LABELS[name]}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontWeight: '900',
    textAlign: 'center',
  },
});
