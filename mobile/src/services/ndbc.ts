import { XMLParser } from 'fast-xml-parser'
import { NDBCStation, NDBCObservation } from '../types'
import { fetchCOOPSMetObs } from './coops'

const NDBC_BASE_URL = 'https://www.ndbc.noaa.gov'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
})

/**
 * Fetch all active NDBC stations from the activestations.xml feed
 */
export async function fetchActiveStations(): Promise<NDBCStation[]> {
  try {
    console.log('Fetching NDBC stations from:', `${NDBC_BASE_URL}/activestations.xml`);
    
    // Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(`${NDBC_BASE_URL}/activestations.xml`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch stations: ${response.status}`);
    }
    
    const xmlText = await response.text();
    console.log('Received XML response, length:', xmlText.length);
    
    const parsed = xmlParser.parse(xmlText);
    
    const stations: NDBCStation[] = [];
    const stationList = parsed?.stations?.station;
    
    if (!stationList) {
      console.warn('No stations found in XML response');
      console.log('Parsed structure keys:', Object.keys(parsed || {}));
      return stations;
    }
    
    // Handle single station or array
    const stationsArray = Array.isArray(stationList) ? stationList : [stationList];
    console.log('Total stations in XML:', stationsArray.length);
    
    for (const s of stationsArray) {
      // Only include stations with meteorological data
      if (s.met !== 'y') continue;
      
      // Extract CO-OPS ID from name if present (e.g., "8465705 - New Haven, CT")
      const coopsIdMatch = (s.name || '').match(/^(\d{7})\s*-/)
      const coopsId = coopsIdMatch ? coopsIdMatch[1] : undefined
      
      const station: NDBCStation = {
        id: s.id || '',
        name: s.name || s.id || 'Unknown',
        lat: parseFloat(s.lat) || 0,
        lon: parseFloat(s.lon) || 0,
        type: s.type || 'buoy',
        met: s.met === 'y',
        dart: s.dart === 'y' || s.type?.toLowerCase().includes('dart'),
        owner: s.owner || 'NDBC',
        coopsId,
      };
      
      // Filter out only if BOTH coordinates are 0 (invalid), 
      // but allow stations at equator (lat=0) or prime meridian (lon=0)
      if (station.lat !== 0 || station.lon !== 0) {
        stations.push(station);
      }
    }
    
    console.log(`Loaded ${stations.length} NDBC stations with met data`);
    return stations;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Silently ignore timeout errors
      throw new Error('Request timed out - check your internet connection');
    }
    // Silently ignore network errors
    if (!error?.message?.includes('Network request failed')) {
      console.error('Error fetching NDBC stations:', error);
    }
    throw error;
  }
}

/**
 * Parse NDBC realtime2 text format observation data
 * Format: Space-delimited with # header rows
 * 
 * For NOS/CO-OPS stations that don't have NDBC realtime2 data,
 * this will fall back to fetching from the CO-OPS API if a coopsId is provided.
 * 
 * @param stationId - The NDBC station ID (e.g., "nwhc3")
 * @param coopsId - Optional CO-OPS station ID (e.g., "8465705") for fallback
 */
