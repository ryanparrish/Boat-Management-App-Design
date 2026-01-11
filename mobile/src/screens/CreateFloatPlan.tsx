import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
  FlatList,
} from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
  Ship,
  MapPin,
  Clock,
  Users,
  Plus,
  X,
  Save,
  Fuel,
  AlertCircle,
  Phone,
  UserPlus,
  ChevronDown,
  Heart,
  Timer,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore, TANK_LOG_STALE_HOURS } from '../storage/store'
import { floatPlansApi } from '../services/supabase'
import { isOnline } from '../services/sync'
import {
  requestNotificationPermission,
  hasAskedForPermission,
  scheduleCheckInReminders,
} from '../services/notifications'
import { LocationPicker, TankLevelInput } from '../components'
import type { RootStackParamList, FloatPlan, Coordinates, TankReading, CrewMember, Contact } from '../types'

type NavigationProp = StackNavigationProp<RootStackParamList>
type RouteType = RouteProp<RootStackParamList, 'CreateFloatPlan'>

// Duration presets in hours
const DURATION_PRESETS = [
  { label: '1 hour', value: 1 },
  { label: '2 hours', value: 2 },
  { label: '4 hours', value: 4 },
  { label: '6 hours', value: 6 },
  { label: '8 hours', value: 8 },
  { label: 'Custom', value: 0 },
]

// Escalation wait time options in minutes
const ESCALATION_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
]

