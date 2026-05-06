import { useWindowDimensions } from 'react-native';

/** Returns true when the screen is at least 768px wide (tablet/iPad). */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= 768;
}
