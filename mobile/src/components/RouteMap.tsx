import React from 'react'
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import type { Coordinates } from '../types'

const { width } = Dimensions.get('window')

interface RouteMapProps {
  departureCoords?: Coordinates
  destinationCoords?: Coordinates
  departureName?: string
  destinationName?: string
}

export function RouteMap({
  departureCoords,
  destinationCoords,
  departureName,
  destinationName,
}: RouteMapProps) {
  if (!departureCoords && !destinationCoords) {
    return null
  }

  // Calculate region to fit both points
  const getRegion = () => {
    if (departureCoords && destinationCoords) {
      const minLat = Math.min(departureCoords.latitude, destinationCoords.latitude)
      const maxLat = Math.max(departureCoords.latitude, destinationCoords.latitude)
      const minLng = Math.min(departureCoords.longitude, destinationCoords.longitude)
      const maxLng = Math.max(departureCoords.longitude, destinationCoords.longitude)

      const latDelta = (maxLat - minLat) * 1.5 || 0.1
      const lngDelta = (maxLng - minLng) * 1.5 || 0.1

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(latDelta, 0.05),
        longitudeDelta: Math.max(lngDelta, 0.05),
      }
    }

    const coords = departureCoords || destinationCoords!
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={getRegion()}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {departureCoords && (
          <Marker
            coordinate={departureCoords}
            title={departureName || 'Departure'}
            pinColor={colors.success}
          />
        )}

        {destinationCoords && (
          <Marker
            coordinate={destinationCoords}
            title={destinationName || 'Destination'}
            pinColor={colors.error}
          />
        )}

        {departureCoords && destinationCoords && (
          <Polyline
            coordinates={[departureCoords, destinationCoords]}
            strokeColor={colors.skyBlue}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      <View style={styles.legend}>
        {departureCoords && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.departureDot]} />
            <Text style={styles.legendText}>Start</Text>
          </View>
        )}
        {destinationCoords && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.destinationDot]} />
            <Text style={styles.legendText}>End</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  map: {
    width: '100%',
    height: 200,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  departureDot: {
    backgroundColor: colors.success,
  },
  destinationDot: {
    backgroundColor: colors.error,
  },
  legendText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
})
