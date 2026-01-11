import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { supabaseUrl, publicAnonKey } from './config'
import { STORAGE_KEYS } from '../../storage/mmkv'

// Custom storage adapter for AsyncStorage (Supabase auth)
const asyncAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return AsyncStorage.getItem(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key)
  },
}

// Custom fetch that checks network before making requests
const networkAwareFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const state = await NetInfo.fetch()
    if (!state.isConnected || !state.isInternetReachable) {
      // Return a fake offline response instead of throwing
      throw new Error('Device is offline')
    }
  } catch {
    // If we can't check network, try the request anyway
  }
  
  return fetch(input, init)
}

// Create Supabase client with AsyncStorage for session persistence
export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    storage: asyncAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: networkAwareFetch,
  },
})

// Get current access token for API calls
export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
}

// Set access token after login
export async function setAccessToken(token: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token)
}

// Clear access token on logout
export async function clearAccessToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
}
