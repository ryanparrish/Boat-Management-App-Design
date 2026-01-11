import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native'
import MapView, { Marker, Callout, PROVIDER_GOOGLE, PROVIDER_DEFAULT, Region } from 'react-native-maps'
import ClusteredMapView from 'react-native-map-clustering'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useAppStore } from '../storage/store'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import type { RootStackParamList, NDBCStation, NDBCObservation, TideStation, TideObservation } from '../types'
import {
  fetchActiveStations,
  fetchObservation,
  calculateDistance,
  getMarkerColor,
  msToKnots,
  metersToFeet,
  celsiusToFahrenheit,
  getConditionSummary,
} from '../services/ndbc'
import {
  fetchTideStations,
  fetchTideObservation,
  getTideMarkerColor,
  formatWaterLevel,
} from '../services/coops'

const { width, height } = Dimensions.get('window')

type NavigationProp = StackNavigationProp<RootStackParamList, 'BuoyMap'>

const INITIAL_REGION = {
  latitude: 30.0,
  longitude: -80.0,
  latitudeDelta: 15,
  longitudeDelta: 15,
}

const MAX_NEARBY_DISTANCE_KM = 300 // ~160 nautical miles

// Combined station type for unified rendering
type MapStation = 
  | { type: 'weather'; station: NDBCStation }
  | { type: 'tide'; station: TideStation }

