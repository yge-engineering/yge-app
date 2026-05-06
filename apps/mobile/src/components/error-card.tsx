import { Pressable, Text, View } from 'react-native';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: Props) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
        marginBottom: 12,
      }}
    >
      <Text style={{ color: '#991b1b', fontSize: 14, fontWeight: '600' }}>⚠ {message}</Text>
      <Text style={{ color: '#991b1b', fontSize: 12, marginTop: 4 }}>
        Make sure the API is reachable from this device.
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: 10,
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#dc2626',
            backgroundColor: '#ffffff',
          }}
        >
          <Text style={{ color: '#991b1b', fontSize: 12, fontWeight: '700' }}>↻ Retry</Text>
        </Pressable>
      )}
    </View>
  );
}
