import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Platform,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps'
import * as Location from 'expo-location'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import { MapPin, Navigation, X, Check, Search } from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import type { Coordinates } from '../types'

const { width, height } = Dimensions.get('window')

// Google Places API Key
const GOOGLE_PLACES_API_KEY = 'AIzaSyCmR-rvBwnZoN3XGfY_zE_TfgQ51dX62DQ'

interface LocationPickerProps {
  label: string
  value: string
  onChangeText: (text: string) => void
  coordinates?: Coordinates
  onCoordinatesChange: (coords: Coordinates | undefined) => void
  placeholder?: string
}

export function LocationPicker({
  label,
  value,
  onChangeText,
  coordinates,
  onCoordinatesChange,
  placeholder,
}: LocationPickerProps) {
  const [showMap, setShowMap] = useState(false)
  const [showPlacesSearch, setShowPlacesSearch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tempCoords, setTempCoords] = useState<Coordinates | undefined>(coordinates)
  const mapRef = useRef<MapView>(null)
  const placesRef = useRef<any>(null)

  const defaultRegion = {
    latitude: coordinates?.latitude || 37.7749, // Default to San Francisco
    longitude: coordinates?.longitude || -122.4194,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }

  const getCurrentLocation = async () => {
    setLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please enable location permissions to use this feature.'
        )
        setLoading(false)
        return
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const coords: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }

      setTempCoords(coords)
      onCoordinatesChange(coords)

      // Reverse geocode to get address
      try {
        const [address] = await Location.reverseGeocodeAsync(coords)
        if (address) {
          const addressString = [
            address.name,
            address.street,
            address.city,
            address.region,
          ]
            .filter(Boolean)
            .join(', ')
          if (addressString) {
            onChangeText(addressString)
          }
        }
      } catch (geocodeError) {
        // If reverse geocode fails, just use coordinates
        onChangeText(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`)
      }

      // Animate map to new location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        })
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location')
    } finally {
      setLoading(false)
    }
  }

  const handleMapPress = async (event: any) => {
    const coords: Coordinates = {
      latitude: event.nativeEvent.coordinate.latitude,
      longitude: event.nativeEvent.coordinate.longitude,
    }
    setTempCoords(coords)

    // Reverse geocode
    try {
      const [address] = await Location.reverseGeocodeAsync(coords)
      if (address) {
        const addressString = [
          address.name,
          address.street,
          address.city,
          address.region,
        ]
          .filter(Boolean)
          .join(', ')
        if (addressString) {
          onChangeText(addressString)
        }
      }
    } catch (error) {
      // Use coordinates if geocode fails
      onChangeText(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`)
    }
  }

  const handleConfirm = () => {
    onCoordinatesChange(tempCoords)
    setShowMap(false)
  }

  const handleCancel = () => {
    setTempCoords(coordinates)
    setShowMap(false)
  }

  const openMapPicker = () => {
    setTempCoords(coordinates)
    setShowMap(true)
  }

  const handlePlaceSelect = (data: any, details: any) => {
    if (details?.geometry?.location) {
      const coords: Coordinates = {
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
      }
      setTempCoords(coords)
      onCoordinatesChange(coords)
      onChangeText(data.description || details.formatted_address || details.name)
      setShowPlacesSearch(false)
      
      // If map is open, animate to new location
      if (mapRef.current && showMap) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        })
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      <View style={styles.inputRow}>
        <TouchableOpacity 
          style={styles.inputTouchable}
          onPress={() => setShowPlacesSearch(true)}
        >
          <View style={styles.inputWithIcon}>
            <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
            <Text 
              style={[styles.inputText, !value && styles.placeholderText]}
              numberOfLines={1}
            >
              {value || placeholder || 'Search for a location...'}
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Navigation size={20} color={colors.textInverse} />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.mapButton} onPress={openMapPicker}>
          <MapPin size={20} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      {coordinates && (
        <Text style={styles.coordsText}>
          📍 {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
        </Text>
      )}

      {/* Google Places Search Modal */}
      <Modal visible={showPlacesSearch} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.placesModalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPlacesSearch(false)} style={styles.modalButton}>
              <X size={24} color={colors.error} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Search Location</Text>
            <View style={styles.modalButton} />
          </View>
          
          <View style={styles.placesContainer}>
            <GooglePlacesAutocomplete
              ref={placesRef}
              placeholder="Search marinas, ports, cities..."
              onPress={handlePlaceSelect}
              fetchDetails={true}
              query={{
                key: GOOGLE_PLACES_API_KEY,
                language: 'en',
              }}
              onFail={(error) => console.log('Places API Error:', error)}
              onNotFound={() => console.log('No results found')}
              styles={{
                container: {
                  flex: 0,
                },
                textInputContainer: {
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                  paddingTop: spacing.md,
                },
                textInput: {
                  backgroundColor: colors.slate100,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: fontSize.md,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.slate200,
                  height: 48,
                },
                listView: {
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                },
                row: {
                  backgroundColor: colors.surface,
                  paddingVertical: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.slate200,
                },
                description: {
                  color: colors.textPrimary,
                  fontSize: fontSize.sm,
                },
                poweredContainer: {
                  display: 'none',
                },
                powered: {
                  display: 'none',
                },
              }}
              enablePoweredByContainer={false}
              textInputProps={{
                autoFocus: true,
                placeholderTextColor: colors.textMuted,
              }}
              nearbyPlacesAPI="GooglePlacesSearch"
              debounce={300}
              minLength={2}
              renderRow={(rowData) => (
                <View style={styles.placeRow}>
                  <MapPin size={18} color={colors.skyBlue} />
                  <View style={styles.placeTextContainer}>
                    <Text style={styles.placeMainText} numberOfLines={1}>
                      {rowData.structured_formatting?.main_text || rowData.description}
                    </Text>
                    {rowData.structured_formatting?.secondary_text && (
                      <Text style={styles.placeSecondaryText} numberOfLines={1}>
                        {rowData.structured_formatting.secondary_text}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            />
            
            <TouchableOpacity
              style={styles.manualEntryButton}
              onPress={() => {
                setShowPlacesSearch(false)
                setShowMap(true)
              }}
            >
              <MapPin size={18} color={colors.textSecondary} />
              <Text style={styles.manualEntryText}>Pick location on map instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map Modal */}
      <Modal visible={showMap} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCancel} style={styles.modalButton}>
              <X size={24} color={colors.error} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Location</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.modalButton}>
              <Check size={24} color={colors.success} />
            </TouchableOpacity>
          </View>

          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={defaultRegion}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton
          >
            {tempCoords && (
              <Marker
                coordinate={tempCoords}
                draggable
                onDragEnd={(e) => {
                  const coords: Coordinates = {
                    latitude: e.nativeEvent.coordinate.latitude,
                    longitude: e.nativeEvent.coordinate.longitude,
                  }
                  setTempCoords(coords)
                }}
              />
            )}
          </MapView>

          <View style={styles.mapInstructions}>
            <Text style={styles.instructionsText}>
              Tap on the map or drag the marker to select a location
            </Text>
            <TouchableOpacity
              style={styles.useCurrentButton}
              onPress={getCurrentLocation}
            >
              <Navigation size={16} color={colors.textInverse} />
              <Text style={styles.useCurrentButtonText}>Use Current Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputTouchable: {
    flex: 1,
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    height: 44,
    justifyContent: 'center',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  inputText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  placeholderText: {
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  locationButton: {
    backgroundColor: colors.skyBlue,
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  mapButton: {
    backgroundColor: colors.success,
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  coordsText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  placesModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placesContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  placeTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  placeMainText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  placeSecondaryText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    marginTop: spacing.lg,
  },
  manualEntryText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  modalButton: {
    padding: spacing.sm,
    width: 40,
  },
  map: {
    flex: 1,
    width: width,
  },
  mapInstructions: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  instructionsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  useCurrentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skyBlue,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  useCurrentButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.sm,
  },
})
