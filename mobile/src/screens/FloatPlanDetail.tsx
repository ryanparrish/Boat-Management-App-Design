import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Share,
  Image,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import {
  Ship,
  MapPin,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  ArrowLeft,
  Fuel,
  FileText,
  Share2,
  Copy,
  Phone,
  Heart,
  Radio,
  Timer,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import { floatPlansApi } from '../services/supabase'
import { isOnline } from '../services/sync'
import { cancelCheckInReminders } from '../services/notifications'
import { RouteMap, TankLevelInput, TankLevelDisplay } from '../components'
import { generateCoastGuardReport } from '../utils/coastGuardReport'
import type { RootStackParamList, TankReading, CrewMember, BoatDevice } from '../types'
type NavigationProp = StackNavigationProp<RootStackParamList>
type RouteType = RouteProp<RootStackParamList, 'FloatPlanDetail'>

export function FloatPlanDetail() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteType>()
  const { id: planId } = route.params
  
  const [loading, setLoading] = useState(false)
  const [showReturnTankModal, setShowReturnTankModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [returnTanks, setReturnTanks] = useState<TankReading>({})
  
  const { 
    floatPlans, 
    boats,
    contacts,
    boatDevices,
    tankLogs,
    updateFloatPlan, 
    deleteFloatPlan, 
    addSyncOperation,
    getLatestTankLog,
  } = useAppStore((s) => ({
    floatPlans: s.floatPlans,
    boats: s.boats,
    contacts: s.contacts,
    boatDevices: s.boatDevices,
    tankLogs: s.tankLogs,
    updateFloatPlan: s.updateFloatPlan,
    deleteFloatPlan: s.deleteFloatPlan,
    addSyncOperation: s.addSyncOperation,
    getLatestTankLog: s.getLatestTankLog,
  }))

  const plan = floatPlans[planId]
  
  // Get related data
  const boat = plan?.boatId ? boats.find(b => b.id === plan.boatId) : null
  const devices = plan?.boatId ? boatDevices.filter(d => d.boatId === plan.boatId) : []
  const primaryContact = plan?.primaryEmergencyContactId ? contacts.find(c => c.id === plan.primaryEmergencyContactId) : null
  const secondaryContact = plan?.secondaryEmergencyContactId ? contacts.find(c => c.id === plan.secondaryEmergencyContactId) : null
  const tankLog = plan?.departureTankLogId 
    ? tankLogs.find(t => t.id === plan.departureTankLogId) 
    : plan?.boatId 
      ? getLatestTankLog(plan.boatId) 
      : null

  if (!plan) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Float plan not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const deadline = new Date(plan.checkInDeadline)
  const isOverdue = deadline < new Date() && plan.status === 'active'
  const isActive = plan.status === 'active'

  const handleCheckIn = async () => {
    // If there are departure tanks logged, show modal to enter return tanks
    if (plan.departureTanks && Object.keys(plan.departureTanks).length > 0 && !showReturnTankModal) {
      setShowReturnTankModal(true)
      return
    }
    
    setLoading(true)
    const timestamp = new Date().toISOString()

    const updateData: any = {
      status: 'checked_in',
      lastCheckIn: timestamp,
    }
    
    // Include return tank data if entered
    if (Object.keys(returnTanks).length > 0) {
      updateData.returnTanks = returnTanks
    }

    // Update locally immediately
    updateFloatPlan(planId, updateData)

    // Cancel scheduled notifications
    await cancelCheckInReminders(planId)

    // Try to sync
    const online = await isOnline()
    if (online) {
      try {
        await floatPlansApi.checkIn(planId)
      } catch (error) {
        // Queue for later sync
        addSyncOperation({
          type: 'check_in',
          endpoint: `/float-plans/${planId}/check-in`,
          method: 'POST',
          body: updateData,
        })
      }
    } else {
      // Queue for later sync
      addSyncOperation({
        type: 'check_in',
        endpoint: `/float-plans/${planId}/check-in`,
        method: 'POST',
        body: updateData,
      })
    }

    setLoading(false)
    setShowReturnTankModal(false)
    setReturnTanks({})
    Alert.alert('Checked In', 'Your check-in has been recorded.')
  }

  const handleActivate = async () => {
    setLoading(true)
    
    updateFloatPlan(planId, { status: 'active' })

    const online = await isOnline()
    if (online) {
      try {
        await floatPlansApi.update(planId, { status: 'active' })
      } catch (error) {
        addSyncOperation({
          type: 'update',
          endpoint: `/float-plans/${planId}`,
          method: 'PUT',
          body: { status: 'active' },
        })
      }
    } else {
      addSyncOperation({
        type: 'update',
        endpoint: `/float-plans/${planId}`,
        method: 'PUT',
        body: { status: 'active' },
      })
    }

    setLoading(false)
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Float Plan',
      'Are you sure you want to delete this float plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await cancelCheckInReminders(planId)
            deleteFloatPlan(planId)
            
            addSyncOperation({
              type: 'delete',
              endpoint: `/float-plans/${planId}`,
              method: 'DELETE',
            })
            
            navigation.goBack()
          },
        },
      ]
    )
  }

  // Generate Coast Guard report
  const coastGuardReport = useMemo(() => {
    if (!plan) return ''
    return generateCoastGuardReport({
      plan,
      boat: boat || null,
      devices,
      contacts,
      tankLog: tankLog || null,
    })
  }, [plan, boat, devices, contacts, tankLog])

  const handleShareReport = async () => {
    try {
      await Share.share({
        message: coastGuardReport,
        title: `Overdue Vessel Report - ${plan.vesselName}`,
      })
    } catch (error) {
      Alert.alert('Error', 'Failed to share report')
    }
  }

  const handleCopyReport = async () => {
    await Clipboard.setStringAsync(coastGuardReport)
    Alert.alert('Copied', 'Report copied to clipboard')
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Status Banner */}
        {isOverdue && (
          <View style={styles.overdueBanner}>
            <AlertTriangle size={20} color={colors.textInverse} />
            <Text style={styles.overdueBannerText}>
              Check-in is overdue! Please check in now.
            </Text>
          </View>
        )}

        {/* Vessel Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ship size={24} color={colors.skyBlue} />
            <Text style={styles.cardTitle}>Vessel Information</Text>
          </View>
          <View style={styles.cardContent}>
            {/* Vessel Photo */}
            {(boat?.photoUrl || boat?.photoUri) && (
              <Image 
                source={{ uri: boat.photoUrl || boat.photoUri }} 
                style={styles.vesselPhoto}
              />
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{plan.vesselName}</Text>
            </View>
            {plan.vesselType && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>{plan.vesselType}</Text>
              </View>
            )}
            {boat?.length && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Length</Text>
                <Text style={styles.infoValue}>{boat.length}</Text>
              </View>
            )}
            {boat?.color && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Color</Text>
                <Text style={styles.infoValue}>{boat.color}</Text>
              </View>
            )}
            {boat?.registration && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Registration</Text>
                <Text style={styles.infoValue}>{boat.registration}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Communication Devices */}
        {devices.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Radio size={24} color={colors.skyBlue} />
              <Text style={styles.cardTitle}>Communication Equipment</Text>
            </View>
            <View style={styles.cardContent}>
              {devices.map((device) => (
                <View key={device.id} style={styles.deviceRow}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  {device.deviceId && (
                    <Text style={styles.deviceId}>
                      {device.type === 'dsc_radio' || device.type === 'ais' ? 'MMSI: ' : 
                       device.type === 'epirb' || device.type === 'plb' ? 'HEX: ' : 'ID: '}
                      {device.deviceId}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Route Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={24} color={colors.skyBlue} />
            <Text style={styles.cardTitle}>Route</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>From</Text>
              <Text style={styles.infoValue}>{plan.departure}</Text>
            </View>
            {plan.departureCoords && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Coordinates</Text>
                <Text style={styles.infoValue}>
                  {plan.departureCoords.latitude.toFixed(6)}, {plan.departureCoords.longitude.toFixed(6)}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>To</Text>
              <Text style={styles.infoValue}>{plan.destination}</Text>
            </View>
            {plan.destinationCoords && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Coordinates</Text>
                <Text style={styles.infoValue}>
                  {plan.destinationCoords.latitude.toFixed(6)}, {plan.destinationCoords.longitude.toFixed(6)}
                </Text>
              </View>
            )}
            {plan.route && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Route Details</Text>
                <Text style={styles.infoValue}>{plan.route}</Text>
              </View>
            )}
          </View>
          
          {/* Route Map */}
          {(plan.departureCoords || plan.destinationCoords) && (
            <RouteMap
              departureCoords={plan.departureCoords}
              destinationCoords={plan.destinationCoords}
              departureName={plan.departure}
              destinationName={plan.destination}
            />
          )}
        </View>

        {/* Check-In Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={24} color={colors.skyBlue} />
            <Text style={styles.cardTitle}>Check-In Schedule</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Deadline</Text>
              <Text style={[styles.infoValue, isOverdue && styles.infoValueOverdue]}>
                {deadline.toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grace Period</Text>
              <Text style={styles.infoValue}>{plan.gracePeriod} minutes</Text>
            </View>
            {plan.lastCheckIn && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Check-In</Text>
                <Text style={styles.infoValue}>
                  {new Date(plan.lastCheckIn).toLocaleString()}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[
                styles.statusBadge,
                isOverdue ? styles.statusOverdue : 
                isActive ? styles.statusActive : styles.statusDraft
              ]}>
                <Text style={[
                  styles.statusText,
                  isOverdue ? styles.statusTextOverdue :
                  isActive ? styles.statusTextActive : styles.statusTextDraft
                ]}>
                  {isOverdue ? 'Overdue' : plan.status.charAt(0).toUpperCase() + plan.status.slice(1).replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Crew */}
        {plan.crew && plan.crew.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Users size={24} color={colors.skyBlue} />
              <Text style={styles.cardTitle}>Crew ({plan.crew.length})</Text>
            </View>
            <View style={styles.cardContent}>
              {(plan.crew as CrewMember[]).map((member, index) => (
                <View key={member.id || index} style={styles.crewMemberCard}>
                  <View style={styles.crewMemberHeader}>
                    <Text style={styles.crewName}>
                      {typeof member === 'string' ? member : member.name}
                    </Text>
                    {typeof member !== 'string' && member.age && (
                      <Text style={styles.crewAge}>Age {member.age}</Text>
                    )}
                  </View>
                  {typeof member !== 'string' && member.medicalNotes && (
                    <View style={styles.medicalInfo}>
                      <Heart size={14} color={colors.error} />
                      <Text style={styles.medicalText}>{member.medicalNotes}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Emergency Contacts */}
        {(primaryContact || secondaryContact) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Phone size={24} color={colors.skyBlue} />
              <Text style={styles.cardTitle}>Emergency Contacts</Text>
            </View>
            <View style={styles.cardContent}>
              {primaryContact && (
                <View style={styles.emergencyContactRow}>
                  <View style={styles.emergencyContactLabel}>
                    <Text style={styles.emergencyLabel}>PRIMARY</Text>
                  </View>
                  <View style={styles.emergencyContactInfo}>
                    <Text style={styles.emergencyContactName}>{primaryContact.name}</Text>
                    <Text style={styles.emergencyContactPhone}>{primaryContact.phone}</Text>
                  </View>
                </View>
              )}
              {secondaryContact && (
                <View style={styles.emergencyContactRow}>
                  <View style={[styles.emergencyContactLabel, styles.secondaryLabel]}>
                    <Text style={[styles.emergencyLabel, styles.secondaryLabelText]}>SECONDARY</Text>
                  </View>
                  <View style={styles.emergencyContactInfo}>
                    <Text style={styles.emergencyContactName}>{secondaryContact.name}</Text>
                    <Text style={styles.emergencyContactPhone}>{secondaryContact.phone}</Text>
                  </View>
                </View>
              )}
              {plan.escalationWaitMinutes && (
                <Text style={styles.escalationNote}>
                  Contact secondary after {plan.escalationWaitMinutes} min if primary unreachable
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Expected Return */}
        {(plan.expectedReturnTime || plan.tripDurationHours) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Timer size={24} color={colors.skyBlue} />
              <Text style={styles.cardTitle}>Expected Return</Text>
            </View>
            <View style={styles.cardContent}>
              {plan.expectedReturnTime && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Return Time</Text>
                  <Text style={styles.infoValue}>
                    {new Date(plan.expectedReturnTime).toLocaleString()}
                  </Text>
                </View>
              )}
              {plan.tripDurationHours && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Trip Duration</Text>
                  <Text style={styles.infoValue}>{plan.tripDurationHours} hours</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Tank Levels */}
        {(plan.departureTanks || plan.returnTanks) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Fuel size={24} color={colors.skyBlue} />
              <Text style={styles.cardTitle}>Tank Levels</Text>
            </View>
            <View style={styles.cardContent}>
              {plan.departureTanks && (
                <>
                  <Text style={styles.tankSectionLabel}>Departure</Text>
                  {plan.departureTanks.fuel !== undefined && (
                    <TankLevelDisplay type="fuel" value={plan.departureTanks.fuel} />
                  )}
                  {plan.departureTanks.water !== undefined && (
                    <TankLevelDisplay type="water" value={plan.departureTanks.water} />
                  )}
                  {plan.departureTanks.blackwater !== undefined && (
                    <TankLevelDisplay type="blackwater" value={plan.departureTanks.blackwater} />
                  )}
                </>
              )}
              
              {plan.returnTanks && (
                <>
                  <Text style={[styles.tankSectionLabel, { marginTop: spacing.lg }]}>Return</Text>
                  {plan.returnTanks.fuel !== undefined && (
                    <TankLevelDisplay type="fuel" value={plan.returnTanks.fuel} />
                  )}
                  {plan.returnTanks.water !== undefined && (
                    <TankLevelDisplay type="water" value={plan.returnTanks.water} />
                  )}
                  {plan.returnTanks.blackwater !== undefined && (
                    <TankLevelDisplay type="blackwater" value={plan.returnTanks.blackwater} />
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {plan.notes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Notes</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.notesText}>{plan.notes}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {plan.status === 'draft' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.activateButton]}
              onPress={handleActivate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <CheckCircle size={20} color={colors.textInverse} />
                  <Text style={styles.actionButtonText}>Activate Plan</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isActive && (
            <TouchableOpacity
              style={[styles.actionButton, styles.checkInButton]}
              onPress={handleCheckIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <CheckCircle size={20} color={colors.textInverse} />
                  <Text style={styles.actionButtonText}>Check In Now</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Coast Guard Report Button - show when overdue or active */}
          {(isOverdue || isActive) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.reportButton]}
              onPress={() => setShowReportModal(true)}
            >
              <FileText size={20} color={colors.textInverse} />
              <Text style={styles.actionButtonText}>
                {isOverdue ? 'Generate SAR Report' : 'Preview SAR Report'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.secondaryButton]}
              onPress={() => navigation.navigate('CreateFloatPlan', { editPlan: plan })}
            >
              <Edit size={18} color={colors.skyBlue} />
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Trash2 size={18} color={colors.error} />
              <Text style={[styles.secondaryButtonText, styles.deleteButtonText]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Coast Guard Report Modal */}
      <Modal visible={showReportModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.reportModalContainer}>
          <View style={styles.reportModalHeader}>
            <TouchableOpacity onPress={() => setShowReportModal(false)}>
              <Text style={styles.reportCloseText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.reportModalTitle}>Coast Guard Report</Text>
            <View style={{ width: 50 }} />
          </View>
          
          <ScrollView style={styles.reportScroll} contentContainerStyle={styles.reportContent}>
            <Text style={styles.reportText}>{coastGuardReport}</Text>
          </ScrollView>
          
          <View style={styles.reportActions}>
            <TouchableOpacity style={styles.reportActionButton} onPress={handleCopyReport}>
              <Copy size={20} color={colors.skyBlue} />
              <Text style={styles.reportActionText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportActionButton} onPress={handleShareReport}>
              <Share2 size={20} color={colors.skyBlue} />
              <Text style={styles.reportActionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Return Tank Levels Modal */}
      <Modal visible={showReturnTankModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Return Tank Levels</Text>
              <Text style={styles.modalSubtitle}>Log your tank levels upon return (optional)</Text>
            </View>

            <ScrollView style={styles.modalScroll}>
              <TankLevelInput
                type="fuel"
                value={returnTanks.fuel}
                onValueChange={(value) => setReturnTanks(prev => ({ ...prev, fuel: value }))}
              />
              
              <TankLevelInput
                type="water"
                value={returnTanks.water}
                onValueChange={(value) => setReturnTanks(prev => ({ ...prev, water: value }))}
              />
              
              <TankLevelInput
                type="blackwater"
                value={returnTanks.blackwater}
                onValueChange={(value) => setReturnTanks(prev => ({ ...prev, blackwater: value }))}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSkipButton}
                onPress={() => {
                  setReturnTanks({})
                  handleCheckIn()
                }}
              >
                <Text style={styles.modalSkipText}>Skip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleCheckIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalConfirmText}>Check In</Text>
                )}
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
  overdueBanner: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  overdueBannerText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.md,
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  cardContent: {
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },
  infoValueOverdue: {
    color: colors.error,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusActive: {
    backgroundColor: colors.successLight,
  },
  statusOverdue: {
    backgroundColor: colors.errorLight,
  },
  statusDraft: {
    backgroundColor: colors.slate200,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  statusTextActive: {
    color: colors.success,
  },
  statusTextOverdue: {
    color: colors.error,
  },
  statusTextDraft: {
    color: colors.textSecondary,
  },
  crewMember: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  crewMemberCard: {
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  crewMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  crewName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  crewAge: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  medicalInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  medicalText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginLeft: spacing.sm,
    flex: 1,
  },
  
  // Vessel photo
  vesselPhoto: {
    width: '100%',
    height: 150,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  
  // Device row
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  deviceName: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  deviceId: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  
  // Emergency contacts
  emergencyContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emergencyContactLabel: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  secondaryLabel: {
    backgroundColor: colors.warning,
  },
  emergencyLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  secondaryLabelText: {
    color: colors.textPrimary,
  },
  emergencyContactInfo: {
    flex: 1,
  },
  emergencyContactName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  emergencyContactPhone: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  escalationNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  
  // Report button
  reportButton: {
    backgroundColor: colors.warning,
  },
  
  // Report modal
  reportModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  reportModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  reportCloseText: {
    fontSize: fontSize.md,
    color: colors.skyBlue,
  },
  reportScroll: {
    flex: 1,
  },
  reportContent: {
    padding: spacing.lg,
  },
  reportText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  reportActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  reportActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
  },
  reportActionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.skyBlue,
    marginLeft: spacing.sm,
  },
  
  notesText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  actions: {
    marginTop: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  checkInButton: {
    backgroundColor: colors.success,
  },
  activateButton: {
    backgroundColor: colors.skyBlue,
  },
  actionButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  secondaryButtonText: {
    color: colors.skyBlue,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.sm,
  },
  deleteButton: {
    borderColor: colors.errorLight,
  },
  deleteButtonText: {
    color: colors.error,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.skyBlue,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: colors.textInverse,
    fontWeight: fontWeight.medium,
  },
  tankSectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalScroll: {
    maxHeight: 350,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalSkipButton: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.slate300,
    alignItems: 'center',
  },
  modalSkipText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: colors.success,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
})
