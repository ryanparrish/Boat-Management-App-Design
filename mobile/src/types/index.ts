// Type definitions for the Float Plan App

export interface Coordinates {
  latitude: number
  longitude: number
}

// Tank level readings (0-100 in 10% increments)
export interface TankReading {
  fuel?: number       // Percentage 0-100
  water?: number      // Percentage 0-100
  blackwater?: number // Percentage 0-100
}

// Tank log entry for historical tracking
export interface TankLogEntry {
  id: string
  boatId: string
  timestamp: string
  fuel?: number       // 0-100%
  water?: number      // 0-100%
  blackwater?: number // 0-100%
  notes?: string
}

// Crew member with optional age and medical info for SAR
export interface CrewMember {
  id: string
  name: string
  age?: number
  medicalNotes?: string  // Diabetes, blood thinners, allergies, etc.
  contactId?: string     // Link to saved contact if added from contacts
}

export interface FloatPlan {
  id: string
  departure: string
  departureCoords?: Coordinates
  destination: string
  destinationCoords?: Coordinates
  route?: string
  vesselName: string
  vesselType?: string
  boatId?: string
  checkInDeadline: string
  gracePeriod: number
  lastCheckIn?: string
  crew: CrewMember[]
  notes?: string
  status: 'draft' | 'pending' | 'active' | 'checked_in'
  // Tank levels (inline storage for backward compatibility)
  departureTanks?: TankReading
  returnTanks?: TankReading
  // Tank log references (for historical tracking)
  departureTankLogId?: string    // Reference to tank log entry at departure
  returnTankLogId?: string       // Reference to tank log entry at return
  expectedReturnTime?: string    // ISO date string for specific time
  tripDurationHours?: number     // Alternative: hours from departure
  primaryEmergencyContactId?: string
  secondaryEmergencyContactId?: string
  escalationWaitMinutes?: number // Wait before trying secondary (default 30)
  householdId?: string
  createdAt: string
  updatedAt: string
}

export interface Boat {
  id: string
  name: string
  type?: string
  length?: string
  registration?: string
  homePort?: string
  homePortCoords?: Coordinates
  color?: string
  notes?: string
  photoUri?: string              // Local cache URI
  photoUrl?: string              // Supabase storage URL for sharing
  fuelCapacityGallons?: number
  waterCapacityGallons?: number
  householdId?: string
  createdAt: string
  updatedAt: string
}

// Boat devices (radios, EPIRB, etc.)
export type DeviceType = 'dsc_radio' | 'ssb_radio' | 'epirb' | 'plb' | 'ais' | 'other'

export interface BoatDevice {
  id: string
  boatId: string
  type: DeviceType
  name: string
  deviceId?: string      // MMSI, HEX ID, etc.
  serialNumber?: string
  expirationDate?: string
  notes?: string
  householdId?: string
  createdAt: string
  updatedAt: string
}

// Boat documents (registrations, insurance, etc.)
export type DocumentType = 'federal_registration' | 'state_registration' | 'insurance' | 'survey' | 'other'

export interface BoatDocument {
  id: string
  boatId: string
  type: DocumentType
  name: string
  documentNumber?: string
  issueDate?: string
  expirationDate?: string
  provider?: string
  notes?: string
  householdId?: string
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  method: 'email' | 'sms' | 'both'
  permission: boolean
  householdId?: string
  createdAt: string
  updatedAt: string
}

export interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  boatId?: string
  expirationDate?: string
  condition?: string
  location?: string
  householdId?: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description?: string
  season: string
  dueDate?: string
  completed: boolean
  recurring: boolean
  householdId?: string
  createdAt: string
  updatedAt: string
}

