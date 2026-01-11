/**
 * NWS Weather.gov Marine Weather API Service
 * 
 * Provides marine zone forecasts, active alerts, and zone detection.
 * API Documentation: https://www.weather.gov/documentation/services-web-api
 */

import { calculateDistance } from './ndbc'

const NWS_BASE_URL = 'https://api.weather.gov'

// Great Lakes zone prefixes - no tidal data for these
const GREAT_LAKES_PREFIXES = ['LMZ', 'LSZ', 'LEZ', 'LOZ', 'LHZ']

// Marine alert event types we care about
const MARINE_ALERT_EVENTS = [
  'Small Craft Advisory',
  'Small Craft Advisory for Hazardous Seas',
  'Small Craft Advisory for Rough Bar',
  'Small Craft Advisory for Winds',
  'Gale Warning',
  'Gale Watch',
  'Storm Warning',
  'Storm Watch',
  'Hurricane Force Wind Warning',
  'Hurricane Force Wind Watch',
  'Special Marine Warning',
  'Marine Weather Statement',
]

// Types
export interface MarineZone {
  id: string
  name: string
  type: 'coastal' | 'offshore' | 'high_seas'
  state?: string
  forecastOffice?: string
  geometry?: {
    type: string
    coordinates: number[][][]
  }
}

export interface MarineForecastPeriod {
  number: number
  name: string // "Tonight", "Friday", etc.
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
  event: string // "Small Craft Advisory", "Gale Warning", etc.
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
  pressureDropThreshold: number // hPa drop in 3 hours
}

export interface SubscribedZone {
  id: string
  name: string
  type: 'coastal' | 'offshore'
  isGreatLakes: boolean
}

export interface PressureReading {
  timestamp: string
  pressure: number // hPa
  stationId: string
}

// Default alert settings
export const DEFAULT_WEATHER_SETTINGS: WeatherAlertSettings = {
  smallCraftAdvisory: true,
  galeWarning: true,
  stormWarning: true,
  pressureDrop: true,
  pressureDropThreshold: 4, // 4 hPa in 3 hours indicates rapidly intensifying low
}

/**
 * Check if a zone is in the Great Lakes (no tidal data)
 */
export function isGreatLakesZone(zoneId: string): boolean {
  return GREAT_LAKES_PREFIXES.some(prefix => zoneId.startsWith(prefix))
}

/**
 * Fetch list of marine zones from NWS
 * @param type - 'coastal' or 'offshore'
 */
