// Caps content width on tablets to keep text columns readable.
// Phone screens render edge-to-edge.

import { useWindowDimensions, View } from 'react-native';
import type { ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenContent({ children, style }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  return (
    <View
      style={[
        { padding: 16, width: '100%' },
        isTablet && { maxWidth: 720, alignSelf: 'center' },
        style,
      ]}
    >
      {children}
    </View>
  );
}
