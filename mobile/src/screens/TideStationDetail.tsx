import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { useAppStore } from '../storage/store'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import type { RootStackParamList, TideDataPoint } from '../types'
import {
  fetchTideObservation,
  fetchTideData12Hours,
  fetchHighLowTides,
  formatTideTime,
  formatWaterLevel,
  getTideTrend,
} from '../services/coops'

type TideStationDetailRouteProp = RouteProp<RootStackParamList, 'TideStationDetail'>

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 2
const CHART_HEIGHT = 200
const CHART_PADDING = { top: 20, right: 20, bottom: 40, left: 50 }

export function TideStationDetail() {
  const route = useRoute<TideStationDetailRouteProp>()
  const { stationId, stationName } = route.params
  
  const { 
    tideStations,
    tideObservations, 
    setTideObservation,
    isTideObservationCacheValid 
  } = useAppStore()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<{
    observations: TideDataPoint[]
    predictions: TideDataPoint[]
    stationName: string
    datum: string
  } | null>(null)
  const [highLow, setHighLow] = useState<{
    highs: { time: Date; height: number }[]
    lows: { time: Date; height: number }[]
  } | null>(null)
  
  const observation = tideObservations[stationId]
  const station = tideStations.find(s => s.id === stationId)

  useEffect(() => {
    loadAllData()
  }, [stationId])

  const loadAllData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch all data in parallel
      const [obs, chart, hilo] = await Promise.all([
        !isTideObservationCacheValid(stationId) 
          ? fetchTideObservation(stationId)
          : Promise.resolve(null),
        fetchTideData12Hours(stationId),
        fetchHighLowTides(stationId),
      ])
      
      if (obs) {
        setTideObservation(stationId, obs)
      }
      
      if (chart) {
        setChartData(chart)
      }
      
      if (hilo) {
        setHighLow(hilo)
      }
      
      if (!obs && !observation && !chart) {
        setError('No tide data available for this station.')
      }
    } catch (err) {
      setError('Failed to load tide data.')
    } finally {
      setLoading(false)
    }
  }

  const openCOOPSPage = () => {
    Linking.openURL(`https://tidesandcurrents.noaa.gov/stationhome.html?id=${stationId}`)
  }

  // Calculate chart scaling
  const chartScaling = useMemo(() => {
    if (!chartData) return null
    
    const allPoints = [...chartData.observations, ...chartData.predictions]
    if (allPoints.length === 0) return null
    
    const values = allPoints.map(p => p.value)
    const times = allPoints.map(p => p.timestamp.getTime())
    
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    
    // Add padding to value range
    const valuePadding = (maxValue - minValue) * 0.1 || 0.5
    
    const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
    const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
    
    const scaleX = (time: number) => 
      CHART_PADDING.left + ((time - minTime) / (maxTime - minTime)) * innerWidth
    
    const scaleY = (value: number) => 
      CHART_PADDING.top + innerHeight - 
      ((value - (minValue - valuePadding)) / ((maxValue + valuePadding) - (minValue - valuePadding))) * innerHeight
    
    return {
      scaleX,
      scaleY,
      minValue: minValue - valuePadding,
      maxValue: maxValue + valuePadding,
      minTime,
      maxTime,
      innerWidth,
      innerHeight,
    }
  }, [chartData])

  // Generate SVG path for a series of points
  const generatePath = (points: TideDataPoint[], scaling: typeof chartScaling) => {
    if (!points.length || !scaling) return ''
    
    const sortedPoints = [...points].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    )
    
    return sortedPoints.map((point, index) => {
      const x = scaling.scaleX(point.timestamp.getTime())
      const y = scaling.scaleY(point.value)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  // Get tide trend from recent observations
  const currentTrend = useMemo(() => {
    if (!chartData || chartData.observations.length < 2) return null
    
    const sorted = [...chartData.observations].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    )
    const latest = sorted[sorted.length - 1]
    const previous = sorted[sorted.length - 2]
    
    return getTideTrend(latest.value, previous.value)
  }, [chartData])

  const formatTimestamp = (date: Date) => {
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

  // Render the tide chart as a simple SVG-like component
  const renderTideChart = () => {
    if (!chartData || !chartScaling) {
      return (
        <View style={styles.chartPlaceholder}>
          <Text style={styles.noDataText}>No chart data available</Text>
        </View>
      )
    }

    // Generate time labels
    const timeLabels: { time: Date; x: number }[] = []
    const timeRange = chartScaling.maxTime - chartScaling.minTime
    const labelCount = 6
    for (let i = 0; i <= labelCount; i++) {
      const time = new Date(chartScaling.minTime + (timeRange * i / labelCount))
      timeLabels.push({
        time,
        x: chartScaling.scaleX(time.getTime()),
      })
    }

    // Generate value labels
    const valueLabels: { value: number; y: number }[] = []
    const valueRange = chartScaling.maxValue - chartScaling.minValue
    const vLabelCount = 4
    for (let i = 0; i <= vLabelCount; i++) {
      const value = chartScaling.minValue + (valueRange * i / vLabelCount)
      valueLabels.push({
        value,
        y: chartScaling.scaleY(value),
      })
    }

    // Current time marker
    const now = Date.now()
    const nowX = now >= chartScaling.minTime && now <= chartScaling.maxTime
      ? chartScaling.scaleX(now)
      : null

    return (
      <View style={styles.chartContainer}>
        <View style={[styles.chart, { width: CHART_WIDTH, height: CHART_HEIGHT }]}>
          {/* Y-axis labels */}
          {valueLabels.map((label, i) => (
            <View
              key={`y-${i}`}
              style={[
                styles.yLabel,
                { top: label.y - 8 }
              ]}
            >
              <Text style={styles.axisLabel}>{label.value.toFixed(1)}</Text>
            </View>
          ))}

          {/* Horizontal grid lines */}
          {valueLabels.map((label, i) => (
            <View
              key={`grid-${i}`}
              style={[
                styles.gridLine,
                { 
                  top: label.y,
                  left: CHART_PADDING.left,
                  width: chartScaling.innerWidth,
                }
              ]}
            />
          ))}

          {/* Zero line (MLLW) */}
          {chartScaling.minValue <= 0 && chartScaling.maxValue >= 0 && (
            <View
              style={[
                styles.zeroLine,
                {
                  top: chartScaling.scaleY(0),
                  left: CHART_PADDING.left,
                  width: chartScaling.innerWidth,
                }
              ]}
            />
          )}

          {/* Predicted tide line (dashed effect via dots) */}
          {chartData.predictions.map((point, i) => (
            <View
              key={`pred-${i}`}
              style={[
                styles.predictionDot,
                {
                  left: chartScaling.scaleX(point.timestamp.getTime()) - 2,
                  top: chartScaling.scaleY(point.value) - 2,
                }
              ]}
            />
          ))}

          {/* Observed tide line (solid dots connected) */}
          {chartData.observations.map((point, i) => (
            <View
              key={`obs-${i}`}
              style={[
                styles.observationDot,
                {
                  left: chartScaling.scaleX(point.timestamp.getTime()) - 3,
                  top: chartScaling.scaleY(point.value) - 3,
                }
              ]}
            />
          ))}

          {/* Current time marker */}
          {nowX !== null && (
            <View
              style={[
                styles.nowLine,
                {
                  left: nowX,
                  top: CHART_PADDING.top,
                  height: chartScaling.innerHeight,
                }
              ]}
            />
          )}

          {/* X-axis labels */}
          {timeLabels.map((label, i) => (
            <View
              key={`x-${i}`}
              style={[
                styles.xLabel,
                { left: label.x - 25, bottom: 5 }
              ]}
            >
              <Text style={styles.axisLabel}>
                {formatTideTime(label.time)}
              </Text>
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0891b2' }]} />
            <Text style={styles.legendText}>Observed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#94a3b8' }]} />
            <Text style={styles.legendText}>Predicted</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#dc2626', width: 2 }]} />
            <Text style={styles.legendText}>Now</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadAllData} />
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
            {station.state && (
              <>
                <Text style={styles.metaText}>•</Text>
                <Text style={styles.metaText}>{station.state}</Text>
              </>
            )}
            <Text style={styles.metaText}>•</Text>
            <View style={styles.tideBadge}>
              <Ionicons name="water" size={12} color="#0891b2" />
              <Text style={styles.tideText}>Tide Station</Text>
            </View>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="warning" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Current Level Card */}
      {observation && (
        <View style={styles.currentCard}>
          <View style={styles.currentHeader}>
            <Ionicons name="water" size={24} color="#0891b2" />
            <Text style={styles.currentTitle}>Current Water Level</Text>
          </View>
          <View style={styles.currentContent}>
            <Text style={styles.currentLevel}>
              {formatWaterLevel(observation.waterLevel)}
            </Text>
            <Text style={styles.currentDatum}>MLLW</Text>
          </View>
          {currentTrend && (
            <View style={styles.trendRow}>
              <Ionicons 
                name={currentTrend === 'rising' ? 'arrow-up' : currentTrend === 'falling' ? 'arrow-down' : 'remove'}
                size={18}
                color={currentTrend === 'rising' ? '#22c55e' : currentTrend === 'falling' ? '#f59e0b' : '#6b7280'}
              />
              <Text style={styles.trendText}>
                {currentTrend === 'rising' ? 'Rising' : currentTrend === 'falling' ? 'Falling' : 'Slack'}
              </Text>
            </View>
          )}
          <Text style={styles.timestampText}>
            {formatTimestamp(observation.timestamp)} ({getAgeText(observation.timestamp)})
          </Text>
        </View>
      )}

      {/* 12-Hour Tide Chart */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="analytics" size={20} color={colors.skyBlue} />
          <Text style={styles.cardTitle}>12-Hour Tide Chart</Text>
        </View>
        {renderTideChart()}
      </View>

      {/* High/Low Tides */}
      {highLow && (highLow.highs.length > 0 || highLow.lows.length > 0) && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="swap-vertical" size={20} color={colors.skyBlue} />
            <Text style={styles.cardTitle}>High & Low Tides</Text>
          </View>
          <View style={styles.hiloContainer}>
            {/* Highs */}
            <View style={styles.hiloColumn}>
              <Text style={styles.hiloLabel}>High Tides</Text>
              {highLow.highs.map((h, i) => (
                <View key={`high-${i}`} style={styles.hiloItem}>
                  <Ionicons name="arrow-up-circle" size={16} color="#22c55e" />
                  <Text style={styles.hiloTime}>{formatTideTime(h.time)}</Text>
                  <Text style={styles.hiloHeight}>{formatWaterLevel(h.height)}</Text>
                </View>
              ))}
              {highLow.highs.length === 0 && (
                <Text style={styles.noHiloText}>No high tides in range</Text>
              )}
            </View>
            
            {/* Lows */}
            <View style={styles.hiloColumn}>
              <Text style={styles.hiloLabel}>Low Tides</Text>
              {highLow.lows.map((l, i) => (
                <View key={`low-${i}`} style={styles.hiloItem}>
                  <Ionicons name="arrow-down-circle" size={16} color="#f59e0b" />
                  <Text style={styles.hiloTime}>{formatTideTime(l.time)}</Text>
                  <Text style={styles.hiloHeight}>{formatWaterLevel(l.height)}</Text>
                </View>
              ))}
              {highLow.lows.length === 0 && (
                <Text style={styles.noHiloText}>No low tides in range</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* External Link */}
      <TouchableOpacity style={styles.linkButton} onPress={openCOOPSPage}>
        <Ionicons name="open-outline" size={18} color={colors.skyBlue} />
        <Text style={styles.linkText}>View on NOAA Tides & Currents</Text>
      </TouchableOpacity>

      {/* Datum Info */}
      <View style={styles.datumInfo}>
        <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
        <Text style={styles.datumInfoText}>
          Water levels shown relative to MLLW (Mean Lower Low Water)
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    marginBottom: spacing.lg,
  },
  stationId: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  stationName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfeff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  tideText: {
    fontSize: fontSize.xs,
    color: '#0891b2',
    fontWeight: fontWeight.medium,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: fontSize.sm,
  },
  currentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 2,
    borderColor: '#0891b2',
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  currentTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  currentContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  currentLevel: {
    fontSize: 42,
    fontWeight: fontWeight.bold,
    color: '#0891b2',
    fontFamily: 'monospace',
  },
  currentDatum: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  trendText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  timestampText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chart: {
    position: 'relative',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  noDataText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  yLabel: {
    position: 'absolute',
    left: 5,
  },
  xLabel: {
    position: 'absolute',
    width: 50,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: colors.slate200,
    opacity: 0.5,
  },
  zeroLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#94a3b8',
  },
  observationDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0891b2',
  },
  predictionDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
  },
  nowLine: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#dc2626',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  hiloContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  hiloColumn: {
    flex: 1,
  },
  hiloLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  hiloItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    gap: spacing.sm,
  },
  hiloTime: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  hiloHeight: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  noHiloText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  linkText: {
    color: colors.skyBlue,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  datumInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  datumInfoText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
})
