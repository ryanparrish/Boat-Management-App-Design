import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import * as Location from 'expo-location'
import { useAppStore } from '../storage/store'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import type { RootStackParamList, NDBCObservation, MarineAlert, MarineForecast } from '../types'
import {
  fetchObservation,
  calculateDistance,
  msToKnots,
  metersToFeet,
  celsiusToFahrenheit,
  windDirToCardinal,
} from '../services/ndbc'
import {
  fetchMarineForecast,
  fetchAlertsForZones,
  isGreatLakesZone,
  getAlertSeverityColor,
  getAlertSeverityIcon,
  formatAlertExpiry,
  checkPressureDrop,
} from '../services/weather'
import { fetchTideObservation } from '../services/coops'

type NavigationProp = StackNavigationProp<RootStackParamList, 'WeatherDashboard'>

export function WeatherDashboard() {
  const navigation = useNavigation<NavigationProp>()
  
  const {
    ndbcStations,
    ndbcObservations,
    subscribedZones,
    cachedAlerts,
    cachedForecasts,
    monitoredBuoyId,
    pressureHistory,
    windHistory,
    weatherAlertSettings,
    isGreatLakesUser,
    pressureUnit,
    setNDBCObservation,
    setCachedAlerts,
    setCachedForecast,
    addPressureReading,
    addWindReading,
    setMonitoredBuoyId,
    setIsGreatLakesUser,
    setPressureUnit,
  } = useAppStore()
  
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [nearestBuoy, setNearestBuoy] = useState<{ id: string; name: string; distance: number } | null>(null)
  const [currentTide, setCurrentTide] = useState<{ level: number; trend: string } | null>(null)

  // Get current observation for monitored buoy
  const currentObs = monitoredBuoyId ? ndbcObservations[monitoredBuoyId] : null
  
  // Get forecasts for subscribed zones
  const forecasts = subscribedZones
    .map(zone => cachedForecasts[zone.id])
    .filter((f): f is MarineForecast => !!f)

  // Check if user is in Great Lakes region
  const showTides = !isGreatLakesUser

  useEffect(() => {
    initializeData()
  }, [])

  const initializeData = async () => {
    setLoading(true)
    try {
      // Get user location
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({})
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
        
        // Find nearest buoy if not already set
        if (!monitoredBuoyId && ndbcStations.length > 0) {
          const nearest = findNearestBuoy(location.coords.latitude, location.coords.longitude)
          if (nearest) {
            setNearestBuoy(nearest)
            setMonitoredBuoyId(nearest.id)
            
            // Check if nearest zone is Great Lakes
            const station = ndbcStations.find(s => s.id === nearest.id)
            if (station?.name) {
              // Check subscribed zones for Great Lakes
              const hasGreatLakes = subscribedZones.some(z => isGreatLakesZone(z.id))
              setIsGreatLakesUser(hasGreatLakes)
            }
          }
        }
      }
      
      // Load data
      await refreshData()
    } catch {
      // Silently ignore all errors
    } finally {
      setLoading(false)
    }
  }

  const findNearestBuoy = (lat: number, lon: number) => {
    if (ndbcStations.length === 0) return null
    
    let nearest = null
    let minDistance = Infinity
    
    for (const station of ndbcStations) {
      const distance = calculateDistance(lat, lon, station.lat, station.lon)
      if (distance < minDistance) {
        minDistance = distance
        nearest = {
          id: station.id,
          name: station.name,
          distance: distance,
        }
      }
    }
    
    return nearest
  }

  const refreshData = async () => {
    try {
      // Refresh buoy observation (NDBC API works fine)
      if (monitoredBuoyId) {
        const station = ndbcStations.find(s => s.id === monitoredBuoyId)
        const obs = await fetchObservation(monitoredBuoyId, station?.coopsId)
        if (obs) {
          setNDBCObservation(monitoredBuoyId, obs)
          
          // Add pressure reading to history
          if (obs.pressure) {
            addPressureReading(monitoredBuoyId, {
              timestamp: obs.timestamp.toISOString(),
              pressure: obs.pressure,
              stationId: monitoredBuoyId,
            })
          }
          
          // Add wind reading to history
          if (obs.windSpeed !== undefined) {
            addWindReading(monitoredBuoyId, {
              timestamp: obs.timestamp.toISOString(),
              windSpeed: obs.windSpeed,
              stationId: monitoredBuoyId,
            })
          }
        }
      }
      
      // Refresh alerts for subscribed zones
      if (subscribedZones.length > 0) {
        const zoneIds = subscribedZones.map(z => z.id)
        const alerts = await fetchAlertsForZones(zoneIds)
        setCachedAlerts(alerts)
      }
      
      // Refresh forecast for first subscribed zone (limit API calls)
      if (subscribedZones.length > 0) {
        const forecast = await fetchMarineForecast(subscribedZones[0].id)
        if (forecast) {
          setCachedForecast(subscribedZones[0].id, forecast)
        }
      }
      
    } catch {
      // Silently ignore all errors
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshData()
    setRefreshing(false)
  }, [monitoredBuoyId, subscribedZones])

  const handleSettingsPress = () => {
    navigation.navigate('WeatherSettings')
  }

  // Check for pressure drop
  const pressureDropInfo = monitoredBuoyId && pressureHistory[monitoredBuoyId]
    ? checkPressureDrop(pressureHistory[monitoredBuoyId], weatherAlertSettings.pressureDropThreshold)
    : null

  // Calculate wind trend over last 3 hours
  const getWindTrend = (): 'up' | 'down' | 'steady' | null => {
    if (!monitoredBuoyId || !windHistory[monitoredBuoyId]) return null
    const readings = windHistory[monitoredBuoyId]
    if (readings.length < 2) return null
    
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000
    const recentReadings = readings.filter(r => new Date(r.timestamp).getTime() > threeHoursAgo)
    if (recentReadings.length < 2) return null
    
    const oldest = recentReadings[0].windSpeed
    const newest = recentReadings[recentReadings.length - 1].windSpeed
    const diff = newest - oldest
    const diffKnots = msToKnots(diff)
    
    // Consider significant if change is > 3 knots
    if (diffKnots > 3) return 'up'
    if (diffKnots < -3) return 'down'
    return 'steady'
  }
  
  const windTrend = getWindTrend()
  
  // Toggle pressure unit
  const handlePressureToggle = () => {
    setPressureUnit(pressureUnit === 'hPa' ? 'mb' : 'hPa')
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Marine Weather</Text>
        {nearestBuoy && (
          <Text style={styles.headerSubtitle}>
            Nearest: {nearestBuoy.name} ({nearestBuoy.distance.toFixed(1)} km)
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
        <Ionicons name="settings-outline" size={24} color={colors.textInverse} />
      </TouchableOpacity>
    </View>
  )

  const renderActiveAlerts = () => {
    if (cachedAlerts.length === 0) return null

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Alerts</Text>
        {cachedAlerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={[styles.alertCard, { borderLeftColor: getAlertSeverityColor(alert.severity) }]}
            onPress={() => Alert.alert(alert.event, alert.description)}
          >
            <View style={styles.alertHeader}>
              <Ionicons
                name={getAlertSeverityIcon(alert.severity) as any}
                size={20}
                color={getAlertSeverityColor(alert.severity)}
              />
              <Text style={styles.alertEvent}>{alert.event}</Text>
            </View>
            <Text style={styles.alertHeadline} numberOfLines={2}>
              {alert.headline}
            </Text>
            <Text style={styles.alertExpiry}>{formatAlertExpiry(alert.expires)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  const renderCurrentConditions = () => {
    if (!currentObs) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Conditions</Text>
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {monitoredBuoyId ? 'Loading buoy data...' : 'No buoy selected'}
            </Text>
            {!monitoredBuoyId && (
              <TouchableOpacity style={styles.selectButton} onPress={handleSettingsPress}>
                <Text style={styles.selectButtonText}>Select a Buoy</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )
    }

    const obs = currentObs

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Conditions</Text>
        
        {/* Pressure Drop Warning */}
        {pressureDropInfo?.hasSignificantDrop && (
          <View style={styles.pressureWarning}>
            <Ionicons name="warning" size={20} color={colors.warning} />
            <Text style={styles.pressureWarningText}>
              Pressure dropped {pressureDropInfo.dropAmount} hPa in {pressureDropInfo.hoursAgo}h
            </Text>
          </View>
        )}

        <View style={styles.conditionsGrid}>
          {/* Wind */}
          {obs.windSpeed !== undefined && (
            <View style={styles.conditionCard}>
              <View style={styles.conditionIconRow}>
                <Ionicons name="compass-outline" size={24} color={colors.skyBlue} />
                {windTrend && (
                  <Ionicons 
                    name={windTrend === 'up' ? 'trending-up' : windTrend === 'down' ? 'trending-down' : 'remove-outline'} 
                    size={16} 
                    color={windTrend === 'up' ? colors.error : windTrend === 'down' ? colors.success : colors.textSecondary} 
                    style={styles.trendIcon}
                  />
                )}
              </View>
              <Text style={styles.conditionValue}>
                {msToKnots(obs.windSpeed).toFixed(0)} kt
              </Text>
              <Text style={styles.conditionLabel}>
                {obs.windDir !== undefined ? windDirToCardinal(obs.windDir) : ''} Wind
              </Text>
              {obs.windGust !== undefined && (
                <Text style={styles.conditionSubtext}>
                  Gusts {msToKnots(obs.windGust).toFixed(0)} kt
                </Text>
              )}
            </View>
          )}

          {/* Waves */}
          {obs.waveHeight !== undefined && (
            <View style={styles.conditionCard}>
              <Ionicons name="water-outline" size={24} color={colors.skyBlue} />
              <Text style={styles.conditionValue}>
                {metersToFeet(obs.waveHeight).toFixed(1)} ft
              </Text>
              <Text style={styles.conditionLabel}>Wave Height</Text>
              {obs.dominantWavePeriod !== undefined && (
                <Text style={styles.conditionSubtext}>
                  {obs.dominantWavePeriod.toFixed(0)}s period
                </Text>
              )}
            </View>
          )}

          {/* Pressure - tappable to toggle units */}
          {obs.pressure !== undefined && (
            <TouchableOpacity style={styles.conditionCard} onPress={handlePressureToggle} activeOpacity={0.7}>
              <Ionicons name="speedometer-outline" size={24} color={colors.skyBlue} />
              <Text style={styles.conditionValue}>
                {obs.pressure.toFixed(0)} {pressureUnit}
              </Text>
              <Text style={styles.conditionLabel}>Pressure</Text>
              {obs.pressureTendency !== undefined && (
                <Text style={[
                  styles.conditionSubtext,
                  { color: obs.pressureTendency < 0 ? colors.error : colors.success }
                ]}>
                  {obs.pressureTendency > 0 ? '+' : ''}{obs.pressureTendency.toFixed(1)} {pressureUnit}/3h
                </Text>
              )}
              <Text style={styles.tapHint}>tap to change unit</Text>
            </TouchableOpacity>
          )}

          {/* Air Temp */}
          {obs.airTemp !== undefined && (
            <View style={styles.conditionCard}>
              <Ionicons name="thermometer-outline" size={24} color={colors.skyBlue} />
              <Text style={styles.conditionValue}>
                {celsiusToFahrenheit(obs.airTemp).toFixed(0)}°F
              </Text>
              <Text style={styles.conditionLabel}>Air Temp</Text>
            </View>
          )}

          {/* Water Temp */}
          {obs.waterTemp !== undefined && (
            <View style={styles.conditionCard}>
              <Ionicons name="water" size={24} color={colors.skyBlue} />
              <Text style={styles.conditionValue}>
                {celsiusToFahrenheit(obs.waterTemp).toFixed(0)}°F
              </Text>
              <Text style={styles.conditionLabel}>Water Temp</Text>
            </View>
          )}
        </View>

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          Updated: {new Date(obs.timestamp).toLocaleString()}
        </Text>
      </View>
    )
  }

  const renderTides = () => {
    if (!showTides) return null

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tides</Text>
        <View style={styles.emptyCard}>
          <Ionicons name="analytics-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.emptyText}>
            Tide data coming soon
          </Text>
        </View>
      </View>
    )
  }

  const renderForecast = () => {
    if (forecasts.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marine Forecast</Text>
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {subscribedZones.length === 0 
                ? 'No zones subscribed'
                : 'Loading forecast...'}
            </Text>
            {subscribedZones.length === 0 && (
              <TouchableOpacity style={styles.selectButton} onPress={handleSettingsPress}>
                <Text style={styles.selectButtonText}>Add Marine Zones</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Marine Forecast</Text>
        {forecasts.map((forecast) => (
          <View key={forecast.zoneId} style={styles.forecastCard}>
            <Text style={styles.forecastZone}>{forecast.zoneName}</Text>
            {forecast.periods.slice(0, 3).map((period) => (
              <View key={period.number} style={styles.forecastPeriod}>
                <Text style={styles.periodName}>{period.name}</Text>
                <View style={styles.periodDetails}>
                  {period.windSpeed && (
                    <View style={styles.periodDetail}>
                      <Ionicons name="compass-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.periodDetailText}>
                        {period.windDirection} {period.windSpeed}
                      </Text>
                    </View>
                  )}
                  {period.waveHeight && (
                    <View style={styles.periodDetail}>
                      <Ionicons name="water-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.periodDetailText}>{period.waveHeight}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.periodForecast} numberOfLines={3}>
                  {period.detailedForecast}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.skyBlue} />
        <Text style={styles.loadingText}>Loading weather data...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderHeader()}
      {renderActiveAlerts()}
      {renderCurrentConditions()}
      {renderTides()}
      {renderForecast()}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.navy,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  section: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
    marginBottom: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alertEvent: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
    marginLeft: spacing.sm,
  },
  alertHeadline: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  alertExpiry: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  emptyCard: {
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  selectButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.skyBlue,
    borderRadius: borderRadius.md,
  },
  selectButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  pressureWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  pressureWarningText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  conditionCard: {
    width: '33.33%',
    padding: spacing.xs,
  },
  conditionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    marginLeft: spacing.xs,
  },
  conditionValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    marginTop: spacing.xs,
  },
  conditionLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  conditionSubtext: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  tapHint: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  forecastCard: {
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  forecastZone: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.skyBlue,
    marginBottom: spacing.md,
  },
  forecastPeriod: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate600,
  },
  periodName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
    marginBottom: spacing.xs,
  },
  periodDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  periodDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.xs,
  },
  periodDetailText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  periodForecast: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
})
