import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type TextIconName =
  | 'home'
  | 'sync'
  | 'call'
  | 'whatsapp'
  | 'location'
  | 'scan'
  | 'chart'
  | 'clipboard'
  | 'clock'
  | 'check'
  | 'close'
  | 'percent'
  | 'play'
  | 'refresh'
  | 'eye'
  | 'half'
  | 'alert';

type VectorIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_NAMES: Record<TextIconName, VectorIconName> = {
  home: 'home-outline',
  sync: 'sync',
  call: 'phone-outline',
  whatsapp: 'whatsapp',
  location: 'map-marker-outline',
  scan: 'barcode-scan',
  chart: 'chart-box-outline',
  clipboard: 'clipboard-text-outline',
  clock: 'clock-outline',
  check: 'check-bold',
  close: 'close-thick',
  percent: 'percent-outline',
  play: 'play-circle-outline',
  refresh: 'refresh',
  eye: 'eye-outline',
  half: 'fraction-one-half',
  alert: 'alert-outline',
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
  return <MaterialCommunityIcons name={ICON_NAMES[name]} size={size} color={color} />;
}