// Household/Crew sharing
export interface Household {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface HouseholdMember {
  id: string
  householdId: string
  userId: string
  email: string
  role: 'owner' | 'member'
  status: 'pending' | 'accepted'
  invitedAt: string
  acceptedAt?: string
}

export interface HouseholdInvite {
  id: string
  householdId: string
  householdName: string
  inviterEmail: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
}

// NDBC Weather Buoy Types
export interface NDBCStation {
  id: string
  name: string
  lat: number
  lon: number
  type: string // e.g., "buoy", "fixed", "oilrig", "dart"
  met: boolean // has meteorological data
  dart: boolean // is DART tsunami detection buoy
  owner: string
  coopsId?: string // CO-OPS station ID for NOS stations (7-digit, e.g., "8465705")
}

export interface NDBCObservation {
  stationId: string
  timestamp: Date
  // Wind
  windDir?: number // degrees
  windSpeed?: number // m/s
  windGust?: number // m/s
  // Waves  
  waveHeight?: number // meters
  dominantWavePeriod?: number // seconds
  avgWavePeriod?: number // seconds
  waveDirection?: number // degrees
  // Atmosphere
  pressure?: number // hPa
  pressureTendency?: number // hPa change
  airTemp?: number // Celsius
  waterTemp?: number // Celsius
  dewPoint?: number // Celsius
  visibility?: number // nautical miles
  // Tide
  tide?: number // feet
}

// CO-OPS Tide Station Types
export interface TideStation {
  id: string
  name: string
  lat: number
  lon: number
  state: string | null
  type: 'tide'
  datums: any | null // Available datums
}

export interface TideObservation {
  stationId: string
  timestamp: Date
  waterLevel: number // feet above MLLW
  sigma?: number // standard deviation
  stationName: string
}

export interface TideDataPoint {
  timestamp: Date
  value: number // feet
  type: 'observed' | 'predicted'
}

export interface Tide12HourData {
  observations: TideDataPoint[]
  predictions: TideDataPoint[]
  stationName: string
  datum: string
}

// Union type for all station types on the map
export type MapStation = 
  | (NDBCStation & { stationType: 'weather' })
  | (TideStation & { stationType: 'tide' })

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete' | 'check_in'
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  createdAt: string
  retryCount: number
}

export interface UserProfile {
  id: string
  email: string
  accessToken: string
  householdId?: string
  householdRole?: 'owner' | 'member'
}

export type RootStackParamList = {
  Auth: undefined
  Dashboard: undefined
  BoatsManager: undefined
  BoatDevices: { boatId: string; boatName: string }
  BoatDocuments: { boatId: string; boatName: string }
  FloatPlansList: undefined
  FloatPlanDetail: { id: string }
  CreateFloatPlan: { editPlan?: FloatPlan }
  ContactsManager: undefined
  InventoryList: undefined
  SeasonalTasks: undefined
  HouseholdManager: undefined
  BuoyMap: undefined
  BuoyDetail: { stationId: string; stationName: string }
  TideStationDetail: { stationId: string; stationName: string }
  WeatherDashboard: undefined
  WeatherSettings: undefined
}

// Marine Weather Types

export interface MarineZone {
  id: string
  name: string
  type: 'coastal' | 'offshore' | 'high_seas'
  state?: string
  forecastOffice?: string
}

export interface SubscribedZone {
  id: string
  name: string
  type: 'coastal' | 'offshore'
  isGreatLakes: boolean
}

export interface MarineForecastPeriod {
  number: number
  name: string
  startTime: string
  endTime: string
  detailedForecast: string
  windSpeed?: string
  windDirection?: string
  waveHeight?: string
}

export interface MarineForecast {
  zoneId: string
  zoneName: string
  updated: string
  periods: MarineForecastPeriod[]
}

export interface MarineAlert {
  id: string
  event: string
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown'
  headline: string
  description: string
  instruction?: string
  onset: string
  expires: string
  senderName: string
  affectedZones: string[]
}

export interface WeatherAlertSettings {
  smallCraftAdvisory: boolean
  galeWarning: boolean
  stormWarning: boolean
  pressureDrop: boolean
  pressureDropThreshold: number
}

export interface PressureReading {
  timestamp: string
  pressure: number
  stationId: string
}

export interface WindReading {
  timestamp: string
  windSpeed: number // m/s
  stationId: string
}

export interface WeatherState {
  subscribedZones: SubscribedZone[]
  alertSettings: WeatherAlertSettings
  monitoredBuoyId: string | null
  cachedAlerts: MarineAlert[]
  cachedForecasts: Record<string, MarineForecast>
  pressureHistory: Record<string, PressureReading[]>
  windHistory: Record<string, WindReading[]>
  lastAlertCheck: string | null
  isGreatLakesUser: boolean
  pressureUnit: 'hPa' | 'mb'
}
