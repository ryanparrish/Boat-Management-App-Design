import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandAsyncStorage } from './mmkv'
import type { 
  FloatPlan, 
  Boat, 
  Contact, 
  InventoryItem, 
  Task, 
  SyncOperation,
  UserProfile,
  Household,
  HouseholdMember,
  HouseholdInvite,
  BoatDevice,
  BoatDocument,
  NDBCStation,
  NDBCObservation,
  TideStation,
  TideObservation,
  SubscribedZone,
  MarineAlert,
  MarineForecast,
  WeatherAlertSettings,
  PressureReading,
  WindReading,
  TankLogEntry,
} from '../types'

// NDBC cache durations
const NDBC_STATIONS_CACHE_HOURS = 24
const NDBC_OBSERVATIONS_CACHE_MINUTES = 30

// CO-OPS cache durations
const COOPS_STATIONS_CACHE_HOURS = 24
const COOPS_OBSERVATIONS_CACHE_MINUTES = 15

// Tank log stale threshold
const TANK_LOG_STALE_HOURS = 24

// Weather/Marine cache durations
const WEATHER_ALERTS_CACHE_MINUTES = 15
const WEATHER_FORECAST_CACHE_MINUTES = 60
const PRESSURE_HISTORY_HOURS = 4 // Keep 4 hours of pressure readings

// Default weather alert settings
const DEFAULT_WEATHER_SETTINGS: WeatherAlertSettings = {
  smallCraftAdvisory: true,
  galeWarning: true,
  stormWarning: true,
  pressureDrop: true,
  pressureDropThreshold: 4,
}

// App state interface
interface AppState {
  // Auth
  user: UserProfile | null
  isAuthenticated: boolean
  rememberMe: boolean
  
  // Household
  household: Household | null
  householdMembers: HouseholdMember[]
  pendingInvites: HouseholdInvite[]
  
  // Data
  floatPlans: Record<string, FloatPlan>
  boats: Boat[]
  boatDevices: BoatDevice[]
  boatDocuments: BoatDocument[]
  contacts: Contact[]
  inventory: InventoryItem[]
  tasks: Task[]
  
  // Sync
  pendingSync: SyncOperation[]
  lastSyncAt: string | null
  isSyncing: boolean
  
  // Notifications
  notificationIds: Record<string, string[]>
  
  // NDBC Weather Buoys
  ndbcStations: NDBCStation[]
  ndbcObservations: Record<string, NDBCObservation>
  ndbcStationsLastFetch: string | null
  ndbcObservationsLastFetch: Record<string, string>
  
  // CO-OPS Tide Stations
  tideStations: TideStation[]
  tideObservations: Record<string, TideObservation>
  tideStationsLastFetch: string | null
  tideObservationsLastFetch: Record<string, string>
  
  // Marine Weather
  subscribedZones: SubscribedZone[]
  weatherAlertSettings: WeatherAlertSettings
  monitoredBuoyId: string | null
  cachedAlerts: MarineAlert[]
  cachedForecasts: Record<string, MarineForecast>
  pressureHistory: Record<string, PressureReading[]>
  windHistory: Record<string, WindReading[]>
  lastAlertCheck: string | null
  isGreatLakesUser: boolean
  pressureUnit: 'hPa' | 'mb'
  
  // Tank Logs
  tankLogs: TankLogEntry[]
  
  // Actions - Auth
  setUser: (user: UserProfile | null) => void
  setRememberMe: (remember: boolean) => void
  logout: () => void
  
  // Actions - Household
  setHousehold: (household: Household | null) => void
  setHouseholdMembers: (members: HouseholdMember[]) => void
  addHouseholdMember: (member: HouseholdMember) => void
  removeHouseholdMember: (memberId: string) => void
  setPendingInvites: (invites: HouseholdInvite[]) => void
  removeInvite: (inviteId: string) => void
  