export async function fetchMarineZones(type: 'coastal' | 'offshore' = 'coastal'): Promise<MarineZone[]> {
  try {
    const response = await fetch(`${NWS_BASE_URL}/zones?type=${type}`, {
      headers: {
        'User-Agent': 'FloatPlanApp/1.0 (contact@floatplanapp.com)',
        'Accept': 'application/geo+json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch marine zones: ${response.status}`)
    }

    const data = await response.json()
    const zones: MarineZone[] = []

    if (data.features && Array.isArray(data.features)) {
      for (const feature of data.features) {
        const props = feature.properties
        zones.push({
          id: props.id,
          name: props.name,
          type: type,
          state: props.state,
          forecastOffice: props.cwa,
          geometry: feature.geometry,
        })
      }
    }

    return zones
  } catch (error: any) {
    // Silently ignore network errors
    if (!error?.message?.includes('Network request failed')) {
      console.error('Error fetching marine zones:', error)
    }
    throw error
  }
}

/**
 * Find the nearest marine zone(s) for a given location
 */
export async function findNearestMarineZones(
  latitude: number,
  longitude: number,
  maxResults: number = 3
): Promise<MarineZone[]> {
  try {
    // First, get the point metadata which includes the forecast zone
    const pointResponse = await fetch(`${NWS_BASE_URL}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, {
      headers: {
        'User-Agent': 'FloatPlanApp/1.0 (contact@floatplanapp.com)',
        'Accept': 'application/geo+json',
      },
    })

    if (pointResponse.ok) {
      const pointData = await pointResponse.json()
      const forecastZone = pointData.properties?.forecastZone
      const fireWeatherZone = pointData.properties?.fireWeatherZone
      
      // For marine zones, we need to search differently
      // The point API gives land-based zones, so we'll fetch nearby marine zones
    }

    // Fetch all coastal zones and find nearest by centroid distance
    const coastalZones = await fetchMarineZones('coastal')
    
    // Calculate rough centroid for each zone and sort by distance
    const zonesWithDistance = coastalZones
      .filter(zone => zone.geometry?.coordinates)
      .map(zone => {
        const centroid = calculateZoneCentroid(zone.geometry!)
        const distance = calculateDistance(latitude, longitude, centroid.lat, centroid.lon)
        return { zone, distance }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults)

    return zonesWithDistance.map(z => z.zone)
  } catch (error: any) {
    // Silently ignore network errors
    if (!error?.message?.includes('Network request failed')) {
      console.error('Error finding nearest marine zones:', error)
    }
    // Return empty array instead of throwing to allow graceful degradation
    return []
  }
}

/**
 * Calculate rough centroid of a zone polygon
 */
function calculateZoneCentroid(geometry: { type: string; coordinates: number[][][] | number[][][][] }): { lat: number; lon: number } {
  try {
    // Handle MultiPolygon or Polygon
    let coords: number[][]
    if (geometry.type === 'MultiPolygon') {
      const multiCoords = geometry.coordinates as number[][][][]
      coords = multiCoords[0]?.[0] ?? []
    } else {
      const polyCoords = geometry.coordinates as number[][][]
      coords = polyCoords[0] ?? []
    }
    
    if (!coords || coords.length === 0) {
      return { lat: 0, lon: 0 }
    }

    let sumLat = 0
    let sumLon = 0
    for (const coord of coords) {
      const lon = coord[0]
      const lat = coord[1]
      sumLat += lat
      sumLon += lon
    }

    return {
      lat: sumLat / coords.length,
      lon: sumLon / coords.length,
    }
  } catch {
    return { lat: 0, lon: 0 }
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch marine forecast for a specific zone using the Products API
 * The standard zone forecast API doesn't support marine zones,
 * so we fetch the Nearshore Marine Forecast (NSH) product and parse it
 */
export async function fetchMarineForecast(zoneId: string): Promise<MarineForecast | null> {
  try {
    // Get the forecast office for this zone
    const forecastOffice = getZoneForecastOffice(zoneId)
    if (!forecastOffice) {
      return null
    }
    
    // Fetch list of NSH products from this office
    const productsUrl = `${NWS_BASE_URL}/products/types/NSH/locations/${forecastOffice}`
    const productsResponse = await fetchWithTimeout(productsUrl, {
      headers: {
        'User-Agent': 'FloatPlanApp/1.0 (contact@floatplanapp.com)',
        'Accept': 'application/ld+json',
      },
    }, 15000)

    if (!productsResponse.ok) {
      return null
    }

    const productsData = await productsResponse.json()
    const products = productsData['@graph'] || []
    
    if (products.length === 0) {
      return null
    }
    
    // Get the most recent product
    const latestProduct = products[0]
    const productId = latestProduct.id
    
    // Fetch the actual forecast text
    const forecastUrl = `${NWS_BASE_URL}/products/${productId}`
    const forecastResponse = await fetchWithTimeout(forecastUrl, {
      headers: {
        'User-Agent': 'FloatPlanApp/1.0 (contact@floatplanapp.com)',
        'Accept': 'application/ld+json',
      },
    }, 15000)

    if (!forecastResponse.ok) {
      return null
    }

    const forecastData = await forecastResponse.json()
    const productText = forecastData.productText || ''
    
    // Parse the forecast text for our specific zone
    return parseNSHForecast(productText, zoneId, forecastData.issuanceTime)
  } catch {
    // Silently ignore network/timeout errors
    return null
  }
}

/**
 * Map zone IDs to their NWS forecast office
 * This is a subset - expand as needed for other regions
 */
function getZoneForecastOffice(zoneId: string): string | null {
  // Great Lakes - Lake Michigan
  if (['LMZ844', 'LMZ845', 'LMZ846', 'LMZ847', 'LMZ848', 'LMZ849'].includes(zoneId)) {
    return 'GRR' // Grand Rapids
  }
  if (['LMZ740', 'LMZ741', 'LMZ742', 'LMZ743', 'LMZ744', 'LMZ745'].includes(zoneId)) {
    return 'MKX' // Milwaukee
  }
  if (['LMZ640', 'LMZ641', 'LMZ642', 'LMZ643', 'LMZ644', 'LMZ645'].includes(zoneId)) {
    return 'LOT' // Chicago
  }
  if (['LMZ221', 'LMZ248', 'LMZ261', 'LMZ321', 'LMZ323'].includes(zoneId)) {
    return 'APX' // Gaylord (northern Lake Michigan)
  }
  if (['LMZ541', 'LMZ542', 'LMZ543', 'LMZ563'].includes(zoneId)) {
    return 'GRB' // Green Bay
  }
  
  // Great Lakes - Lake Superior
  if (zoneId.startsWith('LSZ')) {
    if (['LSZ140', 'LSZ141', 'LSZ142', 'LSZ143', 'LSZ144', 'LSZ145'].includes(zoneId)) {
      return 'MQT' // Marquette
    }
    if (['LSZ240', 'LSZ241', 'LSZ242', 'LSZ243', 'LSZ244', 'LSZ245'].includes(zoneId)) {
      return 'DLH' // Duluth
    }
    return 'MQT' // Default to Marquette for Lake Superior
  }
  
  // Great Lakes - Lake Erie
  if (zoneId.startsWith('LEZ')) {
    if (['LEZ040', 'LEZ041', 'LEZ042', 'LEZ043', 'LEZ044', 'LEZ045'].includes(zoneId)) {
      return 'CLE' // Cleveland
    }
    if (['LEZ020', 'LEZ061', 'LEZ062'].includes(zoneId)) {
      return 'BUF' // Buffalo
    }
    return 'CLE' // Default to Cleveland for Lake Erie
  }
  
  // Great Lakes - Lake Huron and Lake St. Clair
  if (zoneId.startsWith('LHZ') || zoneId.startsWith('LCZ')) {
    return 'DTX' // Detroit
  }
  
  // Great Lakes - Lake Ontario
  if (zoneId.startsWith('LOZ')) {
    return 'BUF' // Buffalo
  }
  
  // For non-Great Lakes zones, try to determine from zone ID pattern
  // Most marine zones have an office embedded or can be looked up
  // For now, return null for unsupported zones
  return null
}

/**
 * Parse the Nearshore Marine Forecast (NSH) text product
 * The format is text blocks separated by zone IDs like "LMZ846-020900-"
 */
function parseNSHForecast(text: string, zoneId: string, issuanceTime: string): MarineForecast | null {
  try {
    // Find the section for our zone
    // Format: LMZ846-DDHHNN- where DD=day, HH=hour, NN=product number
    const zonePattern = new RegExp(`${zoneId}-\\d{6}-[\\s\\S]*?(?=\\n\\$\\$|$)`, 'i')
    const match = text.match(zonePattern)
    
    if (!match) {
      return null
    }
    
    const zoneSection = match[0]
    
    // Extract zone name (line after the zone ID)
    const lines = zoneSection.split('\n')
    let zoneName = zoneId
    let forecastText = ''
    let startIndex = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      // Skip empty lines and the zone ID line
      if (!line || line.match(/^[A-Z]{3}\d{3}-\d{6}-$/)) {
        continue
      }
      // Skip timestamp line
      if (line.match(/^\d{1,2}:\d{2}\s+(AM|PM)\s+[A-Z]{3}/i) || line.match(/^\d+\s+(AM|PM)\s+[A-Z]{3}/i)) {
        continue
      }
      // Check for zone name (ends with state abbreviation)
      if (line.match(/\s+[A-Z]{2}$/)) {
        zoneName = line
        startIndex = i + 1
        break
      }
      // Otherwise this might be the zone name
      if (i < 3 && !line.startsWith('.') && !line.startsWith('...')) {
        zoneName = line
        startIndex = i + 1
        break
      }
    }
    
    // Collect the forecast text
    forecastText = lines.slice(startIndex).join('\n')
    
    // Parse into periods (each starts with .PERIOD_NAME...)
    const periods: MarineForecastPeriod[] = []
    const periodPattern = /\.([A-Z][A-Z\s]+?)\.\.\.(.+?)(?=\n\.[A-Z]|\n\$\$|$)/gs
    let periodMatch
    let periodNum = 1
    
    while ((periodMatch = periodPattern.exec(forecastText)) !== null) {
      const periodName = periodMatch[1].trim()
      const periodForecast = periodMatch[2].replace(/\n/g, ' ').trim()
      
      periods.push({
        number: periodNum++,
        name: formatPeriodName(periodName),
        startTime: issuanceTime,
        endTime: issuanceTime,
        detailedForecast: periodForecast,
        windSpeed: extractWindSpeed(periodForecast),
        windDirection: extractWindDirection(periodForecast),
        waveHeight: extractWaveHeight(periodForecast),
      })
    }
    
    if (periods.length === 0) {
      return null
    }
    
    return {
      zoneId,
      zoneName,
      updated: issuanceTime,
      periods,
    }
  } catch {
    return null
  }
}

/**
 * Format period name (e.g., "TONIGHT" -> "Tonight")
 */
function formatPeriodName(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Extract wind speed from forecast text (e.g., "winds 15 to 25 knots")
 */
function extractWindSpeed(text: string): string | undefined {
  if (!text) return undefined
  const match = text.match(/winds?\s+(\d+\s*(?:to\s*\d+)?)\s*(?:knots?|kt)/i)
  return match ? match[1] + ' kt' : undefined
}

/**
 * Extract wind direction from forecast text
 */
function extractWindDirection(text: string): string | undefined {
  if (!text) return undefined
  const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
  const regex = new RegExp(`(${directions.join('|')})(?:erly|ern)?\\s+winds?`, 'i')
  const match = text.match(regex)
  return match ? match[1].toUpperCase() : undefined
}

/**
 * Extract wave height from forecast text (e.g., "waves 4 to 6 feet")
 */
function extractWaveHeight(text: string): string | undefined {
  if (!text) return undefined
  const match = text.match(/waves?\s+(\d+\s*(?:to\s*\d+)?)\s*(?:feet|ft)/i)
  return match ? match[1] + ' ft' : undefined
}

/**
 * Fetch active marine alerts for a zone
 */
export async function fetchMarineAlerts(zoneId: string): Promise<MarineAlert[]> {
  try {
    const response = await fetch(`${NWS_BASE_URL}/alerts/active/zone/${zoneId}`, {
      headers: {
        'User-Agent': 'FloatPlanApp/1.0 (contact@floatplanapp.com)',
        'Accept': 'application/geo+json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return [] // No alerts
      }
      throw new Error(`Failed to fetch alerts: ${response.status}`)
    }

    const data = await response.json()
    const alerts: MarineAlert[] = []

    if (data.features && Array.isArray(data.features)) {
      for (const feature of data.features) {
        const props = feature.properties
        
        // Only include marine-related alerts
        if (!MARINE_ALERT_EVENTS.some(event => 
          props.event?.toLowerCase().includes(event.toLowerCase()) ||
          event.toLowerCase().includes(props.event?.toLowerCase())
        )) {
          continue
        }

        alerts.push({
          id: props.id,
          event: props.event,
          severity: props.severity || 'Unknown',
          urgency: props.urgency || 'Unknown',
          headline: props.headline || props.event,
          description: props.description || '',
          instruction: props.instruction,
          onset: props.onset,
          expires: props.expires,
          senderName: props.senderName || 'NWS',
          affectedZones: props.affectedZones || [zoneId],
        })
      }
    }

    // Sort by severity
    const severityOrder = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return alerts
  } catch (error: any) {
    // Silently ignore network errors
    if (!error?.message?.includes('Network request failed')) {
      console.error(`Error fetching alerts for zone ${zoneId}:`, error)
    }
    return []
  }
}

/**
 * Fetch alerts for multiple zones
 */
export async function fetchAlertsForZones(zoneIds: string[]): Promise<MarineAlert[]> {
  try {
    const allAlerts: MarineAlert[] = []
    const seenIds = new Set<string>()

    // Fetch alerts for each zone in parallel
    const results = await Promise.all(
      zoneIds.map(zoneId => fetchMarineAlerts(zoneId))
    )

    // Deduplicate alerts (same alert can affect multiple zones)
    for (const alerts of results) {
      for (const alert of alerts) {
        if (!seenIds.has(alert.id)) {
          seenIds.add(alert.id)
          allAlerts.push(alert)
        }
      }
    }

    return allAlerts
  } catch (error: any) {
    // Silently ignore network errors
    if (!error?.message?.includes('Network request failed')) {
      console.error('Error fetching alerts for zones:', error)
    }
    return []
  }
}

/**
 * Check if an alert matches user's notification settings
 */
export function shouldNotifyForAlert(
  alert: MarineAlert,
  settings: WeatherAlertSettings
): boolean {
  const eventLower = alert.event.toLowerCase()
  
  if (settings.smallCraftAdvisory && eventLower.includes('small craft')) {
    return true
  }
  
  if (settings.galeWarning && (eventLower.includes('gale') || eventLower.includes('storm watch'))) {
    return true
  }
  
  if (settings.stormWarning && (
    eventLower.includes('storm warning') ||
    eventLower.includes('hurricane force')
  )) {
    return true
  }
  
  return false
}

/**
 * Get severity color for an alert
 */
export function getAlertSeverityColor(severity: string): string {
  switch (severity) {
    case 'Extreme':
      return '#7c2d12' // orange-900
    case 'Severe':
      return '#dc2626' // red-600
    case 'Moderate':
      return '#f59e0b' // amber-500
    case 'Minor':
      return '#3b82f6' // blue-500
    default:
      return '#6b7280' // gray-500
  }
}

/**
 * Get severity icon for an alert
 */
export function getAlertSeverityIcon(severity: string): string {
  switch (severity) {
    case 'Extreme':
    case 'Severe':
      return 'warning'
    case 'Moderate':
      return 'alert-circle'
    case 'Minor':
      return 'information-circle'
    default:
      return 'help-circle'
  }
}

/**
 * Check for rapid pressure drop indicating approaching storm
 * @param history - Array of pressure readings over last 3+ hours
 * @param threshold - Pressure drop threshold in hPa (default 4)
 * @returns Object with drop detected flag and drop amount
 */
export function checkPressureDrop(
  history: PressureReading[],
  threshold: number = 4
): { hasSignificantDrop: boolean; dropAmount: number; hoursAgo: number } {
  if (history.length < 2) {
    return { hasSignificantDrop: false, dropAmount: 0, hoursAgo: 0 }
  }

  // Sort by timestamp, newest first
  const sorted = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const newest = sorted[0]
  const newestTime = new Date(newest.timestamp).getTime()
  const threeHoursAgo = newestTime - 3 * 60 * 60 * 1000

  // Find reading closest to 3 hours ago
  let oldestRelevant = sorted[sorted.length - 1]
  for (const reading of sorted) {
    if (new Date(reading.timestamp).getTime() <= threeHoursAgo) {
      oldestRelevant = reading
      break
    }
  }

  const dropAmount = oldestRelevant.pressure - newest.pressure
  const hoursAgo = (newestTime - new Date(oldestRelevant.timestamp).getTime()) / (60 * 60 * 1000)

  return {
    hasSignificantDrop: dropAmount >= threshold,
    dropAmount: Math.round(dropAmount * 10) / 10,
    hoursAgo: Math.round(hoursAgo * 10) / 10,
  }
}

/**
 * Format alert expiration time
 */
export function formatAlertExpiry(expires: string): string {
  const expiry = new Date(expires)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  
  if (diffMs < 0) {
    return 'Expired'
  }
  
  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000))
  
  if (hours > 24) {
    return expiry.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' })
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`
  }
  
  return `${minutes}m remaining`
}
