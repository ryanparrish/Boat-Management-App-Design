import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAppStore } from '../storage/store'
import { STORAGE_KEYS } from '../storage/mmkv'
import type { FloatPlan } from '../types'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// Setup Android notification channel
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('check-in-reminders', {
      name: 'Check-in Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0ea5e9',
    })
    
    // Weather alerts channel
    await Notifications.setNotificationChannelAsync('weather-alerts', {
      name: 'Marine Weather Alerts',
      description: 'Small craft advisories, gale warnings, and pressure drop alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#f59e0b',
    })
  }
}

// Check if we've already asked for permission
export async function hasAskedForPermission(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_ASKED)
  return value === 'true'
}

// Mark that we've asked for permission
export async function markPermissionAsked(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_ASKED, 'true')
}

// Request notification permissions (contextual - call on first float plan creation)
export async function requestNotificationPermission(): Promise<boolean> {
  await setupNotificationChannel()

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  
  if (existingStatus === 'granted') {
    return true
  }

  const { status } = await Notifications.requestPermissionsAsync()
  markPermissionAsked()
  
  return status === 'granted'
}

// Check current permission status
export async function getNotificationPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync()
  return status
}

// Schedule check-in reminder notifications for a float plan
export async function scheduleCheckInReminders(plan: FloatPlan): Promise<string[]> {
  const notificationIds: string[] = []
  const deadline = new Date(plan.checkInDeadline)
  const now = new Date()

  // Don't schedule if deadline is in the past
  if (deadline <= now) {
    return []
  }

  // Reminder 15 minutes before deadline
  const reminderTime = new Date(deadline.getTime() - 15 * 60 * 1000)
  if (reminderTime > now) {
    const reminderId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Check-in Reminder',
        body: `Your check-in for ${plan.vesselName} is due in 15 minutes`,
        data: { planId: plan.id, type: 'reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    })
    notificationIds.push(reminderId)
  }

  // Notification at exact deadline
  const deadlineId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 Check In Now',
      body: `Check-in deadline reached for ${plan.vesselName}. Tap to check in.`,
      data: { planId: plan.id, type: 'deadline' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: deadline,
    },
  })
  notificationIds.push(deadlineId)

  // Store notification IDs in the store for later cancellation
  useAppStore.getState().setNotificationIds(plan.id, notificationIds)

  return notificationIds
}

// Cancel all scheduled notifications for a float plan
export async function cancelCheckInReminders(planId: string): Promise<void> {
  const store = useAppStore.getState()
  const notificationIds = store.notificationIds[planId] || []

  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id)
  }

  store.clearNotificationIds(planId)
}

// Cancel all scheduled notifications
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
  
  // Clear all notification IDs from store
  const store = useAppStore.getState()
  Object.keys(store.notificationIds).forEach(planId => {
    store.clearNotificationIds(planId)
  })
}

// Get notification that was tapped to open the app (cold start)
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync()
}

// Add listener for notification taps (warm start)
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback)
}

// Add listener for received notifications (when app is open)
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback)
}

// Extract plan ID from notification
export function getPlanIdFromNotification(
  notification: Notifications.Notification
): string | null {
  const data = notification.request.content.data
  return data?.planId as string | null
}

// Trigger a marine weather alert notification
export async function triggerMarineAlert(
  event: string,
  headline: string,
  zoneNames: string[]
): Promise<string | null> {
  try {
    // Determine icon and title based on event type
    let emoji = '⚠️'
    if (event.toLowerCase().includes('gale')) {
      emoji = '🌊'
    } else if (event.toLowerCase().includes('storm')) {
      emoji = '⛈️'
    } else if (event.toLowerCase().includes('small craft')) {
      emoji = '🚤'
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${event}`,
        body: headline,
        data: { 
          type: 'marine_alert', 
          event,
          zones: zoneNames 
        },
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'weather-alerts' }),
      },
      trigger: null, // Immediate
    })
    
    return notificationId
  } catch (error) {
    console.error('Error triggering marine alert notification:', error)
    return null
  }
}

// Trigger a pressure drop alert notification
export async function triggerPressureDropAlert(
  stationName: string,
  dropAmount: number,
  hoursAgo: number
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📉 Rapid Pressure Drop Detected',
        body: `${stationName}: Pressure dropped ${dropAmount.toFixed(1)} hPa in ${hoursAgo.toFixed(1)} hours. Storm may be approaching.`,
        data: { 
          type: 'pressure_drop',
          stationName,
          dropAmount,
          hoursAgo
        },
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'weather-alerts' }),
      },
      trigger: null, // Immediate
    })
    
    return notificationId
  } catch (error) {
    console.error('Error triggering pressure drop notification:', error)
    return null
  }
}

// Extract notification type from notification data
export function getNotificationTypeFromData(
  data: Record<string, unknown>
): 'reminder' | 'deadline' | 'marine_alert' | 'pressure_drop' | 'unknown' {
  const type = data?.type as string | undefined
  if (type === 'reminder' || type === 'deadline' || type === 'marine_alert' || type === 'pressure_drop') {
    return type
  }
  return 'unknown'
}