  // Actions - Float Plans
  setFloatPlans: (plans: FloatPlan[]) => void
  addFloatPlan: (plan: FloatPlan) => void
  updateFloatPlan: (id: string, updates: Partial<FloatPlan>) => void
  deleteFloatPlan: (id: string) => void
  getFloatPlan: (id: string) => FloatPlan | undefined
  
  // Actions - Boats
  setBoats: (boats: Boat[]) => void
  addBoat: (boat: Boat) => void
  updateBoat: (id: string, updates: Partial<Boat>) => void
  deleteBoat: (id: string) => void
  
  // Actions - Boat Devices
  setBoatDevices: (devices: BoatDevice[]) => void
  addBoatDevice: (device: BoatDevice) => void
  updateBoatDevice: (id: string, updates: Partial<BoatDevice>) => void
  deleteBoatDevice: (id: string) => void
  
  // Actions - Boat Documents
  setBoatDocuments: (docs: BoatDocument[]) => void
  addBoatDocument: (doc: BoatDocument) => void
  updateBoatDocument: (id: string, updates: Partial<BoatDocument>) => void
  deleteBoatDocument: (id: string) => void
  
  // Actions - Contacts
  setContacts: (contacts: Contact[]) => void
  addContact: (contact: Contact) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
  deleteContact: (id: string) => void
  
  // Actions - Inventory
  setInventory: (items: InventoryItem[]) => void
  addInventoryItem: (item: InventoryItem) => void
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void
  deleteInventoryItem: (id: string) => void
  
  // Actions - Tasks
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  
  // Actions - Sync
  addSyncOperation: (op: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount'>) => void
  removeSyncOperation: (id: string) => void
  incrementRetryCount: (id: string) => void
  setIsSyncing: (syncing: boolean) => void
  setLastSyncAt: (timestamp: string) => void
  
  // Actions - Notifications
  setNotificationIds: (planId: string, ids: string[]) => void
  clearNotificationIds: (planId: string) => void
  
  // Actions - NDBC
  setNDBCStations: (stations: NDBCStation[]) => void
  setNDBCObservation: (stationId: string, observation: NDBCObservation) => void
  setNDBCObservations: (observations: Record<string, NDBCObservation>) => void
  isStationsCacheValid: () => boolean
  isObservationCacheValid: (stationId: string) => boolean
  
  // Actions - CO-OPS Tide Stations
  setTideStations: (stations: TideStation[]) => void
  setTideObservation: (stationId: string, observation: TideObservation) => void
  isTideStationsCacheValid: () => boolean
  isTideObservationCacheValid: (stationId: string) => boolean
  
  // Actions - Marine Weather
  setSubscribedZones: (zones: SubscribedZone[]) => void
  addSubscribedZone: (zone: SubscribedZone) => void
  removeSubscribedZone: (zoneId: string) => void
  setWeatherAlertSettings: (settings: WeatherAlertSettings) => void
  setMonitoredBuoyId: (buoyId: string | null) => void
  setCachedAlerts: (alerts: MarineAlert[]) => void
  setCachedForecast: (zoneId: string, forecast: MarineForecast) => void
  addPressureReading: (stationId: string, reading: PressureReading) => void
  addWindReading: (stationId: string, reading: WindReading) => void
  setLastAlertCheck: (timestamp: string) => void
  setIsGreatLakesUser: (isGreatLakes: boolean) => void
  setPressureUnit: (unit: 'hPa' | 'mb') => void
  isAlertsCacheValid: () => boolean
  isForecastCacheValid: (zoneId: string) => boolean
  
  // Actions - Tank Logs
  addTankLog: (entry: TankLogEntry) => void
  getTankLogsForBoat: (boatId: string) => TankLogEntry[]
  getLatestTankLog: (boatId: string) => TankLogEntry | null
  isTankLogStale: (boatId: string) => boolean
  updateBoatPhoto: (boatId: string, photoUri: string, photoUrl: string) => void
  
  // Actions - Data Cleanup
  cleanupExpiredData: (retentionDays?: number) => void
}

// 30 days retention
const RETENTION_DAYS = 30

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      rememberMe: true,
      household: null,
      householdMembers: [],
      pendingInvites: [],
      floatPlans: {},
      boats: [],
      boatDevices: [],
      boatDocuments: [],
      contacts: [],
      inventory: [],
      tasks: [],
      pendingSync: [],
      lastSyncAt: null,
      isSyncing: false,
      notificationIds: {},
      ndbcStations: [],
      ndbcObservations: {},
      ndbcStationsLastFetch: null,
      ndbcObservationsLastFetch: {},
      tideStations: [],
      tideObservations: {},
      tideStationsLastFetch: null,
      tideObservationsLastFetch: {},
      // Marine weather initial state
      subscribedZones: [],
      weatherAlertSettings: DEFAULT_WEATHER_SETTINGS,
      monitoredBuoyId: null,
      cachedAlerts: [],
      cachedForecasts: {},
      pressureHistory: {},
      windHistory: {},
      lastAlertCheck: null,
      isGreatLakesUser: false,
      pressureUnit: 'hPa',
      
