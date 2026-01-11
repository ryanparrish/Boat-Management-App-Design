import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { useAppStore } from '../storage/store'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import type { RootStackParamList, NDBCObservation } from '../types'
import {
  fetchObservation,
  msToKnots,
  metersToFeet,
  celsiusToFahrenheit,
  windDirToCardinal,
  getConditionSummary,
} from '../services/ndbc'

type BuoyDetailRouteProp = RouteProp<RootStackParamList, 'BuoyDetail'>

export function BuoyDetail() {
  const route = useRoute<BuoyDetailRouteProp>()
  const { stationId, stationName } = route.params
  
  const { 
    ndbcObservations, 
    ndbcStations,
    setNDBCObservation,
    isObservationCacheValid 
  } = useAppStore()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const observation = ndbcObservations[stationId]
  const station = ndbcStations.find(s => s.id === stationId)

  useEffect(() => {
    if (!isObservationCacheValid(stationId)) {
      loadObservation()
    }
  }, [stationId])

  const loadObservation = async () => {
    try {
      setLoading(true)
      setError(null)
      const obs = await fetchObservation(stationId, station?.coopsId)
      if (obs) {
        setNDBCObservation(stationId, obs)
      } else {
        setError('No current data available for this station.')
      }
    } catch (err) {
      setError('Failed to load observation data.')
    } finally {
      setLoading(false)
    }
  }

  const openStationPage = () => {
    // For NOS/CO-OPS stations, open the tidesandcurrents page instead of NDBC
    if (station?.coopsId) {
      Linking.openURL(`https://tidesandcurrents.noaa.gov/stationhome.html?id=${station.coopsId}`)
    } else {
      Linking.openURL(`https://www.ndbc.noaa.gov/station_page.php?station=${stationId}`)
    }
  }

  const formatTimestamp = (date: Date) => {
    // Handle serialized date from storage
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  const getAgeText = (date: Date) => {
    const d = date instanceof Date ? date : new Date(date)
    const minutes = Math.floor((Date.now() - d.getTime()) / 60000)
    if (minutes < 60) {
      return `${minutes} min ago`
    }
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m ago`
  }

  const renderDataCard = (
    title: string,
    icon: string,
    items: { label: string; value: string | undefined; unit?: string }[]
  ) => {
    const hasData = items.some(item => item.value !== undefined)
    if (!hasData) return null

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name={icon as any} size={20} color={colors.skyBlue} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <View style={styles.cardContent}>
          {items.map((item, index) => (
            item.value !== undefined && (
              <View key={index} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{item.label}</Text>
                <Text style={styles.dataValue}>
                  {item.value}
                  {item.unit && <Text style={styles.dataUnit}> {item.unit}</Text>}
                </Text>
              </View>
            )
          ))}
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadObservation} />
      }
    >
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.stationId}>{stationId}</Text>
        <Text style={styles.stationName}>{stationName}</Text>
        {station && (
          <View style={styles.stationMeta}>
            <Text style={styles.metaText}>
              {station.lat.toFixed(3)}°, {station.lon.toFixed(3)}°
            </Text>
            <Text style={styles.metaText}>•</Text>
            <Text style={styles.metaText}>{station.type}</Text>
            {station.dart && (
              <>
                <Text style={styles.metaText}>•</Text>
                <Text style={[styles.metaText, styles.dartBadge]}>DART</Text>
              </>
            )}
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="warning" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {observation && (
        <>
          {/* Condition Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              {getConditionSummary(observation)}
            </Text>
            <Text style={styles.timestampText}>
              {formatTimestamp(observation.timestamp)} ({getAgeText(observation.timestamp)})
            </Text>
          </View>

          {/* Wind Data */}
          {renderDataCard('Wind', 'compass', [
            { 
              label: 'Speed', 
              value: observation.windSpeed !== undefined 
                ? msToKnots(observation.windSpeed).toFixed(1) 
                : undefined,
              unit: 'knots'
            },
            { 
              label: 'Gusts', 
              value: observation.windGust !== undefined 
                ? msToKnots(observation.windGust).toFixed(1) 
                : undefined,
              unit: 'knots'
            },
            { 
              label: 'Direction', 
              value: observation.windDir !== undefined 
                ? `${observation.windDir}° (${windDirToCardinal(observation.windDir)})`
                : undefined
            },
          ])}

          {/* Wave Data */}
          {renderDataCard('Waves', 'water', [
            { 
              label: 'Height', 
              value: observation.waveHeight !== undefined 
                ? metersToFeet(observation.waveHeight).toFixed(1) 
                : undefined,
              unit: 'ft'
            },
            { 
              label: 'Dominant Period', 
              value: observation.dominantWavePeriod?.toFixed(1),
              unit: 'sec'
            },
            { 
              label: 'Average Period', 
              value: observation.avgWavePeriod?.toFixed(1),
              unit: 'sec'
            },
            { 
              label: 'Direction', 
              value: observation.waveDirection !== undefined 
                ? `${observation.waveDirection}° (${windDirToCardinal(observation.waveDirection)})`
                : undefined
            },
          ])}

          {/* Temperature Data */}
          {renderDataCard('Temperature', 'thermometer', [
            { 
              label: 'Water', 
              value: observation.waterTemp !== undefined 
                ? celsiusToFahrenheit(observation.waterTemp).toFixed(1) 
                : undefined,
              unit: '°F'
            },
            { 
              label: 'Air', 
              value: observation.airTemp !== undefined 
                ? celsiusToFahrenheit(observation.airTemp).toFixed(1) 
                : undefined,
              unit: '°F'
            },
            { 
              label: 'Dew Point', 
              value: observation.dewPoint !== undefined 
                ? celsiusToFahrenheit(observation.dewPoint).toFixed(1) 
                : undefined,
              unit: '°F'
            },
          ])}

          {/* Atmospheric Data */}
          {renderDataCard('Atmosphere', 'cloudy', [
            { 
              label: 'Pressure', 
              value: observation.pressure?.toFixed(1),
              unit: 'hPa'
            },
            { 
              label: 'Pressure Change', 
              value: observation.pressureTendency !== undefined 
                ? (observation.pressureTendency > 0 ? '+' : '') + observation.pressureTendency.toFixed(1)
                : undefined,
              unit: 'hPa/3hr'
            },
            { 
              label: 'Visibility', 
              value: observation.visibility?.toFixed(1),
              unit: 'nm'
            },
          ])}

          {/* Tide Data */}
          {observation.tide !== undefined && renderDataCard('Tide', 'analytics', [
            { 
              label: 'Level', 
              value: observation.tide.toFixed(1),
              unit: 'ft'
            },
          ])}
        </>
      )}

      {/* Station Link */}
      <TouchableOpacity style={styles.linkButton} onPress={openStationPage}>
        <Ionicons name="open-outline" size={18} color={colors.skyBlue} />
        <Text style={styles.linkText}>
          View on {station?.coopsId ? 'NOAA Tides & Currents' : 'NDBC'} Website
        </Text>
      </TouchableOpacity>

      {/* Data Source Attribution */}
      <Text style={styles.attribution}>
        Data provided by {station?.coopsId ? 'NOAA CO-OPS' : 'NOAA National Data Buoy Center'}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  header: {
    marginBottom: spacing.lg,
  },
  stationId: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stationName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  dartBadge: {
    color: colors.error,
    fontWeight: fontWeight.semibold,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  summaryText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  timestampText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.error,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  cardContent: {
    padding: spacing.md,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dataLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  dataValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  dataUnit: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    color: colors.textMuted,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  linkText: {
    fontSize: fontSize.md,
    color: colors.skyBlue,
    fontWeight: fontWeight.medium,
  },
  attribution: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
})
