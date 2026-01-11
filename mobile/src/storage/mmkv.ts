/**
 * Storage layer using AsyncStorage (Expo Go compatible)
 * Note: For production with faster performance, use react-native-mmkv with a development build
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

// Helper functions for typed storage access
export const mmkvStorage = {
  getString: async (key: string): Promise<string | undefined> => {
    const value = await AsyncStorage.getItem(key)
    return value ?? undefined
  },
  
  setString: async (key: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(key, value)
  },
  
  getObject: async <T>(key: string): Promise<T | undefined> => {
    const value = await AsyncStorage.getItem(key)
    if (value) {
      try {
        return JSON.parse(value) as T
      } catch {
        return undefined
      }
    }
    return undefined
  },
  
  setObject: async <T>(key: string, value: T): Promise<void> => {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  },
  
  delete: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key)
  },
  
  clearAll: async (): Promise<void> => {
    await AsyncStorage.clear()
  },
  
  getAllKeys: async (): Promise<readonly string[]> => {
    return AsyncStorage.getAllKeys()
  },
}

// Storage keys
export const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  ACCESS_TOKEN: 'access_token',
  FLOAT_PLANS: 'float_plans',
  BOATS: 'boats',
  CONTACTS: 'contacts',
  INVENTORY: 'inventory',
  TASKS: 'tasks',
  PENDING_SYNC: 'pending_sync',
  LAST_SYNC_AT: 'last_sync_at',
  NOTIFICATION_IDS: 'notification_ids',
  NOTIFICATION_PERMISSION_ASKED: 'notification_permission_asked',
} as const

// Zustand persist storage adapter
export const zustandAsyncStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return AsyncStorage.getItem(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name)
  },
}

export default mmkvStorage
