import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { useAppStore } from '../storage/store'
import { 
  floatPlansApi, 
  boatsApi, 
  contactsApi, 
  inventoryApi, 
  tasksApi 
} from './supabase'
import type { SyncOperation } from '../types'

const MAX_RETRIES = 5
const BASE_DELAY = 1000 // 1 second

// Calculate exponential backoff delay
function getBackoffDelay(retryCount: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, retryCount), 30000) // Max 30 seconds
}

// Check if device is online
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch()
  return state.isConnected === true && state.isInternetReachable === true
}

// Subscribe to network state changes
export function subscribeToNetworkChanges(
  callback: (isConnected: boolean) => void
): () => void {
  return NetInfo.addEventListener((state: NetInfoState) => {
    const connected = state.isConnected === true && state.isInternetReachable === true
    callback(connected)
  })
}

// Process a single sync operation
async function processSyncOperation(op: SyncOperation): Promise<boolean> {
  try {
    const { endpoint, method, body, type } = op
    
    // Route to appropriate API based on endpoint pattern
    if (endpoint.startsWith('/float-plans')) {
      if (type === 'check_in') {
        const planId = endpoint.split('/')[2]
        await floatPlansApi.checkIn(planId)
      } else if (method === 'POST' && endpoint === '/float-plans') {
        await floatPlansApi.create(body)
      } else if (method === 'PUT') {
        const planId = endpoint.split('/')[2]
        await floatPlansApi.update(planId, body)
      } else if (method === 'DELETE') {
        const planId = endpoint.split('/')[2]
        await floatPlansApi.delete(planId)
      }
    } else if (endpoint.startsWith('/boats')) {
      if (method === 'POST') {
        await boatsApi.create(body)
      } else if (method === 'PUT') {
        const boatId = endpoint.split('/')[2]
        await boatsApi.update(boatId, body)
      } else if (method === 'DELETE') {
        const boatId = endpoint.split('/')[2]
        await boatsApi.delete(boatId)
      }
    } else if (endpoint.startsWith('/contacts')) {
      if (method === 'POST') {
        await contactsApi.create(body)
      } else if (method === 'PUT') {
        const contactId = endpoint.split('/')[2]
        await contactsApi.update(contactId, body)
      } else if (method === 'DELETE') {
        const contactId = endpoint.split('/')[2]
        await contactsApi.delete(contactId)
      }
    } else if (endpoint.startsWith('/inventory')) {
      if (method === 'POST') {
        await inventoryApi.create(body)
      } else if (method === 'PUT') {
        const itemId = endpoint.split('/')[2]
        await inventoryApi.update(itemId, body)
      } else if (method === 'DELETE') {
        const itemId = endpoint.split('/')[2]
        await inventoryApi.delete(itemId)
      }
    } else if (endpoint.startsWith('/tasks')) {
      if (method === 'POST') {
        await tasksApi.create(body)
      } else if (method === 'PUT') {
        const taskId = endpoint.split('/')[2]
        await tasksApi.update(taskId, body)
      } else if (method === 'DELETE') {
        const taskId = endpoint.split('/')[2]
        await tasksApi.delete(taskId)
      }
    }
    
    return true
  } catch (error) {
    console.error('Sync operation failed:', error)
    return false
  }
}

// Process all pending sync operations
export async function processPendingSync(): Promise<{ success: number; failed: number }> {
  const store = useAppStore.getState()
  const { pendingSync, removeSyncOperation, incrementRetryCount, setIsSyncing, setLastSyncAt } = store
  
  if (pendingSync.length === 0) {
    return { success: 0, failed: 0 }
  }

  const online = await isOnline()
  if (!online) {
    return { success: 0, failed: 0 }
  }

  setIsSyncing(true)
  
  let success = 0
  let failed = 0

  // Sort by creation time and prioritize check-ins
  const sortedOps = [...pendingSync].sort((a, b) => {
    // Check-ins first
    if (a.type === 'check_in' && b.type !== 'check_in') return -1
    if (b.type === 'check_in' && a.type !== 'check_in') return 1
    // Then by creation time
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  for (const op of sortedOps) {
    if (op.retryCount >= MAX_RETRIES) {
      // Too many retries, remove from queue
      removeSyncOperation(op.id)
      failed++
      continue
    }

    const result = await processSyncOperation(op)
    
    if (result) {
      removeSyncOperation(op.id)
      success++
    } else {
      incrementRetryCount(op.id)
      failed++
      
      // Wait before next operation if this one failed
      await new Promise(resolve => setTimeout(resolve, getBackoffDelay(op.retryCount)))
    }
  }

  setLastSyncAt(new Date().toISOString())
  setIsSyncing(false)

  return { success, failed }
}

// Sync all data from server
export async function syncAllData(): Promise<void> {
  const store = useAppStore.getState()
  const online = await isOnline()
  
  if (!online) {
    return
  }

  store.setIsSyncing(true)

  try {
    // Fetch all data in parallel
    const [floatPlans, boats, contacts, inventory, tasks] = await Promise.all([
      floatPlansApi.getAll().catch(() => []),
      boatsApi.getAll().catch(() => []),
      contactsApi.getAll().catch(() => []),
      inventoryApi.getAll().catch(() => []),
      tasksApi.getAll().catch(() => []),
    ])

    // Update store with fetched data
    store.setFloatPlans(floatPlans)
    store.setBoats(boats)
    store.setContacts(contacts)
    store.setInventory(inventory)
    store.setTasks(tasks)
    store.setLastSyncAt(new Date().toISOString())
  } catch (error) {
    console.error('Sync all data failed:', error)
  } finally {
    store.setIsSyncing(false)
  }
}

// Initialize sync service - call on app start
export function initializeSyncService(): () => void {
  // Process any pending operations on startup
  processPendingSync()

  // Subscribe to network changes
  const unsubscribe = subscribeToNetworkChanges(async (isConnected) => {
    if (isConnected) {
      // Process pending sync when coming back online
      await processPendingSync()
    }
  })

  return unsubscribe
}