      // Tank logs initial state
      tankLogs: [],

      // Auth actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setRememberMe: (remember) => set({ rememberMe: remember }),
      
      logout: () => set({
        user: null,
        isAuthenticated: false,
        household: null,
        householdMembers: [],
        pendingInvites: [],
        floatPlans: {},
        boats: [],
        boatDevices: [],
        boatDocuments: [],
        contacts: [],
        inventory: [],
        tasks: [],
        pendingSync: [],
        lastSyncAt: null,
        notificationIds: {},
      }),

      // Household actions
      setHousehold: (household) => set({ household }),
      setHouseholdMembers: (members) => set({ householdMembers: members }),
      addHouseholdMember: (member) => set((state) => ({
        householdMembers: [...state.householdMembers, member],
      })),
      removeHouseholdMember: (memberId) => set((state) => ({
        householdMembers: state.householdMembers.filter((m) => m.id !== memberId),
      })),
      setPendingInvites: (invites) => set({ pendingInvites: invites }),
      removeInvite: (inviteId) => set((state) => ({
        pendingInvites: state.pendingInvites.filter((i) => i.id !== inviteId),
      })),

      // Float Plan actions
      setFloatPlans: (plans) => {
        const planMap: Record<string, FloatPlan> = {}
        plans.forEach(p => { planMap[p.id] = p })
        set({ floatPlans: planMap })
      },
      
      addFloatPlan: (plan) => set((state) => ({
        floatPlans: { ...state.floatPlans, [plan.id]: plan }
      })),
      
      updateFloatPlan: (id, updates) => set((state) => {
        const existing = state.floatPlans[id]
        if (!existing) return state
        return {
          floatPlans: {
            ...state.floatPlans,
            [id]: { ...existing, ...updates, updatedAt: new Date().toISOString() }
          }
        }
      }),
      
      deleteFloatPlan: (id) => set((state) => {
        const { [id]: _, ...rest } = state.floatPlans
        return { floatPlans: rest }
      }),
      
      getFloatPlan: (id) => get().floatPlans[id],

      // Boat actions
      setBoats: (boats) => set({ boats }),
      
      addBoat: (boat) => set((state) => ({
        boats: [...state.boats, boat]
      })),
      
      updateBoat: (id, updates) => set((state) => ({
        boats: state.boats.map(b => 
          b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
        )
      })),
      
      deleteBoat: (id) => set((state) => ({
        boats: state.boats.filter(b => b.id !== id)
      })),

      // Boat Device actions
      setBoatDevices: (devices) => set({ boatDevices: devices }),
      
      addBoatDevice: (device) => set((state) => ({
        boatDevices: [...state.boatDevices, device]
      })),
      
      updateBoatDevice: (id, updates) => set((state) => ({
        boatDevices: state.boatDevices.map(d => 
          d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
        )
      })),
      
