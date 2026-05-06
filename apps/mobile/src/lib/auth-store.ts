// AsyncStorage-backed session token + user info.

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'yge.mobile.authToken';
const USER_KEY = 'yge.mobile.authUser';

export interface AuthUser {
  email: string;
  name?: string;
}

export async function readAuth(): Promise<{
  token: string | null;
  user: AuthUser | null;
}> {
  try {
    const [token, userJson] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    let user: AuthUser | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson) as AuthUser;
      } catch {}
    }
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export async function writeAuth(token: string, user: AuthUser): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export async function clearAuth(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  } catch {}
}