export function CreateFloatPlan() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteType>()
  const editPlan = route.params?.editPlan

  const { 
    floatPlans, 
    boats, 
    contacts,
    addFloatPlan, 
    updateFloatPlan, 
    addSyncOperation, 
    user,
    getLatestTankLog,
    isTankLogStale,
    addTankLog,
  } = useAppStore((s) => ({
    floatPlans: s.floatPlans,
    boats: s.boats,
    contacts: s.contacts,
    addFloatPlan: s.addFloatPlan,
    updateFloatPlan: s.updateFloatPlan,
    addSyncOperation: s.addSyncOperation,
    user: s.user,
    getLatestTankLog: s.getLatestTankLog,
    isTankLogStale: s.isTankLogStale,
    addTankLog: s.addTankLog,
  }))

  const existingPlan = editPlan

  const [loading, setLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showReturnTimePicker, setShowReturnTimePicker] = useState(false)
  const [showBoatPicker, setShowBoatPicker] = useState(false)
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [showEmergencyContactPicker, setShowEmergencyContactPicker] = useState<'primary' | 'secondary' | null>(null)
  const [showTankLogPrompt, setShowTankLogPrompt] = useState(false)

  // Form state
  const [selectedBoatId, setSelectedBoatId] = useState(existingPlan?.boatId || '')
  const [vesselName, setVesselName] = useState(existingPlan?.vesselName || '')
  const [vesselType, setVesselType] = useState(existingPlan?.vesselType || '')
  const [departure, setDeparture] = useState(existingPlan?.departure || '')
  const [departureCoords, setDepartureCoords] = useState<Coordinates | undefined>(existingPlan?.departureCoords)
  const [destination, setDestination] = useState(existingPlan?.destination || '')
  const [destinationCoords, setDestinationCoords] = useState<Coordinates | undefined>(existingPlan?.destinationCoords)
  const [routeDetails, setRouteDetails] = useState(existingPlan?.route || '')
  const [checkInDeadline, setCheckInDeadline] = useState<Date>(
    existingPlan ? new Date(existingPlan.checkInDeadline) : new Date(Date.now() + 4 * 60 * 60 * 1000)
  )
  const [gracePeriod, setGracePeriod] = useState(String(existingPlan?.gracePeriod || 30))
  const [notes, setNotes] = useState(existingPlan?.notes || '')
  
  // Enhanced crew - now with age and medical info
  const [crew, setCrew] = useState<CrewMember[]>(
    (existingPlan?.crew as CrewMember[]) || []
  )
  const [editingCrewMember, setEditingCrewMember] = useState<CrewMember | null>(null)
  const [crewName, setCrewName] = useState('')
  const [crewAge, setCrewAge] = useState('')
  const [crewMedicalNotes, setCrewMedicalNotes] = useState('')

  // Expected return time
  const [returnTimeMode, setReturnTimeMode] = useState<'duration' | 'specific'>('duration')
  const [tripDurationHours, setTripDurationHours] = useState<number>(existingPlan?.tripDurationHours || 4)
  const [expectedReturnTime, setExpectedReturnTime] = useState<Date | undefined>(
    existingPlan?.expectedReturnTime ? new Date(existingPlan.expectedReturnTime) : undefined
  )

  // Emergency contacts
  const [primaryEmergencyContactId, setPrimaryEmergencyContactId] = useState<string | undefined>(
    existingPlan?.primaryEmergencyContactId
  )
  const [secondaryEmergencyContactId, setSecondaryEmergencyContactId] = useState<string | undefined>(
    existingPlan?.secondaryEmergencyContactId
  )
  const [escalationWaitMinutes, setEscalationWaitMinutes] = useState(existingPlan?.escalationWaitMinutes || 30)

  // Tank levels
  const [departureTanks, setDepartureTanks] = useState<TankReading>(existingPlan?.departureTanks || {})

  // Get selected boat and its tank log status
  const selectedBoat = useMemo(() => boats.find(b => b.id === selectedBoatId), [boats, selectedBoatId])
  const latestTankLog = selectedBoatId ? getLatestTankLog(selectedBoatId) : null
  const tankLogIsStale = selectedBoatId ? isTankLogStale(selectedBoatId) : false

  // Get emergency contacts
  const primaryContact = contacts.find(c => c.id === primaryEmergencyContactId)
  const secondaryContact = contacts.find(c => c.id === secondaryEmergencyContactId)
  const emergencyContacts = contacts.filter(c => c.isEmergencyContact)

  const selectBoat = (boatId: string) => {
    const boat = boats.find(b => b.id === boatId)
    if (boat) {
      setSelectedBoatId(boat.id)
      setVesselName(boat.name)
      if (boat.type) setVesselType(boat.type)
      
      // Auto-fill home port as departure location
      if (boat.homePort && !departure) {
        setDeparture(boat.homePort)
        if (boat.homePortCoords) {
          setDepartureCoords(boat.homePortCoords)
        }
      }
      
      // Check if tank log is stale
      if (isTankLogStale(boat.id)) {
        setShowTankLogPrompt(true)
      } else {
        // Pre-fill tank levels from latest log
        const log = getLatestTankLog(boat.id)
        if (log) {
          setDepartureTanks({
            fuel: log.fuel,
            water: log.water,
            blackwater: log.blackwater,
          })
        }
      }
    }
    setShowBoatPicker(false)
  }

  const addCrewMember = () => {
    if (crewName.trim()) {
      const newMember: CrewMember = {
        id: `crew_${Date.now()}`,
        name: crewName.trim(),
        age: crewAge ? parseInt(crewAge) : undefined,
        medicalNotes: crewMedicalNotes.trim() || undefined,
      }
      setCrew([...crew, newMember])
      resetCrewForm()
      setShowCrewModal(false)
    }
  }

  const addCrewFromContact = (contact: Contact) => {
    const newMember: CrewMember = {
      id: `crew_${Date.now()}`,
      name: contact.name,
      contactId: contact.id,
      age: undefined,
      medicalNotes: undefined,
    }
    setCrew([...crew, newMember])
    setShowContactPicker(false)
  }

  const updateCrewMember = () => {
    if (editingCrewMember && crewName.trim()) {
      setCrew(crew.map(c => 
        c.id === editingCrewMember.id 
          ? {
              ...c,
              name: crewName.trim(),
              age: crewAge ? parseInt(crewAge) : undefined,
              medicalNotes: crewMedicalNotes.trim() || undefined,
            }
          : c
      ))
      resetCrewForm()
      setShowCrewModal(false)
    }
  }

  const editCrewMemberModal = (member: CrewMember) => {
    setEditingCrewMember(member)
    setCrewName(member.name)
    setCrewAge(member.age?.toString() || '')
    setCrewMedicalNotes(member.medicalNotes || '')
    setShowCrewModal(true)
  }

  const resetCrewForm = () => {
    setEditingCrewMember(null)
    setCrewName('')
    setCrewAge('')
    setCrewMedicalNotes('')
  }

  const removeCrewMember = (id: string) => {
    setCrew(crew.filter(c => c.id !== id))
  }

  const selectEmergencyContact = (contact: Contact) => {
    if (showEmergencyContactPicker === 'primary') {
      setPrimaryEmergencyContactId(contact.id)
    } else if (showEmergencyContactPicker === 'secondary') {
      setSecondaryEmergencyContactId(contact.id)
    }
    setShowEmergencyContactPicker(null)
  }

  const handleLogTanksNow = () => {
    setShowTankLogPrompt(false)
    // Tank levels will be filled in the form below
  }

  const handleSkipTankLog = () => {
    setShowTankLogPrompt(false)
    // Use latest log if available
    if (latestTankLog) {
      setDepartureTanks({
        fuel: latestTankLog.fuel,
        water: latestTankLog.water,
        blackwater: latestTankLog.blackwater,
      })
    }
  }

  const handleSave = async () => {
    if (!vesselName.trim()) {
      Alert.alert('Error', 'Please enter a vessel name')
      return
    }
    if (!departure.trim()) {
      Alert.alert('Error', 'Please enter a departure location')
      return
    }
    if (!destination.trim()) {
      Alert.alert('Error', 'Please enter a destination')
      return
    }

    setLoading(true)

    // Request notification permission contextually (first time creating a plan)
    if (!hasAskedForPermission()) {
      const granted = await requestNotificationPermission()
      if (granted) {
        // Permission granted, will schedule notifications
      }
    }

    // Save tank log if levels were entered and boat is selected
    let departureTankLogId: string | undefined
    if (selectedBoatId && Object.values(departureTanks).some(v => v !== undefined)) {
      const tankLogId = `tanklog_${Date.now()}`
      addTankLog({
        id: tankLogId,
        boatId: selectedBoatId,
        timestamp: new Date().toISOString(),
        fuel: departureTanks.fuel,
        water: departureTanks.water,
        blackwater: departureTanks.blackwater,
        notes: 'Float plan departure',
      })
      departureTankLogId = tankLogId
    }

    // Calculate expected return time if using duration
    let calculatedReturnTime = expectedReturnTime?.toISOString()
    if (returnTimeMode === 'duration' && tripDurationHours > 0) {
      const returnDate = new Date(Date.now() + tripDurationHours * 60 * 60 * 1000)
      calculatedReturnTime = returnDate.toISOString()
    }

    const planData = {
      boatId: selectedBoatId || undefined,
      vesselName: vesselName.trim(),
      vesselType: vesselType.trim() || undefined,
      departure: departure.trim(),
      departureCoords,
      destination: destination.trim(),
      destinationCoords,
      route: routeDetails.trim() || undefined,
      checkInDeadline: checkInDeadline.toISOString(),
      gracePeriod: parseInt(gracePeriod) || 30,
      crew,
      notes: notes.trim() || undefined,
      status: 'draft' as const,
      departureTanks: Object.keys(departureTanks).length > 0 ? departureTanks : undefined,
      // New fields
      expectedReturnTime: calculatedReturnTime,
      tripDurationHours: returnTimeMode === 'duration' ? tripDurationHours : undefined,
      primaryEmergencyContactId,
      secondaryEmergencyContactId,
      escalationWaitMinutes,
      departureTankLogId,
    }

    try {
      const online = await isOnline()

      if (existingPlan) {
        // Update existing plan
        updateFloatPlan(existingPlan.id, planData)

        if (online) {
          try {
            await floatPlansApi.update(existingPlan.id, planData)
          } catch {
            addSyncOperation({
              type: 'update',
              endpoint: `/float-plans/${existingPlan.id}`,
              method: 'PUT',
              body: planData,
            })
          }
        } else {
          addSyncOperation({
            type: 'update',
            endpoint: `/float-plans/${existingPlan.id}`,
            method: 'PUT',
            body: planData,
          })
        }

        // Schedule notifications
        const updatedPlan = { ...existingPlan, ...planData }
        await scheduleCheckInReminders(updatedPlan)

        Alert.alert('Success', 'Float plan updated')
      } else {
        // Create new plan
        const newPlan: FloatPlan = {
          ...planData,
          id: `${user?.id}_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        addFloatPlan(newPlan)

        if (online) {
          try {
            const serverPlan = await floatPlansApi.create(planData)
            // Update with server-generated ID if different
            if (serverPlan.id !== newPlan.id) {
              updateFloatPlan(newPlan.id, { id: serverPlan.id })
            }
          } catch {
            addSyncOperation({
              type: 'create',
              endpoint: '/float-plans',
              method: 'POST',
              body: planData,
            })
          }
        } else {
          addSyncOperation({
            type: 'create',
            endpoint: '/float-plans',
            method: 'POST',
            body: planData,
          })
        }

        // Schedule notifications
        await scheduleCheckInReminders(newPlan)

        Alert.alert('Success', 'Float plan created')
      }

      navigation.goBack()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save float plan')
    } finally {
      setLoading(false)
    }
  }

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios')
    if (selectedDate) {
      setCheckInDeadline(selectedDate)
    }
  }

  const onReturnTimeChange = (event: any, selectedDate?: Date) => {
    setShowReturnTimePicker(Platform.OS === 'ios')
    if (selectedDate) {
      setExpectedReturnTime(selectedDate)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Vessel Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ship size={20} color={colors.skyBlue} />
            <Text style={styles.sectionTitle}>Vessel Information</Text>
          </View>

          {/* Enhanced boat picker with photos */}
          {boats.length > 0 && (
            <TouchableOpacity 
              style={styles.boatSelector}
              onPress={() => setShowBoatPicker(true)}
            >
              {selectedBoat ? (
                <View style={styles.selectedBoatRow}>
                  {selectedBoat.photoUrl || selectedBoat.photoUri ? (
                    <Image 
                      source={{ uri: selectedBoat.photoUrl || selectedBoat.photoUri }}
                      style={styles.boatThumbnail}
                    />
                  ) : (
                    <View style={[styles.boatThumbnail, styles.boatThumbnailPlaceholder]}>
                      <Ship size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.selectedBoatInfo}>
                    <Text style={styles.selectedBoatName}>{selectedBoat.name}</Text>
                    <Text style={styles.selectedBoatDetails}>
                      {selectedBoat.type || 'Boat'} • {selectedBoat.length || 'Length N/A'}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={colors.textMuted} />
                </View>
              ) : (
                <View style={styles.boatSelectorEmpty}>
                  <Text style={styles.boatSelectorEmptyText}>Select a vessel from your boats</Text>
                  <ChevronDown size={20} color={colors.textMuted} />
                </View>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vessel Name *</Text>
            <TextInput
              style={styles.input}
              value={vesselName}
              onChangeText={setVesselName}
              placeholder="Enter vessel name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vessel Type</Text>
            <TextInput
              style={styles.input}
              value={vesselType}
              onChangeText={setVesselType}
              placeholder="e.g., Sailboat, Motorboat"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Route Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.skyBlue} />
            <Text style={styles.sectionTitle}>Route</Text>
          </View>

          <LocationPicker
            label="Departure Location *"
            value={departure}
            onChangeText={setDeparture}
            coordinates={departureCoords}
            onCoordinatesChange={setDepartureCoords}
            placeholder="Starting point"
          />

          <LocationPicker
            label="Destination *"
            value={destination}
            onChangeText={setDestination}
            coordinates={destinationCoords}
            onCoordinatesChange={setDestinationCoords}
            placeholder="Ending point"
          />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Route Details</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={routeDetails}
              onChangeText={setRouteDetails}
              placeholder="Describe your planned route"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Check-In Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={20} color={colors.skyBlue} />
            <Text style={styles.sectionTitle}>Check-In Schedule</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Check-In Deadline *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {checkInDeadline.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={checkInDeadline}
              mode="datetime"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Grace Period (minutes)</Text>
            <TextInput
              style={styles.input}
              value={gracePeriod}
              onChangeText={setGracePeriod}
              placeholder="30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>
              Time after deadline before contacts are notified
            </Text>
          </View>
        </View>

        {/* Expected Return Time */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Timer size={20} color={colors.skyBlue} />
            <Text style={styles.sectionTitle}>Expected Return</Text>
          </View>

          <View style={styles.returnModeToggle}>
            <TouchableOpacity
              style={[styles.returnModeButton, returnTimeMode === 'duration' && styles.returnModeButtonActive]}
              onPress={() => setReturnTimeMode('duration')}
            >
              <Text style={[styles.returnModeText, returnTimeMode === 'duration' && styles.returnModeTextActive]}>
                Duration
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.returnModeButton, returnTimeMode === 'specific' && styles.returnModeButtonActive]}
              onPress={() => setReturnTimeMode('specific')}
            >
              <Text style={[styles.returnModeText, returnTimeMode === 'specific' && styles.returnModeTextActive]}>
                Specific Time
              </Text>
            </TouchableOpacity>
          </View>

          {returnTimeMode === 'duration' ? (
            <View style={styles.durationPresets}>
              {DURATION_PRESETS.filter(p => p.value > 0).map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  style={[styles.durationChip, tripDurationHours === preset.value && styles.durationChipActive]}
                  onPress={() => setTripDurationHours(preset.value)}
                >
                  <Text style={[styles.durationChipText, tripDurationHours === preset.value && styles.durationChipTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowReturnTimePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {expectedReturnTime ? expectedReturnTime.toLocaleString() : 'Select return time'}
              </Text>
            </TouchableOpacity>
          )}

          {showReturnTimePicker && (
            <DateTimePicker
              value={expectedReturnTime || new Date(Date.now() + 4 * 60 * 60 * 1000)}
              mode="datetime"
              display="default"
              onChange={onReturnTimeChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Phone size={20} color={colors.skyBlue} />
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Primary Contact</Text>
            <TouchableOpacity
              style={styles.contactSelector}
              onPress={() => setShowEmergencyContactPicker('primary')}
            >
              {primaryContact ? (
                <View style={styles.selectedContactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{primaryContact.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.selectedContactInfo}>
                    <Text style={styles.selectedContactName}>{primaryContact.name}</Text>
                    <Text style={styles.selectedContactPhone}>{primaryContact.phone}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.contactSelectorPlaceholder}>Select primary emergency contact</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Secondary Contact</Text>
            <TouchableOpacity
              style={styles.contactSelector}
              onPress={() => setShowEmergencyContactPicker('secondary')}
            >
              {secondaryContact ? (
                <View style={styles.selectedContactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{secondaryContact.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.selectedContactInfo}>
                    <Text style={styles.selectedContactName}>{secondaryContact.name}</Text>
                    <Text style={styles.selectedContactPhone}>{secondaryContact.phone}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.contactSelectorPlaceholder}>Select secondary emergency contact</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Escalation Wait Time</Text>
            <Text style={styles.helperText}>
              Time to wait before contacting secondary if primary doesn't respond
            </Text>
            <View style={styles.escalationOptions}>
              {ESCALATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.escalationChip, escalationWaitMinutes === option.value && styles.escalationChipActive]}
                  onPress={() => setEscalationWaitMinutes(option.value)}
                >
                  <Text style={[styles.escalationChipText, escalationWaitMinutes === option.value && styles.escalationChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Crew */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color={colors.skyBlue} />
            <Text style={styles.sectionTitle}>Crew ({crew.length} aboard)</Text>
          </View>

          <View style={styles.crewActions}>
            <TouchableOpacity 
              style={styles.crewActionButton}
              onPress={() => {
                resetCrewForm()
                setShowCrewModal(true)
              }}
            >
              <Plus size={18} color={colors.skyBlue} />
              <Text style={styles.crewActionText}>Add Manually</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.crewActionButton}
              onPress={() => setShowContactPicker(true)}
            >
              <UserPlus size={18} color={colors.skyBlue} />
              <Text style={styles.crewActionText}>From Contacts</Text>
            </TouchableOpacity>
          </View>

          {crew.map((member) => (
            <TouchableOpacity 
              key={member.id} 
              style={styles.crewMember}
              onPress={() => editCrewMemberModal(member)}
            >
              <View style={styles.crewMemberInfo}>
                <Text style={styles.crewMemberName}>{member.name}</Text>
                <View style={styles.crewMemberDetails}>
                  {member.age && (
                    <Text style={styles.crewMemberDetail}>Age {member.age}</Text>
                  )}
                  {member.medicalNotes && (
                    <View style={styles.medicalBadge}>
                      <Heart size={12} color={colors.error} />
                      <Text style={styles.medicalBadgeText}>Medical info</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => removeCrewMember(member.id)}>
                <X size={18} color={colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {crew.length === 0 && (
            <Text style={styles.emptyCrewText}>No crew members added yet</Text>
          )}
        </View>

        {/* Departure Tank Levels */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Fuel size={20} color={colors.skyBlue} />
            <Text style={styles.sectionTitle}>Departure Tank Levels</Text>
          </View>
          
          {tankLogIsStale && selectedBoatId && (
            <View style={styles.staleWarning}>
              <AlertCircle size={16} color={colors.warning} />
              <Text style={styles.staleWarningText}>
                Tank levels haven't been logged in over {TANK_LOG_STALE_HOURS} hours
              </Text>
            </View>
          )}
          
          {latestTankLog && !tankLogIsStale && (
            <View style={styles.lastLogInfo}>
              <Text style={styles.lastLogText}>
                Last logged: {new Date(latestTankLog.timestamp).toLocaleString()}
              </Text>
            </View>
          )}
          
          <Text style={styles.helperText}>
            Log your tank levels before departure for Coast Guard reporting
          </Text>
          
          <TankLevelInput
            type="fuel"
            value={departureTanks.fuel}
            onValueChange={(value) => setDepartureTanks(prev => ({ ...prev, fuel: value }))}
          />
          
          {selectedBoat?.fuelCapacityGallons && departureTanks.fuel !== undefined && (
            <Text style={styles.gallonsText}>
              ~{Math.round((departureTanks.fuel / 100) * selectedBoat.fuelCapacityGallons)} gallons of {selectedBoat.fuelCapacityGallons} gal capacity
            </Text>
          )}
          
          <TankLevelInput
            type="water"
            value={departureTanks.water}
            onValueChange={(value) => setDepartureTanks(prev => ({ ...prev, water: value }))}
          />
          
          {selectedBoat?.waterCapacityGallons && departureTanks.water !== undefined && (
            <Text style={styles.gallonsText}>
              ~{Math.round((departureTanks.water / 100) * selectedBoat.waterCapacityGallons)} gallons of {selectedBoat.waterCapacityGallons} gal capacity
            </Text>
          )}
          
          <TankLevelInput
            type="blackwater"
            value={departureTanks.blackwater}
            onValueChange={(value) => setDepartureTanks(prev => ({ ...prev, blackwater: value }))}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional information..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Save size={20} color={colors.textInverse} />
              <Text style={styles.saveButtonText}>
                {existingPlan ? 'Update Float Plan' : 'Save Float Plan'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Boat Picker Modal */}
      <Modal visible={showBoatPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBoatPicker(false)}>
              <X size={24} color={colors.error} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Vessel</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={boats}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.boatListItem, selectedBoatId === item.id && styles.boatListItemActive]}
                onPress={() => selectBoat(item.id)}
              >
                {item.photoUrl || item.photoUri ? (
                  <Image source={{ uri: item.photoUrl || item.photoUri }} style={styles.boatListImage} />
                ) : (
                  <View style={[styles.boatListImage, styles.boatListImagePlaceholder]}>
                    <Ship size={32} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.boatListInfo}>
                  <Text style={styles.boatListName}>{item.name}</Text>
                  <Text style={styles.boatListDetails}>
                    {item.type || 'Boat'} • {item.length || 'N/A'}
                  </Text>
                  {item.homePort && (
                    <Text style={styles.boatListHomePort}>Home: {item.homePort}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Crew Member Modal */}
      <Modal visible={showCrewModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { resetCrewForm(); setShowCrewModal(false) }}>
              <X size={24} color={colors.error} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCrewMember ? 'Edit Crew Member' : 'Add Crew Member'}
            </Text>
            <TouchableOpacity onPress={editingCrewMember ? updateCrewMember : addCrewMember}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={crewName}
                onChangeText={setCrewName}
                placeholder="Full name"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={crewAge}
                onChangeText={setCrewAge}
                placeholder="Age (for SAR reporting)"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Medical Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={crewMedicalNotes}
                onChangeText={setCrewMedicalNotes}
                placeholder="Allergies, conditions, medications..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
              />
              <Text style={styles.helperText}>
                This information may be shared with Coast Guard in emergencies
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contact Picker Modal */}
      <Modal visible={showContactPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowContactPicker(false)}>
              <X size={24} color={colors.error} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add from Contacts</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            ListEmptyComponent={
              <Text style={styles.emptyListText}>No contacts saved. Add contacts first.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.contactListItem}
                onPress={() => addCrewFromContact(item)}
              >
                <View style={styles.contactListAvatar}>
                  <Text style={styles.contactListAvatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.contactListInfo}>
                  <Text style={styles.contactListName}>{item.name}</Text>
                  <Text style={styles.contactListPhone}>{item.phone}</Text>
                </View>
                <Plus size={20} color={colors.skyBlue} />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Emergency Contact Picker Modal */}
      <Modal visible={showEmergencyContactPicker !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEmergencyContactPicker(null)}>
              <X size={24} color={colors.error} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Select {showEmergencyContactPicker === 'primary' ? 'Primary' : 'Secondary'} Contact
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={emergencyContacts.length > 0 ? emergencyContacts : contacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            ListHeaderComponent={
              emergencyContacts.length === 0 && contacts.length > 0 ? (
                <Text style={styles.listHeaderText}>
                  No emergency contacts set. Showing all contacts:
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <Text style={styles.emptyListText}>No contacts saved. Add contacts first.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.contactListItem}
                onPress={() => selectEmergencyContact(item)}
              >
                <View style={styles.contactListAvatar}>
                  <Text style={styles.contactListAvatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.contactListInfo}>
                  <Text style={styles.contactListName}>{item.name}</Text>
                  <Text style={styles.contactListPhone}>{item.phone}</Text>
                  {item.relationship && (
                    <Text style={styles.contactListRelation}>{item.relationship}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Tank Log Stale Prompt */}
      <Modal visible={showTankLogPrompt} animationType="fade" transparent>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <AlertCircle size={40} color={colors.warning} />
            <Text style={styles.alertTitle}>Tank Levels May Be Outdated</Text>
            <Text style={styles.alertMessage}>
              Your tank levels haven't been logged in over {TANK_LOG_STALE_HOURS} hours. 
              Would you like to log current levels for this trip?
            </Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity style={styles.alertButtonSecondary} onPress={handleSkipTankLog}>
                <Text style={styles.alertButtonSecondaryText}>Use Last Logged</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertButtonPrimary} onPress={handleLogTanksNow}>
                <Text style={styles.alertButtonPrimaryText}>Log Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  
  // Boat selector
  boatSelector: {
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  selectedBoatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boatThumbnail: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  boatThumbnailPlaceholder: {
    backgroundColor: colors.slate200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBoatInfo: {
    flex: 1,
  },
  selectedBoatName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  selectedBoatDetails: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  boatSelectorEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boatSelectorEmptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },

  // Date button
  dateButton: {
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  dateButtonText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  // Return time mode toggle
  returnModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  returnModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  returnModeButtonActive: {
    backgroundColor: colors.skyBlue,
  },
  returnModeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  returnModeTextActive: {
    color: colors.textInverse,
  },

  // Duration presets
  durationPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  durationChip: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  durationChipActive: {
    backgroundColor: colors.skyBlue,
  },
  durationChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  durationChipTextActive: {
    color: colors.textInverse,
  },

  // Emergency contact selector
  contactSelector: {
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  contactSelectorPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  selectedContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  contactAvatarText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  selectedContactInfo: {
    flex: 1,
  },
  selectedContactName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  selectedContactPhone: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Escalation options
  escalationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  escalationChip: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  escalationChipActive: {
    backgroundColor: colors.skyBlue,
  },
  escalationChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  escalationChipTextActive: {
    color: colors.textInverse,
  },

  // Crew actions
  crewActions: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  crewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  crewActionText: {
    fontSize: fontSize.sm,
    color: colors.skyBlue,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },

  // Crew member
  crewMember: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.slate100,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  crewMemberInfo: {
    flex: 1,
  },
  crewMemberName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  crewMemberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  crewMemberDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.md,
  },
  medicalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  medicalBadgeText: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginLeft: 4,
  },
  emptyCrewText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // Tank log
  staleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  staleWarningText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    marginLeft: spacing.sm,
    flex: 1,
  },
  lastLogInfo: {
    marginBottom: spacing.sm,
  },
  lastLogText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  gallonsText: {
    fontSize: fontSize.xs,
    color: colors.skyBlue,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },

  // Save button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.skyBlue,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    ...shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.sm,
  },

  // Modal styles
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
  modalSaveText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.skyBlue,
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalList: {
    padding: spacing.lg,
  },

  // Boat list item
  boatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  boatListItemActive: {
    borderColor: colors.skyBlue,
    backgroundColor: colors.skyBlue + '10',
  },
  boatListImage: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  boatListImagePlaceholder: {
    backgroundColor: colors.slate200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boatListInfo: {
    flex: 1,
  },
  boatListName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  boatListDetails: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  boatListHomePort: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Contact list item
  contactListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  contactListAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  contactListAvatarText: {
    color: colors.textInverse,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  contactListInfo: {
    flex: 1,
  },
  contactListName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  contactListPhone: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactListRelation: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyListText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  listHeaderText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  // Alert overlay
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  alertBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...shadows.lg,
  },
  alertTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  alertButtons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
  alertButtonSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.slate300,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  alertButtonSecondaryText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  alertButtonPrimary: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.skyBlue,
    marginLeft: spacing.sm,
    alignItems: 'center',
  },
  alertButtonPrimaryText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textInverse,
  },
})