      deleteBoatDevice: (id) => set((state) => ({
        boatDevices: state.boatDevices.filter(d => d.id !== id)
      })),

      // Boat Document actions
      setBoatDocuments: (docs) => set({ boatDocuments: docs }),
      
      addBoatDocument: (doc) => set((state) => ({
        boatDocuments: [...state.boatDocuments, doc]
      })),
      
      updateBoatDocument: (id, updates) => set((state) => ({
        boatDocuments: state.boatDocuments.map(d => 
          d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
        )
      })),
      
      deleteBoatDocument: (id) => set((state) => ({
        boatDocuments: state.boatDocuments.filter(d => d.id !== id)
      })),

      // Contact actions
      setContacts: (contacts) => set({ contacts }),
      
      addContact: (contact) => set((state) => ({
        contacts: [...state.contacts, contact]
      })),
      
      updateContact: (id, updates) => set((state) => ({
        contacts: state.contacts.map(c => 
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        )
      })),
      
      deleteContact: (id) => set((state) => ({
        contacts: state.contacts.filter(c => c.id !== id)
      })),

      // Inventory actions
      setInventory: (items) => set({ inventory: items }),
      
      addInventoryItem: (item) => set((state) => ({
        inventory: [...state.inventory, item]
      })),
      
      updateInventoryItem: (id, updates) => set((state) => ({
        inventory: state.inventory.map(i => 
          i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
        )
      })),
      
      deleteInventoryItem: (id) => set((state) => ({
        inventory: state.inventory.filter(i => i.id !== id)
      })),