export function BuoyMap() {
  const navigation = useNavigation<NavigationProp>()
  const mapRef = useRef<MapView>(null)
  
  const {
    ndbcStations,
    ndbcObservations,
    setNDBCStations,
    setNDBCObservation,
    isStationsCacheValid,
    isObservationCacheValid,
    tideStations,
    tideObservations,
    setTideStations,
    setTideObservation,
    isTideStationsCacheValid,
    isTideObservationCacheValid,
  } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [loadingObservations, setLoadingObservations] = useState(false)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [nearbyFilter, setNearbyFilter] = useState(false)
  const [selectedStation, setSelectedStation] = useState<MapStation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visibleWeatherStations, setVisibleWeatherStations] = useState<NDBCStation[]>([])
  const [visibleTideStations, setVisibleTideStations] = useState<TideStation[]>([])
  const [region, setRegion] = useState<Region>(INITIAL_REGION)
  const [stationTypeFilter, setStationTypeFilter] = useState<'all' | 'weather' | 'tide'>('all')

  // Load stations on mount
  useEffect(() => {
    loadAllStations()
  }, [])

  // Update visible weather stations when filter or stations change
  useEffect(() => {
    console.log(`Updating visible weather stations. nearbyFilter: ${nearbyFilter}, ndbcStations: ${ndbcStations.length}`);
    
    if (nearbyFilter && userLocation) {
      const nearby = ndbcStations.filter(station => {
        const dist = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          station.lat,
          station.lon
        )
        return dist <= MAX_NEARBY_DISTANCE_KM
      })
      console.log(`Filtered to ${nearby.length} nearby weather stations`);
      setVisibleWeatherStations(nearby)
    } else {
      console.log(`Setting all ${ndbcStations.length} weather stations as visible`);
      setVisibleWeatherStations(ndbcStations)
    }
  }, [nearbyFilter, userLocation, ndbcStations])

  // Update visible tide stations when filter or stations change
  useEffect(() => {
    console.log(`Updating visible tide stations. nearbyFilter: ${nearbyFilter}, tideStations: ${tideStations.length}`);
    
    if (nearbyFilter && userLocation) {
      const nearby = tideStations.filter(station => {
        const dist = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          station.lat,
          station.lon
        )
        return dist <= MAX_NEARBY_DISTANCE_KM
      })
      console.log(`Filtered to ${nearby.length} nearby tide stations`);
      setVisibleTideStations(nearby)
      
      // Zoom to show all nearby stations
      const allNearby = [
        ...visibleWeatherStations.map(s => ({ lat: s.lat, lon: s.lon })),
        ...nearby.map(s => ({ lat: s.lat, lon: s.lon })),
      ]
      if (allNearby.length > 0 && mapRef.current) {
        const lats = allNearby.map(s => s.lat)
        const lons = allNearby.map(s => s.lon)
        const minLat = Math.min(...lats, userLocation.latitude)
        const maxLat = Math.max(...lats, userLocation.latitude)
        const minLon = Math.min(...lons, userLocation.longitude)
        const maxLon = Math.max(...lons, userLocation.longitude)
        
        mapRef.current.animateToRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max((maxLat - minLat) * 1.3, 1),
          longitudeDelta: Math.max((maxLon - minLon) * 1.3, 1),
        }, 500)
      }
    } else {
      console.log(`Setting all ${tideStations.length} tide stations as visible`);
      setVisibleTideStations(tideStations)
    }
  }, [nearbyFilter, userLocation, tideStations])

  // Load observations for visible stations (limited to first 20 each)
  useEffect(() => {
    if (visibleWeatherStations.length > 0 || visibleTideStations.length > 0) {
      loadVisibleObservations()
    }
  }, [visibleWeatherStations, visibleTideStations])

  const loadAllStations = async () => {
    try {
      setError(null)
      setLoading(true)
      
      // Load both station types in parallel
      const loadWeather = async () => {
        if (isStationsCacheValid() && ndbcStations.length > 0) {
          console.log(`Using cached NDBC stations: ${ndbcStations.length}`)
          return
        }
        console.log('Fetching fresh NDBC stations...')
        const stations = await fetchActiveStations()
        console.log(`Fetched ${stations.length} weather stations`)
        if (stations.length > 0) {
          setNDBCStations(stations)
        }
      }
      
      const loadTides = async () => {
        if (isTideStationsCacheValid() && tideStations.length > 0) {
          console.log(`Using cached tide stations: ${tideStations.length}`)
          return
        }
        console.log('Fetching fresh tide stations...')
        const stations = await fetchTideStations()
        console.log(`Fetched ${stations.length} tide stations`)
        if (stations.length > 0) {
          setTideStations(stations)
        }
      }
      
      await Promise.all([loadWeather(), loadTides()])
      
      if (ndbcStations.length === 0 && tideStations.length === 0) {
        setError('No stations available. Try again later.')
      }
    } catch (err: any) {
      // Silently ignore network errors
      const message = err?.message || ''
      if (!message.includes('Network request failed')) {
        console.error('Error loading stations:', err)
      }
      const errorMessage = err?.message || 'Failed to load stations.'
      if (ndbcStations.length > 0 || tideStations.length > 0) {
        setError(`${errorMessage} Showing cached data.`)
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadVisibleObservations = async () => {
    // Only load for first 15 stations of each type to avoid too many requests
    const weatherToLoad = visibleWeatherStations
      .filter(s => !isObservationCacheValid(s.id))
      .slice(0, 15)
    
    const tideToLoad = visibleTideStations
      .filter(s => !isTideObservationCacheValid(s.id))
      .slice(0, 15)
    
    if (weatherToLoad.length === 0 && tideToLoad.length === 0) return
    
    setLoadingObservations(true)
    try {
      await Promise.all([
        // Load weather observations
        ...weatherToLoad.map(async (station) => {
          try {
            const obs = await fetchObservation(station.id, station.coopsId)
            if (obs) {
              setNDBCObservation(station.id, obs)
            }
          } catch {
            // Ignore individual station errors
          }
        }),
        // Load tide observations
        ...tideToLoad.map(async (station) => {
          try {
            const obs = await fetchTideObservation(station.id)
            if (obs) {
              setTideObservation(station.id, obs)
            }
          } catch {
            // Ignore individual station errors
          }
        }),
      ])
    } finally {
      setLoadingObservations(false)
    }
  }

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to find nearby buoys.')
        return
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      })
      
      setNearbyFilter(true)
    } catch (err) {
      Alert.alert('Error', 'Failed to get your location.')
    }
  }

  const toggleNearbyFilter = () => {
    if (!nearbyFilter && !userLocation) {
      getCurrentLocation()
    } else {
      setNearbyFilter(!nearbyFilter)
      if (nearbyFilter) {
        // Reset to full view
        mapRef.current?.animateToRegion(INITIAL_REGION, 500)
      }
    }
  }

  const cycleStationTypeFilter = () => {
    setStationTypeFilter(prev => {
      if (prev === 'all') return 'weather'
      if (prev === 'weather') return 'tide'
      return 'all'
    })
  }

  const handleWeatherMarkerPress = (station: NDBCStation) => {
    setSelectedStation({ type: 'weather', station })
    // Load observation if not cached
    if (!isObservationCacheValid(station.id)) {
      fetchObservation(station.id, station.coopsId).then(obs => {
        if (obs) {
          setNDBCObservation(station.id, obs)
        }
      }).catch(() => {})
    }
  }

  const handleTideMarkerPress = (station: TideStation) => {
    setSelectedStation({ type: 'tide', station })
    // Load observation if not cached
    if (!isTideObservationCacheValid(station.id)) {
      fetchTideObservation(station.id).then(obs => {
        if (obs) {
          setTideObservation(station.id, obs)
        }
      }).catch(() => {})
    }
  }

  const handleWeatherCalloutPress = (station: NDBCStation) => {
    navigation.navigate('BuoyDetail', { 
      stationId: station.id, 
      stationName: station.name 
    })
  }

  const handleTideCalloutPress = (station: TideStation) => {
    navigation.navigate('TideStationDetail', { 
      stationId: station.id, 
      stationName: station.name 
    })
  }

  const renderWeatherMarker = useCallback((station: NDBCStation) => {
    const observation = ndbcObservations[station.id]
    const markerColor = getMarkerColor(observation, station)
    
    return (
      <Marker
        key={`weather-${station.id}`}
        identifier={`weather-${station.id}`}
        coordinate={{ latitude: station.lat, longitude: station.lon }}
        tracksViewChanges={false}
        onPress={() => handleWeatherMarkerPress(station)}
      >
        <View style={[styles.markerContainer, { backgroundColor: markerColor }]}>
          <Ionicons 
            name={station.dart ? 'warning' : 'water'} 
            size={16} 
            color="#fff" 
          />
        </View>
        <Callout 
          style={styles.callout}
          onPress={() => handleWeatherCalloutPress(station)}
        >
          <View style={styles.calloutContent}>
            <Text style={styles.calloutTitle} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={styles.calloutId}>{station.id} • Weather Buoy</Text>
            {observation ? (
              <>
                <Text style={styles.calloutCondition}>
                  {getConditionSummary(observation)}
                </Text>
                <View style={styles.calloutStats}>
                  {observation.windSpeed !== undefined && (
                    <Text style={styles.calloutStat}>
                      💨 {msToKnots(observation.windSpeed).toFixed(0)} kt
                    </Text>
                  )}
                  {observation.waveHeight !== undefined && (
                    <Text style={styles.calloutStat}>
                      🌊 {metersToFeet(observation.waveHeight).toFixed(1)} ft
                    </Text>
                  )}
                  {observation.waterTemp !== undefined && (
                    <Text style={styles.calloutStat}>
                      🌡️ {celsiusToFahrenheit(observation.waterTemp).toFixed(0)}°F
                    </Text>
                  )}
                </View>
                <Text style={styles.calloutTap}>Tap for details →</Text>
              </>
            ) : (
              <Text style={styles.calloutLoading}>Loading data...</Text>
            )}
          </View>
        </Callout>
      </Marker>
    )
  }, [ndbcObservations])

  const renderTideMarker = useCallback((station: TideStation) => {
    const observation = tideObservations[station.id]
    const markerColor = getTideMarkerColor(observation)
    
    return (
      <Marker
        key={`tide-${station.id}`}
        identifier={`tide-${station.id}`}
        coordinate={{ latitude: station.lat, longitude: station.lon }}
        tracksViewChanges={false}
        onPress={() => handleTideMarkerPress(station)}
      >
        <View style={[styles.markerContainer, styles.tideMarker, { backgroundColor: markerColor }]}>
          <Ionicons 
            name="analytics" 
            size={16} 
            color="#fff" 
          />
        </View>
        <Callout 
          style={styles.callout}
          onPress={() => handleTideCalloutPress(station)}
        >
          <View style={styles.calloutContent}>
            <Text style={styles.calloutTitle} numberOfLines={1}>
              {station.name}
            </Text>
            <Text style={styles.calloutId}>{station.id} • Tide Station</Text>
            {observation ? (
              <>
                <Text style={styles.calloutCondition}>
                  Water Level: {formatWaterLevel(observation.waterLevel)}
                </Text>
                <Text style={styles.calloutTap}>Tap for 12-hour chart →</Text>
              </>
            ) : (
              <Text style={styles.calloutLoading}>Loading data...</Text>
            )}
          </View>
        </Callout>
      </Marker>
    )
  }, [tideObservations])

  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion)
  }

  // Get filtered stations based on type filter
  const getFilteredWeatherStations = () => {
    if (stationTypeFilter === 'tide') return []
    return visibleWeatherStations
  }

  const getFilteredTideStations = () => {
    if (stationTypeFilter === 'weather') return []
    return visibleTideStations
  }

  const totalStationCount = 
    (stationTypeFilter !== 'tide' ? visibleWeatherStations.length : 0) +
    (stationTypeFilter !== 'weather' ? visibleTideStations.length : 0)

  return (
    <View style={styles.container}>
      {/* Map */}
      <ClusteredMapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        clusterColor={colors.skyBlue}
        radius={60}
        extent={512}
        minZoomLevel={2}
        maxZoomLevel={18}
        animationEnabled={false}
        minPoints={2}
      >
        {getFilteredWeatherStations().map(renderWeatherMarker)}
        {getFilteredTideStations().map(renderTideMarker)}
      </ClusteredMapView>

      {/* Loading overlay */}
      {(loading || loadingObservations) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.skyBlue} />
          <Text style={styles.loadingText}>
            {loading ? 'Loading stations...' : 'Loading weather data...'}
          </Text>
        </View>
      )}

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, nearbyFilter && styles.controlButtonActive]}
          onPress={toggleNearbyFilter}
        >
          <Ionicons 
            name="locate" 
            size={22} 
            color={nearbyFilter ? '#fff' : colors.textPrimary} 
          />
          <Text style={[
            styles.controlText,
            nearbyFilter && styles.controlTextActive
          ]}>
            Near Me
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={cycleStationTypeFilter}
        >
          <Ionicons 
            name={stationTypeFilter === 'weather' ? 'cloud' : stationTypeFilter === 'tide' ? 'analytics' : 'layers'} 
            size={22} 
            color={colors.textPrimary} 
          />
          <Text style={styles.controlText}>
            {stationTypeFilter === 'all' ? 'All' : stationTypeFilter === 'weather' ? 'Weather' : 'Tides'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={loadAllStations}
        >
          <Ionicons name="refresh" size={22} color={colors.textPrimary} />
          <Text style={styles.controlText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Weather Buoys</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.legendText}>Normal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>Caution</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
          <Text style={styles.legendText}>Warning</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#6b7280' }]} />
          <Text style={styles.legendText}>No Data</Text>
        </View>
        <View style={styles.legendDivider} />
        <Text style={styles.legendTitle}>Tide Stations</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0891b2' }]} />
          <Text style={styles.legendText}>Tide Level</Text>
        </View>
      </View>

      {/* Station count */}
      <View style={styles.stationCount}>
        <Text style={styles.stationCountText}>
          {totalStationCount} stations
          {nearbyFilter ? ' nearby' : ''}
        </Text>
        {stationTypeFilter !== 'all' && (
          <Text style={styles.stationCountSubtext}>
            ({stationTypeFilter} only)
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  errorBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    color: '#fff',
    fontSize: fontSize.sm,
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    right: spacing.md,
    gap: spacing.sm,
  },
  controlButton: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.md,
  },
  controlButtonActive: {
    backgroundColor: colors.skyBlue,
  },
  controlText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  controlTextActive: {
    color: '#fff',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    ...shadows.sm,
  },
  tideMarker: {
    borderRadius: 8, // Square-ish for tide stations
  },
  callout: {
    width: 220,
  },
  calloutContent: {
    padding: spacing.sm,
  },
  calloutTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  calloutId: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  calloutCondition: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  calloutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  calloutStat: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  calloutLoading: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  calloutTap: {
    fontSize: fontSize.xs,
    color: colors.skyBlue,
    marginTop: spacing.xs,
  },
  legend: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  legendTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 4,
  },
  legendDivider: {
    height: 1,
    backgroundColor: colors.slate200,
    marginVertical: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: 2,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  stationCount: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  stationCountText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  stationCountSubtext: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
})
