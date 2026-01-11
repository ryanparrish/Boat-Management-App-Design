/**
 * NOAA CO-OPS (Center for Operational Oceanographic Products and Services) API
 * 
 * This service fetches tide station data from the Tides and Currents API.
 * CO-OPS stations are identified by 7-digit IDs (e.g., 8726607)
 * 
 * API Documentation: https://api.tidesandcurrents.noaa.gov/api/prod/
 */

import { TideStation, TideObservation, TideDataPoint } from '../types'

const COOPS_BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
const COOPS_STATIONS_URL = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json'

/**
 * Fetch all active CO-OPS tide stations
 */
export async function fetchTideStations(): Promise<TideStation[]> {
  try {
    console.log('Fetching CO-OPS tide stations...')
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    // Get stations with water level data
    const response = await fetch(
      `${COOPS_STATIONS_URL}?type=waterlevels`,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tide stations: ${response.status}`)
    }
    
    const data = await response.json()
    const stations: TideStation[] = []
    
    if (data.stations && Array.isArray(data.stations)) {
      for (const s of data.stations) {
        // Only include stations with valid coordinates
        const lat = parseFloat(s.lat)
        const lon = parseFloat(s.lng)
        
        if (isNaN(lat) || isNaN(lon)) continue
        if (lat === 0 && lon === 0) continue
        
        stations.push({
          id: s.id,
          name: s.name || s.id,
          lat,
          lon,
          state: s.state || null,
          type: 'tide',
          datums: s.datums || null,
        })
      }
    }
    
    console.log(`Loaded ${stations.length} CO-OPS tide stations`)
    return stations
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('CO-OPS stations request timed out')
      throw new Error('Request timed out - check your internet connection')
    }
    console.error('Error fetching CO-OPS stations:', error)
    throw error
  }
}

/**
 * Fetch current water level observation for a station
 */
export async function fetchTideObservation(stationId: string): Promise<TideObservation | null> {
  try {
    const now = new Date()
    const endDate = formatDate(now)
    
    // Get last 1 hour of data
    const startDate = formatDate(new Date(now.getTime() - 60 * 60 * 1000))
    
    const url = `${COOPS_BASE_URL}?` + new URLSearchParams({
      begin_date: startDate,
      end_date: endDate,
      station: stationId,
      product: 'water_level',
      datum: 'MLLW', // Mean Lower Low Water
      time_zone: 'gmt',
      units: 'english', // feet
      format: 'json',
    })
    
    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch observation: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      console.log(`CO-OPS error for ${stationId}:`, data.error.message)
      return null
    }
    
    if (!data.data || data.data.length === 0) {
      return null
    }
    
    // Get the most recent reading
    const latest = data.data[data.data.length - 1]
    
    return {
      stationId,
      timestamp: new Date(latest.t + ' GMT'),
      waterLevel: parseFloat(latest.v),
      sigma: parseFloat(latest.s) || undefined,
      stationName: data.metadata?.name || stationId,
    }
  } catch (error) {
    console.error(`Error fetching tide observation for ${stationId}:`, error)
    return null
  }
}

/**
 * Fetch 12 hours of tide data for visualization
 * Returns data from 6 hours ago to 6 hours from now (if predictions available)
 */
export async function fetchTideData12Hours(stationId: string): Promise<{
  observations: TideDataPoint[]
  predictions: TideDataPoint[]
  stationName: string
  datum: string
} | null> {
  try {
    const now = new Date()
    
    // 6 hours ago to now for observations
    const obsStart = formatDate(new Date(now.getTime() - 6 * 60 * 60 * 1000))
    const obsEnd = formatDate(now)
    
    // Now to 6 hours from now for predictions
    const predStart = formatDate(now)
    const predEnd = formatDate(new Date(now.getTime() + 6 * 60 * 60 * 1000))
    
    // Fetch both observations and predictions in parallel
    const [obsResponse, predResponse] = await Promise.all([
      fetch(`${COOPS_BASE_URL}?` + new URLSearchParams({
        begin_date: obsStart,
        end_date: obsEnd,
        station: stationId,
        product: 'water_level',
        datum: 'MLLW',
        time_zone: 'gmt',
        units: 'english',
        format: 'json',
        interval: '6', // 6-minute intervals
      })),
      fetch(`${COOPS_BASE_URL}?` + new URLSearchParams({
        begin_date: predStart,
        end_date: predEnd,
        station: stationId,
        product: 'predictions',
        datum: 'MLLW',
        time_zone: 'gmt',
        units: 'english',
        format: 'json',
        interval: '6',
      })),
    ])
    
    const observations: TideDataPoint[] = []
    const predictions: TideDataPoint[] = []
    let stationName = stationId
    
    // Parse observations
    if (obsResponse.ok) {
      const obsData = await obsResponse.json()
      if (obsData.metadata?.name) {
        stationName = obsData.metadata.name
      }
      if (obsData.data && Array.isArray(obsData.data)) {
        for (const d of obsData.data) {
          const value = parseFloat(d.v)
          if (!isNaN(value)) {
            observations.push({
              timestamp: new Date(d.t + ' GMT'),
              value,
              type: 'observed',
            })
          }
        }
      }
    }
    
    // Parse predictions
    if (predResponse.ok) {
      const predData = await predResponse.json()
      if (predData.predictions && Array.isArray(predData.predictions)) {
        for (const d of predData.predictions) {
          const value = parseFloat(d.v)
          if (!isNaN(value)) {
            predictions.push({
              timestamp: new Date(d.t + ' GMT'),
              value,
              type: 'predicted',
            })
          }
        }
      }
    }
    
    // If no observations and no predictions, return null
    if (observations.length === 0 && predictions.length === 0) {
      return null
    }
    
    return {
      observations,
      predictions,
      stationName,
      datum: 'MLLW (ft)',
    }
  } catch (error) {
    console.error(`Error fetching 12-hour tide data for ${stationId}:`, error)
    return null
  }
}

/**
 * Fetch high/low tide times for the day
 */
export async function fetchHighLowTides(stationId: string): Promise<{
  highs: { time: Date; height: number }[]
  lows: { time: Date; height: number }[]
} | null> {
  try {
    const now = new Date()
    const startDate = formatDate(new Date(now.getTime() - 6 * 60 * 60 * 1000))
    const endDate = formatDate(new Date(now.getTime() + 18 * 60 * 60 * 1000))
    
    const response = await fetch(`${COOPS_BASE_URL}?` + new URLSearchParams({
      begin_date: startDate,
      end_date: endDate,
      station: stationId,
      product: 'predictions',
      datum: 'MLLW',
      time_zone: 'gmt',
      units: 'english',
      format: 'json',
      interval: 'hilo', // High/Low predictions
    }))
    
    if (!response.ok) return null
    
    const data = await response.json()
    
    if (!data.predictions || !Array.isArray(data.predictions)) {
      return null
    }
    
    const highs: { time: Date; height: number }[] = []
    const lows: { time: Date; height: number }[] = []
    
    for (const p of data.predictions) {
      const time = new Date(p.t + ' GMT')
      const height = parseFloat(p.v)
      
      if (p.type === 'H') {
        highs.push({ time, height })
      } else if (p.type === 'L') {
        lows.push({ time, height })
      }
    }
    
    return { highs, lows }
  } catch (error) {
    console.error(`Error fetching high/low tides for ${stationId}:`, error)
    return null
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Get tide trend description
 */
export function getTideTrend(
  current: number,
  previous: number
): 'rising' | 'falling' | 'slack' {
  const diff = current - previous
  if (Math.abs(diff) < 0.05) return 'slack'
  return diff > 0 ? 'rising' : 'falling'
}

/**
 * Get tide marker color based on current level
 */
export function getTideMarkerColor(
  observation: TideObservation | undefined
): string {
  if (!observation) return '#6b7280' // gray - no data
  
  // Cyan/teal color for tide stations to differentiate from weather buoys
  return '#0891b2' // cyan-600
}

/**
 * Format a date as YYYYMMDD HH:MM for CO-OPS API
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}${month}${day} ${hour}:${minute}`
}

/**
 * Format time for display
 */
export function formatTideTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format water level for display
 */
export function formatWaterLevel(feet: number): string {
  return `${feet >= 0 ? '+' : ''}${feet.toFixed(2)} ft`
}

/**
 * Fetch meteorological observations from CO-OPS for NOS stations
 * This is used as a fallback when NDBC realtime2 data is not available
 * 
 * @param coopsStationId - The 7-digit CO-OPS station ID (e.g., "8465705")
 * @param ndbcStationId - The NDBC station ID to use in the returned observation
 */
export async function fetchCOOPSMetObs(coopsStationId: string, ndbcStationId: string): Promise<{
  stationId: string
  timestamp: Date
  windDir?: number
  windSpeed?: number
  windGust?: number
  airTemp?: number
  waterTemp?: number
  pressure?: number
} | null> {
  try {
    // Fetch wind, air temp, water temp, and pressure in parallel
    const [windRes, airTempRes, waterTempRes, pressureRes] = await Promise.all([
      fetch(`${COOPS_BASE_URL}?` + new URLSearchParams({
        date: 'latest',
        station: coopsStationId,
        product: 'wind',
        time_zone: 'gmt',
        units: 'english',
        format: 'json',
      })).catch(() => null),
      fetch(`${COOPS_BASE_URL}?` + new URLSearchParams({
        date: 'latest',
        station: coopsStationId,
        product: 'air_temperature',
        time_zone: 'gmt',
        units: 'english',
        format: 'json',
      })).catch(() => null),
      fetch(`${COOPS_BASE_URL}?` + new URLSearchParams({
        date: 'latest',
        station: coopsStationId,
        product: 'water_temperature',
        time_zone: 'gmt',
        units: 'english',
        format: 'json',
      })).catch(() => null),
      fetch(`${COOPS_BASE_URL}?` + new URLSearchParams({
        date: 'latest',
        station: coopsStationId,
        product: 'air_pressure',
        time_zone: 'gmt',
        units: 'english',
        format: 'json',
      })).catch(() => null),
    ])

    let timestamp: Date | null = null
    let windDir: number | undefined
    let windSpeed: number | undefined  
    let windGust: number | undefined
    let airTemp: number | undefined
    let waterTemp: number | undefined
    let pressure: number | undefined

    // Parse wind data - speed is in knots, need to convert to m/s
    if (windRes?.ok) {
      const windData = await windRes.json()
      if (windData.data?.[0]) {
        const w = windData.data[0]
        timestamp = new Date(w.t + ' GMT')
        // CO-OPS wind speed is in knots, convert to m/s for consistency with NDBC
        windSpeed = w.s ? parseFloat(w.s) / 1.944 : undefined
        windGust = w.g ? parseFloat(w.g) / 1.944 : undefined
        windDir = w.d ? parseFloat(w.d) : undefined
      }
    }

    // Parse air temperature - CO-OPS returns Fahrenheit, convert to Celsius
    if (airTempRes?.ok) {
      const airData = await airTempRes.json()
      if (airData.data?.[0]) {
        const a = airData.data[0]
        if (!timestamp) timestamp = new Date(a.t + ' GMT')
        // Convert Fahrenheit to Celsius
        airTemp = a.v ? (parseFloat(a.v) - 32) / 1.8 : undefined
      }
    }

    // Parse water temperature - CO-OPS returns Fahrenheit, convert to Celsius
    if (waterTempRes?.ok) {
      const waterData = await waterTempRes.json()
      if (waterData.data?.[0]) {
        const wt = waterData.data[0]
        if (!timestamp) timestamp = new Date(wt.t + ' GMT')
        // Convert Fahrenheit to Celsius
        waterTemp = wt.v ? (parseFloat(wt.v) - 32) / 1.8 : undefined
      }
    }

    // Parse air pressure - CO-OPS returns millibars (same as hPa)
    if (pressureRes?.ok) {
      const pressData = await pressureRes.json()
      if (pressData.data?.[0]) {
        const p = pressData.data[0]
        if (!timestamp) timestamp = new Date(p.t + ' GMT')
        pressure = p.v ? parseFloat(p.v) : undefined
      }
    }

    // If we got no data at all, return null
    if (!timestamp) {
      console.log(`No CO-OPS met data available for station ${coopsStationId}`)
      return null
    }

    console.log(`Fetched CO-OPS met data for station ${coopsStationId}: wind=${windSpeed?.toFixed(1)}m/s, airTemp=${airTemp?.toFixed(1)}°C`)

    return {
      stationId: ndbcStationId,
      timestamp,
      windDir,
      windSpeed,
      windGust,
      airTemp,
      waterTemp,
      pressure,
    }
  } catch (error) {
    console.error(`Error fetching CO-OPS met data for ${coopsStationId}:`, error)
    return null
  }
}