export async function fetchObservation(stationId: string, coopsId?: string): Promise<NDBCObservation | null> {
  try {
    const response = await fetch(`${NDBC_BASE_URL}/data/realtime2/${stationId}.txt`)
    if (!response.ok) {
      if (response.status === 404) {
        // Try CO-OPS API fallback if we have a CO-OPS ID
        if (coopsId) {
          console.log(`NDBC 404 for ${stationId}, trying CO-OPS fallback with ID ${coopsId}`)
          const coopsObs = await fetchCOOPSMetObs(coopsId, stationId)
          if (coopsObs) {
            return {
              stationId: coopsObs.stationId,
              timestamp: coopsObs.timestamp,
              windDir: coopsObs.windDir,
              windSpeed: coopsObs.windSpeed,
              windGust: coopsObs.windGust,
              airTemp: coopsObs.airTemp,
              waterTemp: coopsObs.waterTemp,
              pressure: coopsObs.pressure,
            }
          }
        }
        return null // Station doesn't have current data
      }
      throw new Error(`Failed to fetch observation: ${response.status}`)
    }
    
    const text = await response.text()
    const lines = text.split('\n')
    
    console.log(`NDBC ${stationId}: Got ${lines.length} lines of data`)
    
    // Find header line (starts with #YY) - NOT the units line which starts with #yr
    // The NDBC format has two header lines:
    //   #YY  MM DD hh mm WDIR WSPD GST... (column names)
    //   #yr  mo dy hr mn degT m/s  m/s... (units)
    let headerLine = ''
    let dataLine = ''
    
    for (const line of lines) {
      // Only match the column names header, not the units header
      if (line.startsWith('#YY')) {
        headerLine = line.substring(1).trim() // Remove # prefix
      } else if (line.trim() && !line.startsWith('#')) {
        dataLine = line.trim()
        break // Get first data line (most recent)
      }
    }
    
    console.log(`NDBC ${stationId}: headerLine="${headerLine.substring(0, 50)}..."`)
    console.log(`NDBC ${stationId}: dataLine="${dataLine.substring(0, 50)}..."`)
    
    if (!headerLine || !dataLine) {
      console.log(`NDBC ${stationId}: Missing header or data line, returning null`)
      return null
    }
    
    const headers = headerLine.split(/\s+/)
    const values = dataLine.split(/\s+/)
    
    console.log(`NDBC ${stationId}: ${headers.length} headers, ${values.length} values`)
    
    // The first 5 columns are always: YY MM DD hh mm (year, month, day, hour, minute)
    // We parse these by position since MM appears twice (month and minute)
    const year = parseInt(values[0] || new Date().getFullYear().toString())
    const month = parseInt(values[1] || '1') - 1
    const day = parseInt(values[2] || '1')
    const hour = parseInt(values[3] || '0')
    const minute = parseInt(values[4] || '0')
    const fullYear = year < 100 ? 2000 + year : year
    
    const timestamp = new Date(Date.UTC(fullYear, month, day, hour, minute))
    
    console.log(`NDBC ${stationId}: Parsed timestamp: ${timestamp.toISOString()}`)
    
    // Build observation object for remaining columns (after the first 5 timestamp columns)
    // Map headers to values, starting from index 5
    const data: Record<string, string> = {}
    for (let i = 5; i < headers.length && i < values.length; i++) {
      data[headers[i].toUpperCase()] = values[i]
    }
    
    console.log(`NDBC ${stationId}: Data keys: ${Object.keys(data).join(', ')}`)
    console.log(`NDBC ${stationId}: WSPD=${data['WSPD']}, ATMP=${data['ATMP']}, WTMP=${data['WTMP']}`)
    
    const observation: NDBCObservation = {
      stationId,
      timestamp,
      windDir: parseValue(data['WDIR']),
      windSpeed: parseValue(data['WSPD']),
      windGust: parseValue(data['GST']),
      waveHeight: parseValue(data['WVHT']),
      dominantWavePeriod: parseValue(data['DPD']),
      avgWavePeriod: parseValue(data['APD']),
      waveDirection: parseValue(data['MWD']),
      pressure: parseValue(data['PRES']),
      pressureTendency: parseValue(data['PTDY']),
      airTemp: parseValue(data['ATMP']),
      waterTemp: parseValue(data['WTMP']),
      dewPoint: parseValue(data['DEWP']),
      visibility: parseValue(data['VIS']),
      tide: parseValue(data['TIDE']),
    }
    
    return observation
  } catch (error: any) {
    // Silently ignore network errors
    if (!error?.message?.includes('Network request failed')) {
      console.error(`Error fetching observation for ${stationId}:`, error)
    }
    throw error
  }
}

/**
 * Parse a value from NDBC data, treating "MM" as missing
 */
function parseValue(value: string | undefined): number | undefined {
  if (!value || value === 'MM' || value === 'N/A') {
    return undefined
  }
  const num = parseFloat(value)
  return isNaN(num) ? undefined : num
}

/**
 * Calculate distance between two coordinates in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Convert meters per second to knots
 */
export function msToKnots(ms: number): number {
  return ms * 1.944
}

/**
 * Convert meters to feet
 */
export function metersToFeet(m: number): number {
  return m * 3.281
}

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(c: number): number {
  return c * 1.8 + 32
}

/**
 * Get wind direction as cardinal text
 */
export function windDirToCardinal(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(degrees / 22.5) % 16
  return directions[index]
}

/**
 * Get condition summary based on observation data
 */
export function getConditionSummary(obs: NDBCObservation): string {
  const conditions: string[] = []
  
  if (obs.windSpeed !== undefined) {
    const knots = msToKnots(obs.windSpeed)
    if (knots >= 34) {
      conditions.push('Gale Force Winds')
    } else if (knots >= 25) {
      conditions.push('Strong Winds')
    } else if (knots >= 17) {
      conditions.push('Fresh Winds')
    } else if (knots >= 11) {
      conditions.push('Moderate Winds')
    } else {
      conditions.push('Light Winds')
    }
  }
  
  if (obs.waveHeight !== undefined) {
    const feet = metersToFeet(obs.waveHeight)
    if (feet >= 10) {
      conditions.push('High Seas')
    } else if (feet >= 6) {
      conditions.push('Rough Seas')
    } else if (feet >= 3) {
      conditions.push('Moderate Seas')
    } else {
      conditions.push('Calm Seas')
    }
  }
  
  return conditions.join(', ') || 'No data'
}

/**
 * Determine marker color based on conditions
 */
export function getMarkerColor(obs: NDBCObservation | null, station: NDBCStation): string {
  // DART buoys are always red (tsunami detection)
  if (station.dart) {
    return '#dc2626' // red-600
  }
  
  if (!obs) {
    return '#6b7280' // gray-500 - no data
  }
  
  // Check wind conditions
  if (obs.windSpeed !== undefined) {
    const knots = msToKnots(obs.windSpeed)
    if (knots >= 34) {
      return '#dc2626' // red-600 - gale
    }
    if (knots >= 25) {
      return '#f59e0b' // amber-500 - strong
    }
  }
  
  // Check wave conditions
  if (obs.waveHeight !== undefined) {
    const feet = metersToFeet(obs.waveHeight)
    if (feet >= 10) {
      return '#dc2626' // red-600
    }
    if (feet >= 6) {
      return '#f59e0b' // amber-500
    }
  }
  
  return '#3b82f6' // blue-500 - normal conditions
}
