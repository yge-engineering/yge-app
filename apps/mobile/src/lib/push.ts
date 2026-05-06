// Push-notification registration. On first sign-in, asks for permission,
// gets the Expo push token, and POSTs it to /api/push-tokens for the
// signed-in user. The API stores the token; sending notifications happens
// server-side via expo-server-sdk.

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { postJson } from './api';

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) {
    return null; // simulator can't register
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const ask = await Notifications.requestPermissionsAsync();
    status = ask.status;
  }
  if (status !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'YGE',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#0a3a6b',
    });
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync();
    token = result.data;
  } catch {
    return null;
  }

  // Best-effort: tell the API. If the endpoint doesn't exist yet, ignore.
  try {
    await postJson('/api/push-tokens', { token, platform: Platform.OS });
  } catch {
    // not yet wired server-side; that's fine
  }
  return token;
}

export function useForegroundNotificationDisplay() {
  // Make notifications still show as banners while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
