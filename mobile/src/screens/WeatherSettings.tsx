import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import * as Location from 'expo-location'
import { useAppStore } from '../storage/store'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import type { SubscribedZone, NDBCStation } from '../types'
import {
  fetchMarineZones,
  findNearestMarineZones,
  isGreatLakesZone,
  MarineZone,
} from '../services/weather'
import { calculateDistance } from '../services/ndbc'

export function WeatherSettings() {
  const navigation = useNavigation()
  
  const {
    ndbcStations,
    subscribedZones,
    weatherAlertSettings,
    monitoredBuoyId,
    isGreatLakesUser,
    setSubscribedZones,
    addSubscribedZone,
    removeSubscribedZone,
    setWeatherAlertSettings,
    setMonitoredBuoyId,
    setIsGreatLakesUser,
  } = useAppStore()
  
  const [loading, setLoading] = useState(false)
  const [availableZones, setAvailableZones] = useState<MarineZone[]>([])
  const [showZonePicker, setShowZonePicker] = useState(false)
  const [showBuoyPicker, setShowBuoyPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      // Get user location
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({})
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
      }
    } catch (error) {
      console.error('Error getting location:', error)
    }
  }

  const loadMarineZones = async () => {
    setLoading(true)
    try {
      const coastal = await fetchMarineZones('coastal')
      setAvailableZones(coastal)
    } catch (error) {
      // Silently ignore network errors
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('Network request failed')) {
        console.error('Error loading marine zones:', error)
        Alert.alert('Error', 'Failed to load marine zones. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddZone = () => {
    setShowZonePicker(true)
    if (availableZones.length === 0) {
      loadMarineZones()
    }
  }

  const handleSelectZone = (zone: MarineZone) => {
    const isGL = isGreatLakesZone(zone.id)
    
    const subscribedZone: SubscribedZone = {
      id: zone.id,
      name: zone.name,
      type: zone.type as 'coastal' | 'offshore',
      isGreatLakes: isGL,
    }
    
    addSubscribedZone(subscribedZone)
    
    // Update Great Lakes user flag if any subscribed zone is Great Lakes
    if (isGL) {
      setIsGreatLakesUser(true)
    }
    
    setShowZonePicker(false)
  }

  const handleRemoveZone = (zoneId: string) => {
    Alert.alert(
      'Remove Zone',
      'Are you sure you want to remove this marine zone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeSubscribedZone(zoneId)
            
            // Update Great Lakes flag
            const remainingZones = subscribedZones.filter(z => z.id !== zoneId)
            const hasGreatLakes = remainingZones.some(z => z.isGreatLakes)
            setIsGreatLakesUser(hasGreatLakes)
          },
        },
      ]
    )
  }

  const handleAutoDetectZones = async () => {
    if (!userLocation) {
      Alert.alert('Location Required', 'Please enable location services to auto-detect nearby marine zones.')
      return
    }

    setLoading(true)
    try {
      const nearbyZones = await findNearestMarineZones(
        userLocation.latitude,
        userLocation.longitude,
        3
      )
      
      if (nearbyZones.length === 0) {
        Alert.alert('No Zones Found', 'Could not find any marine zones near your location.')
        return
      }
      
      // Add nearest zones
      for (const zone of nearbyZones) {
        const isGL = isGreatLakesZone(zone.id)
        addSubscribedZone({
          id: zone.id,
          name: zone.name,
          type: zone.type as 'coastal' | 'offshore',
          isGreatLakes: isGL,
        })
        
        if (isGL) {
          setIsGreatLakesUser(true)
        }
      }
      
      Alert.alert('Success', `Added ${nearbyZones.length} nearby marine zone(s).`)
    } catch (error) {
      // Silently ignore network errors
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('Network request failed')) {
        console.error('Error auto-detecting zones:', error)
        Alert.alert('Error', 'Failed to detect nearby zones. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSelectBuoy = (station: NDBCStation) => {
    setMonitoredBuoyId(station.id)
    setShowBuoyPicker(false)
  }

  const toggleAlertSetting = (key: keyof typeof weatherAlertSettings) => {
    if (key === 'pressureDropThreshold') return
    
    setWeatherAlertSettings({
      ...weatherAlertSettings,
      [key]: !weatherAlertSettings[key],
    })
  }

  const updatePressureThreshold = (value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0 && num <= 20) {
      setWeatherAlertSettings({
        ...weatherAlertSettings,
        pressureDropThreshold: num,
      })
    }
  }

  // Filter and sort buoys by distance
  const sortedBuoys = React.useMemo(() => {
    let buoys = [...ndbcStations]
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      buoys = buoys.filter(
        b => b.id.toLowerCase().includes(query) || b.name.toLowerCase().includes(query)
      )
    }
    
    // Sort by distance if we have location
    if (userLocation) {
      buoys.sort((a, b) => {
        const distA = calculateDistance(userLocation.latitude, userLocation.longitude, a.lat, a.lon)
        const distB = calculateDistance(userLocation.latitude, userLocation.longitude, b.lat, b.lon)
        return distA - distB
      })
    }
    
    return buoys.slice(0, 50) // Limit for performance
  }, [ndbcStations, searchQuery, userLocation])

  // Filter zones by search
  const filteredZones = React.useMemo(() => {
    if (!searchQuery) return availableZones
    
    const query = searchQuery.toLowerCase()
    return availableZones.filter(
      z => z.id.toLowerCase().includes(query) || z.name.toLowerCase().includes(query)
    )
  }, [availableZones, searchQuery])

  const monitoredBuoy = ndbcStations.find(s => s.id === monitoredBuoyId)

  const renderZonePicker = () => (
    <Modal
      visible={showZonePicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowZonePicker(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Marine Zone</Text>
          <TouchableOpacity onPress={() => setShowZonePicker(false)}>
            <Ionicons name="close" size={24} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search zones..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.skyBlue} />
            <Text style={styles.loadingText}>Loading zones...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredZones}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSubscribed = subscribedZones.some(z => z.id === item.id)
              const isGL = isGreatLakesZone(item.id)
              
              return (
                <TouchableOpacity
                  style={[styles.listItem, isSubscribed && styles.listItemDisabled]}
                  onPress={() => !isSubscribed && handleSelectZone(item)}
                  disabled={isSubscribed}
                >
                  <View style={styles.listItemContent}>
                    <Text style={styles.listItemTitle}>{item.name}</Text>
                    <Text style={styles.listItemSubtitle}>
                      {item.id} {isGL ? '• Great Lakes' : ''}
                    </Text>
                  </View>
                  {isSubscribed ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color={colors.skyBlue} />
                  )}
                </TouchableOpacity>
              )
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No zones found</Text>
            }
          />
        )}
      </View>
    </Modal>
  )

  const renderBuoyPicker = () => (
    <Modal
      visible={showBuoyPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowBuoyPicker(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Buoy</Text>
          <TouchableOpacity onPress={() => setShowBuoyPicker(false)}>
            <Ionicons name="close" size={24} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search buoys..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={sortedBuoys}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = item.id === monitoredBuoyId
            const distance = userLocation
              ? calculateDistance(userLocation.latitude, userLocation.longitude, item.lat, item.lon)
              : null

            return (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => handleSelectBuoy(item)}
              >
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemTitle}>{item.name}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {item.id}
                    {distance !== null && ` • ${distance.toFixed(1)} km away`}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                )}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No buoys found</Text>
          }
        />
      </View>
    </Modal>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Marine Zones Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Marine Zones</Text>
        <Text style={styles.sectionDescription}>
          Subscribe to marine zones to receive forecasts and alerts.
        </Text>

        {subscribedZones.map((zone) => (
          <View key={zone.id} style={styles.zoneCard}>
            <View style={styles.zoneInfo}>
              <Text style={styles.zoneName}>{zone.name}</Text>
              <Text style={styles.zoneId}>
                {zone.id}
                {zone.isGreatLakes && ' • Great Lakes'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveZone(zone.id)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.addButton, styles.buttonHalf]}
            onPress={handleAddZone}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.skyBlue} />
            <Text style={styles.addButtonText}>Add Zone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addButton, styles.buttonHalf]}
            onPress={handleAutoDetectZones}
            disabled={loading}
          >
            <Ionicons name="locate-outline" size={20} color={colors.skyBlue} />
            <Text style={styles.addButtonText}>Auto-Detect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Monitored Buoy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monitored Buoy</Text>
        <Text style={styles.sectionDescription}>
          Select a buoy for current conditions and pressure monitoring.
        </Text>

        <TouchableOpacity
          style={styles.selectCard}
          onPress={() => {
            setSearchQuery('')
            setShowBuoyPicker(true)
          }}
        >
          {monitoredBuoy ? (
            <>
              <View style={styles.selectInfo}>
                <Text style={styles.selectTitle}>{monitoredBuoy.name}</Text>
                <Text style={styles.selectSubtitle}>{monitoredBuoy.id}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </>
          ) : (
            <>
              <Text style={styles.selectPlaceholder}>Select a buoy...</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Alert Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Preferences</Text>
        <Text style={styles.sectionDescription}>
          Choose which alerts you want to receive notifications for.
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="boat-outline" size={24} color={colors.warning} />
            <Text style={styles.settingLabel}>Small Craft Advisory</Text>
          </View>
          <Switch
            value={weatherAlertSettings.smallCraftAdvisory}
            onValueChange={() => toggleAlertSetting('smallCraftAdvisory')}
            trackColor={{ false: colors.slate600, true: colors.skyBlue }}
            thumbColor={colors.textInverse}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="thunderstorm-outline" size={24} color={colors.error} />
            <Text style={styles.settingLabel}>Gale Warning</Text>
          </View>
          <Switch
            value={weatherAlertSettings.galeWarning}
            onValueChange={() => toggleAlertSetting('galeWarning')}
            trackColor={{ false: colors.slate600, true: colors.skyBlue }}
            thumbColor={colors.textInverse}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="alert-circle-outline" size={24} color="#7c2d12" />
            <Text style={styles.settingLabel}>Storm Warning</Text>
          </View>
          <Switch
            value={weatherAlertSettings.stormWarning}
            onValueChange={() => toggleAlertSetting('stormWarning')}
            trackColor={{ false: colors.slate600, true: colors.skyBlue }}
            thumbColor={colors.textInverse}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="trending-down-outline" size={24} color={colors.skyBlue} />
            <Text style={styles.settingLabel}>Pressure Drop Alert</Text>
          </View>
          <Switch
            value={weatherAlertSettings.pressureDrop}
            onValueChange={() => toggleAlertSetting('pressureDrop')}
            trackColor={{ false: colors.slate600, true: colors.skyBlue }}
            thumbColor={colors.textInverse}
          />
        </View>

        {weatherAlertSettings.pressureDrop && (
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>
              Alert when pressure drops more than
            </Text>
            <View style={styles.thresholdInputContainer}>
              <TextInput
                style={styles.thresholdInput}
                value={weatherAlertSettings.pressureDropThreshold.toString()}
                onChangeText={updatePressureThreshold}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.thresholdUnit}>hPa in 3 hours</Text>
            </View>
          </View>
        )}
      </View>

      {/* Great Lakes Notice */}
      {isGreatLakesUser && (
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.skyBlue} />
          <Text style={styles.noticeText}>
            Tide information is hidden for Great Lakes zones as they don't have significant tidal variations.
          </Text>
        </View>
      )}

      {renderZonePicker()}
      {renderBuoyPicker()}
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
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate600,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textInverse,
  },
  zoneId: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  removeButton: {
    padding: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  buttonHalf: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate600,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: fontSize.sm,
    color: colors.skyBlue,
    marginLeft: spacing.sm,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  selectInfo: {
    flex: 1,
  },
  selectTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textInverse,
  },
  selectSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate600,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: fontSize.md,
    color: colors.textInverse,
    marginLeft: spacing.md,
  },
  thresholdRow: {
    paddingVertical: spacing.md,
  },
  thresholdLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  thresholdInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thresholdInput: {
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textInverse,
    width: 60,
    textAlign: 'center',
  },
  thresholdUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    margin: spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.skyBlue,
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate600,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textInverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.slate700,
    borderRadius: borderRadius.md,
  },
  listItemDisabled: {
    opacity: 0.6,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textInverse,
  },
  listItemSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.xl,
  },
})
