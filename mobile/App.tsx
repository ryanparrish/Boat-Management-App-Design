import React, { useEffect, useRef } from 'react'
import { StatusBar, LogBox, AppState, AppStateStatus } from 'react-native'
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import * as Notifications from 'expo-notifications'
import NetInfo from '@react-native-community/netinfo'

// Suppress ALL logs in development (network errors are expected when offline)
LogBox.ignoreAllLogs(true)

// Override console.error to filter out network errors
const originalConsoleError = console.error
console.error = (...args: any[]) => {
  const message = args[0]?.toString?.() || ''
  if (
    message.includes('Network request failed') ||
    message.includes('AuthRetryableFetchError') ||
    message.includes('TypeError: Network request failed')
  ) {
    // Silently ignore network errors
    return
  }
  originalConsoleError(...args)
}

import {
  AuthScreen,
  Dashboard,
  FloatPlansList,
  FloatPlanDetail,
  CreateFloatPlan,
  BoatsManager,
  ContactsManager,
  InventoryList,
  SeasonalTasks,
  HouseholdManager,
  BoatDevices,
  BoatDocuments,
  BuoyMap,
  BuoyDetail,
  TideStationDetail,
  WeatherDashboard,
  WeatherSettings,
} from './src/screens'
import { useAppStore } from './src/storage/store'
import { initializeSyncService, syncAllData } from './src/services/sync'
import {
  setupNotificationChannel,
  getPlanIdFromNotification,
  getNotificationTypeFromData,
  triggerMarineAlert,
  triggerPressureDropAlert,
} from './src/services/notifications'
import {
  fetchAlertsForZones,
  checkPressureDrop,
  shouldNotifyForAlert,
} from './src/services/weather'
import { fetchObservation } from './src/services/ndbc'
import { colors } from './src/theme'
import type { RootStackParamList } from './src/types'

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const Stack = createStackNavigator<RootStackParamList>()

const linking = {
  prefixes: ['floatplan://'],
  config: {
    screens: {
      FloatPlanDetail: 'plan/:id',
      Dashboard: 'dashboard',
    },
  },
}