      // Task actions
      setTasks: (tasks) => set({ tasks }),
      
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, task]
      })),
      
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map(t => 
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        )
      })),
      
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id)
      })),

      // Sync actions
      addSyncOperation: (op) => set((state) => ({
        pendingSync: [
          ...state.pendingSync,
          {
            ...op,
            id: `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            createdAt: new Date().toISOString(),
            retryCount: 0,
          }
        ]
      })),
      
      removeSyncOperation: (id) => set((state) => ({
        pendingSync: state.pendingSync.filter(op => op.id !== id)
      })),
      
      incrementRetryCount: (id) => set((state) => ({
        pendingSync: state.pendingSync.map(op =>
          op.id === id ? { ...op, retryCount: op.retryCount + 1 } : op
        )
      })),
      
      setIsSyncing: (syncing) => set({ isSyncing: syncing }),
      
      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

      // Notification actions
      setNotificationIds: (planId, ids) => set((state) => ({
        notificationIds: { ...state.notificationIds, [planId]: ids }
      })),
      
      clearNotificationIds: (planId) => set((state) => {
        const { [planId]: _, ...rest } = state.notificationIds
        return { notificationIds: rest }
      }),

      // NDBC actions
      setNDBCStations: (stations) => set({ 
        ndbcStations: stations,
        ndbcStationsLastFetch: new Date().toISOString()
      }),
      
      setNDBCObservation: (stationId, observation) => set((state) => ({
        ndbcObservations: { ...state.ndbcObservations, [stationId]: observation },
        ndbcObservationsLastFetch: { 
          ...state.ndbcObservationsLastFetch, 
          [stationId]: new Date().toISOString() 
        }
      })),
      
      setNDBCObservations: (observations) => set((state) => {
        const now = new Date().toISOString()
        const timestamps: Record<string, string> = {}
        Object.keys(observations).forEach(id => {
          timestamps[id] = now
        })
        return {
          ndbcObservations: { ...state.ndbcObservations, ...observations },
          ndbcObservationsLastFetch: { ...state.ndbcObservationsLastFetch, ...timestamps }
        }
      }),
      
      isStationsCacheValid: () => {
        const lastFetch = get().ndbcStationsLastFetch
        if (!lastFetch) return false
        const cacheAge = Date.now() - new Date(lastFetch).getTime()
        return cacheAge < NDBC_STATIONS_CACHE_HOURS * 60 * 60 * 1000
      },
      
      isObservationCacheValid: (stationId) => {
        const lastFetch = get().ndbcObservationsLastFetch[stationId]
        if (!lastFetch) return false
        const cacheAge = Date.now() - new Date(lastFetch).getTime()
        return cacheAge < NDBC_OBSERVATIONS_CACHE_MINUTES * 60 * 1000
      },

      // CO-OPS Tide Station actions
      setTideStations: (stations) => set({ 
        tideStations: stations,
        tideStationsLastFetch: new Date().toISOString()
      }),
      
      setTideObservation: (stationId, observation) => set((state) => ({
        tideObservations: { ...state.tideObservations, [stationId]: observation },
        tideObservationsLastFetch: { 
          ...state.tideObservationsLastFetch, 
          [stationId]: new Date().toISOString() 
        }
      })),
      
      isTideStationsCacheValid: () => {
        const lastFetch = get().tideStationsLastFetch
        if (!lastFetch) return false
        const cacheAge = Date.now() - new Date(lastFetch).getTime()
        return cacheAge < COOPS_STATIONS_CACHE_HOURS * 60 * 60 * 1000
      },
      
      isTideObservationCacheValid: (stationId) => {
        const lastFetch = get().tideObservationsLastFetch[stationId]
        if (!lastFetch) return false
        const cacheAge = Date.now() - new Date(lastFetch).getTime()
        return cacheAge < COOPS_OBSERVATIONS_CACHE_MINUTES * 60 * 1000
      },

      // Marine Weather actions
      setSubscribedZones: (zones) => set({ subscribedZones: zones }),
      
      addSubscribedZone: (zone) => set((state) => ({
        subscribedZones: [...state.subscribedZones.filter(z => z.id !== zone.id), zone]
      })),
      
      removeSubscribedZone: (zoneId) => set((state) => ({
        subscribedZones: state.subscribedZones.filter(z => z.id !== zoneId)
      })),
      
      setWeatherAlertSettings: (settings) => set({ weatherAlertSettings: settings }),
      
      setMonitoredBuoyId: (buoyId) => set({ monitoredBuoyId: buoyId }),
      
      setCachedAlerts: (alerts) => set({ 
        cachedAlerts: alerts,
        lastAlertCheck: new Date().toISOString()
      }),
      
      setCachedForecast: (zoneId, forecast) => set((state) => ({
        cachedForecasts: { 
          ...state.cachedForecasts, 
          [zoneId]: { ...forecast, _cachedAt: new Date().toISOString() } 
        }
      })),
      
      addPressureReading: (stationId, reading) => set((state) => {
        const existingHistory = state.pressureHistory[stationId] || []
        const cutoffTime = Date.now() - PRESSURE_HISTORY_HOURS * 60 * 60 * 1000
        
        // Add new reading and filter out old ones
        const updatedHistory = [...existingHistory, reading]
          .filter(r => new Date(r.timestamp).getTime() > cutoffTime)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        
        return {
          pressureHistory: {
            ...state.pressureHistory,
            [stationId]: updatedHistory
          }
        }
      }),
      
      addWindReading: (stationId, reading) => set((state) => {
        const existingHistory = state.windHistory[stationId] || []
        const cutoffTime = Date.now() - PRESSURE_HISTORY_HOURS * 60 * 60 * 1000
        
        // Add new reading and filter out old ones (reuse pressure history hours)
        const updatedHistory = [...existingHistory, reading]
          .filter(r => new Date(r.timestamp).getTime() > cutoffTime)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        
        return {
          windHistory: {
            ...state.windHistory,
            [stationId]: updatedHistory
          }
        }
      }),
      
      setLastAlertCheck: (timestamp) => set({ lastAlertCheck: timestamp }),
      
      setIsGreatLakesUser: (isGreatLakes) => set({ isGreatLakesUser: isGreatLakes }),
      
      setPressureUnit: (unit) => set({ pressureUnit: unit }),
      
      isAlertsCacheValid: () => {
        const lastCheck = get().lastAlertCheck
        if (!lastCheck) return false
        const cacheAge = Date.now() - new Date(lastCheck).getTime()
        return cacheAge < WEATHER_ALERTS_CACHE_MINUTES * 60 * 1000
      },
      
      isForecastCacheValid: (zoneId) => {
        const forecast = get().cachedForecasts[zoneId] as (MarineForecast & { _cachedAt?: string }) | undefined
        if (!forecast?._cachedAt) return false
        const cacheAge = Date.now() - new Date(forecast._cachedAt).getTime()
        return cacheAge < WEATHER_FORECAST_CACHE_MINUTES * 60 * 1000
      },

      // Tank log actions
      addTankLog: (entry) => set((state) => ({
        tankLogs: [...state.tankLogs, entry]
      })),
      
      getTankLogsForBoat: (boatId) => {
        return get().tankLogs
          .filter(log => log.boatId === boatId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      },
      
      getLatestTankLog: (boatId) => {
        const logs = get().tankLogs
          .filter(log => log.boatId === boatId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        return logs.length > 0 ? logs[0] : null
      },
      
      isTankLogStale: (boatId) => {
        const latest = get().tankLogs
          .filter(log => log.boatId === boatId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
        if (!latest) return true
        const age = Date.now() - new Date(latest.timestamp).getTime()
        return age > TANK_LOG_STALE_HOURS * 60 * 60 * 1000
      },
      
      updateBoatPhoto: (boatId, photoUri, photoUrl) => set((state) => ({
        boats: state.boats.map(boat => 
          boat.id === boatId 
            ? { ...boat, photoUri, photoUrl, updatedAt: new Date().toISOString() }
            : boat
        )
      })),

      // Data cleanup - remove plans older than retention period (except active)
      cleanupExpiredData: (retentionDays = RETENTION_DAYS) => set((state) => {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
        const filteredPlans: Record<string, FloatPlan> = {}
        
        Object.entries(state.floatPlans).forEach(([id, plan]) => {
          const updatedAt = new Date(plan.updatedAt)
          const isActive = plan.status === 'active'
          const isRecent = updatedAt >= cutoffDate
          
          if (isActive || isRecent) {
            filteredPlans[id] = plan
          }
        })
        
        return { floatPlans: filteredPlans }
      }),
    }),
    {
      name: 'float-plan-app-storage',
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        rememberMe: state.rememberMe,
        household: state.household,
        householdMembers: state.householdMembers,
        floatPlans: state.floatPlans,
        boats: state.boats,
        boatDevices: state.boatDevices,
        boatDocuments: state.boatDocuments,
        contacts: state.contacts,
        inventory: state.inventory,
        tasks: state.tasks,
        pendingSync: state.pendingSync,
        lastSyncAt: state.lastSyncAt,
        notificationIds: state.notificationIds,
        // NDBC cached data
        ndbcStations: state.ndbcStations,
        ndbcObservations: state.ndbcObservations,
        ndbcStationsLastFetch: state.ndbcStationsLastFetch,
        ndbcObservationsLastFetch: state.ndbcObservationsLastFetch,
        // CO-OPS tide cached data
        tideStations: state.tideStations,
        tideObservations: state.tideObservations,
        tideStationsLastFetch: state.tideStationsLastFetch,
        tideObservationsLastFetch: state.tideObservationsLastFetch,
        // Marine weather data
        subscribedZones: state.subscribedZones,
        weatherAlertSettings: state.weatherAlertSettings,
        monitoredBuoyId: state.monitoredBuoyId,
        cachedAlerts: state.cachedAlerts,
        cachedForecasts: state.cachedForecasts,
        pressureHistory: state.pressureHistory,
        windHistory: state.windHistory,
        lastAlertCheck: state.lastAlertCheck,
        isGreatLakesUser: state.isGreatLakesUser,
        pressureUnit: state.pressureUnit,
        // Tank logs
        tankLogs: state.tankLogs,
      }),
    }
  )
)