function AppNavigator() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null)
  const appStateRef = useRef(AppState.currentState)

  const {
    user,
    cleanupExpiredData,
    setFloatPlans,
    setBoats,
    setContacts,
    setInventory,
    setTasks,
    subscribedZones,
    weatherAlertSettings,
    monitoredBuoyId,
    ndbcStations,
    lastAlertCheck,
    setLastAlertCheck,
    setCachedAlerts,
    addPressureReading,
  } = useAppStore((s) => ({
    user: s.user,
    cleanupExpiredData: s.cleanupExpiredData,
    setFloatPlans: s.setFloatPlans,
    setBoats: s.setBoats,
    setContacts: s.setContacts,
    setInventory: s.setInventory,
    setTasks: s.setTasks,
    subscribedZones: s.subscribedZones,
    weatherAlertSettings: s.weatherAlertSettings,
    monitoredBuoyId: s.monitoredBuoyId,
    ndbcStations: s.ndbcStations,
    lastAlertCheck: s.lastAlertCheck,
    setLastAlertCheck: s.setLastAlertCheck,
    setCachedAlerts: s.setCachedAlerts,
    addPressureReading: s.addPressureReading,
  }))

  // Check if device is online before making network requests
  const isOnline = async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch()
      return state.isConnected === true && state.isInternetReachable === true
    } catch {
      return false
    }
  }

  // Check weather alerts on app open/foreground
  const checkWeatherAlerts = async () => {
    if (subscribedZones.length === 0) return
    
    // Check network before making requests
    if (!(await isOnline())) return
    
    const now = Date.now()
    // Don't check more often than every 15 minutes
    if (lastAlertCheck) {
      const lastCheckTime = new Date(lastAlertCheck).getTime()
      if (now - lastCheckTime < 15 * 60 * 1000) return
    }
    
    try {
      const zoneIds = subscribedZones.map(z => z.id)
      const alerts = await fetchAlertsForZones(zoneIds)
      
      // Cache all alerts as flat array
      setCachedAlerts(alerts)
      
      // Trigger notifications for new alerts that match user preferences
      for (const alert of alerts) {
        if (shouldNotifyForAlert(alert, weatherAlertSettings)) {
          const zoneNames = subscribedZones
            .filter(z => alert.affectedZones.includes(z.id))
            .map(z => z.name)
            .join(', ')
          triggerMarineAlert(alert.event, alert.headline, zoneNames)
        }
      }
      
      setLastAlertCheck(new Date().toISOString())
    } catch {
      // Silently ignore all errors
    }
  }
  
  // Check pressure for monitored buoy
  const checkBuoyPressure = async () => {
    if (!monitoredBuoyId || !weatherAlertSettings.pressureDrop) return
    
    // Check network before making requests
    if (!(await isOnline())) return
    
    const station = ndbcStations.find(s => s.id === monitoredBuoyId)
    if (!station) return
    
    try {
      const obs = await fetchObservation(monitoredBuoyId, station.coopsId)
      if (!obs?.PRES) return
      
      const pressure = parseFloat(obs.PRES)
      if (isNaN(pressure)) return
      
      // Add to pressure history
      addPressureReading(monitoredBuoyId, {
        timestamp: new Date().toISOString(),
        pressure,
        stationId: monitoredBuoyId,
      })
      
      // Get pressure history for this specific station
      const pressureHistory = useAppStore.getState().pressureHistory[monitoredBuoyId] || []
      const result = checkPressureDrop(
        pressureHistory,
        weatherAlertSettings.pressureDropThreshold
      )
      
      if (result.hasSignificantDrop) {
        triggerPressureDropAlert(
          station.name,
          result.dropAmount,
          result.hoursAgo
        )
      }
    } catch {
      // Silently ignore all errors
    }
  }

  useEffect(() => {
    // Setup notification channel for Android
    setupNotificationChannel()

    // Start network sync listener
    const stopSync = initializeSyncService()

    // Cleanup expired data on launch
    cleanupExpiredData()

    // If user is logged in, sync data from server (syncAllData already checks network)
    if (user) {
      syncAllData().catch(() => {
        // Silently ignore sync errors on startup
      })
    }
    
    // Check weather on app launch (these already check network internally)
    checkWeatherAlerts()
    checkBuoyPressure()
    
    // Listen for app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground - check weather
        checkWeatherAlerts()
        checkBuoyPressure()
      }
      appStateRef.current = nextAppState
    })

    return () => {
      stopSync()
      subscription.remove()
    }
  }, [user])

  useEffect(() => {
    // Handle notification tap when app is in background (warm start)
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const notificationType = getNotificationTypeFromData(response.notification)
        
        if (notificationType === 'marine_alert' || notificationType === 'pressure_drop') {
          // Navigate to weather dashboard for weather-related notifications
          if (navigationRef.current) {
            navigationRef.current.navigate('WeatherDashboard')
          }
        } else {
          const planId = getPlanIdFromNotification(response.notification)
          if (planId && navigationRef.current) {
            navigationRef.current.navigate('FloatPlanDetail', { id: planId })
          }
        }
      })

    // Check if app was opened from a notification (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const notificationType = getNotificationTypeFromData(response.notification)
        
        if (notificationType === 'marine_alert' || notificationType === 'pressure_drop') {
          setTimeout(() => {
            navigationRef.current?.navigate('WeatherDashboard')
          }, 500)
        } else {
          const planId = getPlanIdFromNotification(response.notification)
          if (planId) {
            // Small delay to ensure navigation is ready
            setTimeout(() => {
              navigationRef.current?.navigate('FloatPlanDetail', { id: planId })
            }, 500)
          }
        }
      }
    })

    return () => {
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove()
      }
    }
  }, [])

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.skyBlue,
          },
          headerTintColor: colors.textInverse,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerBackTitleVisible: false,
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Dashboard"
              component={Dashboard}
              options={{ title: 'Float Plan Safety' }}
            />
            <Stack.Screen
              name="FloatPlansList"
              component={FloatPlansList}
              options={{ title: 'Float Plans' }}
            />
            <Stack.Screen
              name="FloatPlanDetail"
              component={FloatPlanDetail}
              options={{ title: 'Float Plan Details' }}
            />
            <Stack.Screen
              name="CreateFloatPlan"
              component={CreateFloatPlan}
              options={({ route }) => ({
                title: route.params?.editPlan ? 'Edit Float Plan' : 'New Float Plan',
              })}
            />
            <Stack.Screen
              name="BoatsManager"
              component={BoatsManager}
              options={{ title: 'My Boats' }}
            />
            <Stack.Screen
              name="ContactsManager"
              component={ContactsManager}
              options={{ title: 'Emergency Contacts' }}
            />
            <Stack.Screen
              name="InventoryList"
              component={InventoryList}
              options={{ title: 'Safety Inventory' }}
            />
            <Stack.Screen
              name="SeasonalTasks"
              component={SeasonalTasks}
              options={{ title: 'Seasonal Tasks' }}
            />
            <Stack.Screen
              name="HouseholdManager"
              component={HouseholdManager}
              options={{ title: 'My Household' }}
            />
            <Stack.Screen
              name="BoatDevices"
              component={BoatDevices}
              options={({ route }) => ({
                title: `${route.params.boatName} - Devices`,
              })}
            />
            <Stack.Screen
              name="BoatDocuments"
              component={BoatDocuments}
              options={({ route }) => ({
                title: `${route.params.boatName} - Documents`,
              })}
            />
            <Stack.Screen
              name="BuoyMap"
              component={BuoyMap}
              options={{ title: 'Marine Stations' }}
            />
            <Stack.Screen
              name="BuoyDetail"
              component={BuoyDetail}
              options={({ route }) => ({
                title: route.params.stationName,
              })}
            />
            <Stack.Screen
              name="TideStationDetail"
              component={TideStationDetail}
              options={({ route }) => ({
                title: route.params.stationName,
              })}
            />
            <Stack.Screen
              name="WeatherDashboard"
              component={WeatherDashboard}
              options={{ title: 'Marine Weather' }}
            />
            <Stack.Screen
              name="WeatherSettings"
              component={WeatherSettings}
              options={{ title: 'Weather Settings' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.skyBlue} />
      <AppNavigator />
    </>
  )
}
