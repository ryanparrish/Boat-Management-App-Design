import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
  Ship,
  Plus,
  Edit,
  Trash2,
  X,
  Anchor,
  Radio,
  FileText,
  Camera,
  Image as ImageIcon,
  Fuel,
  Droplets,
  History,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import { boatsApi } from '../services/supabase'
import { isOnline } from '../services/sync'
import { pickVesselPhoto, takeVesselPhoto, uploadVesselPhoto, deleteVesselPhoto } from '../services/storage'
import type { Boat, RootStackParamList, TankLogEntry } from '../types'

type NavigationProp = StackNavigationProp<RootStackParamList>

export function BoatsManager() {
  const navigation = useNavigation<NavigationProp>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingBoat, setEditingBoat] = useState<Boat | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showPhotoOptions, setShowPhotoOptions] = useState(false)
  const [showTankHistory, setShowTankHistory] = useState<Boat | null>(null)
  const [showLogTanksModal, setShowLogTanksModal] = useState<Boat | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [length, setLength] = useState('')
  const [registration, setRegistration] = useState('')
  const [homePort, setHomePort] = useState('')
  const [color, setColor] = useState('')
  const [notes, setNotes] = useState('')
  const [fuelCapacityGallons, setFuelCapacityGallons] = useState('')
  const [waterCapacityGallons, setWaterCapacityGallons] = useState('')
  const [photoUri, setPhotoUri] = useState<string | undefined>()
  const [photoUrl, setPhotoUrl] = useState<string | undefined>()

  // Tank log form
  const [tankFuel, setTankFuel] = useState('')
  const [tankWater, setTankWater] = useState('')
  const [tankBlackwater, setTankBlackwater] = useState('')
  const [tankNotes, setTankNotes] = useState('')

  const { 
    boats, 
    addBoat, 
    updateBoat, 
    deleteBoat, 
    addSyncOperation, 
    user,
    tankLogs,
    getTankLogsForBoat,
    addTankLog,
    updateBoatPhoto,
  } = useAppStore((s) => ({
    boats: s.boats,
    addBoat: s.addBoat,
    updateBoat: s.updateBoat,
    deleteBoat: s.deleteBoat,
    addSyncOperation: s.addSyncOperation,
    user: s.user,
    tankLogs: s.tankLogs,
    getTankLogsForBoat: s.getTankLogsForBoat,
    addTankLog: s.addTankLog,
    updateBoatPhoto: s.updateBoatPhoto,
  }))

  const resetForm = () => {
    setName('')
    setType('')
    setLength('')
    setRegistration('')
    setHomePort('')
    setColor('')
    setNotes('')
    setFuelCapacityGallons('')
    setWaterCapacityGallons('')
    setPhotoUri(undefined)
    setPhotoUrl(undefined)
    setEditingBoat(null)
  }

  const resetTankForm = () => {
    setTankFuel('')
    setTankWater('')
    setTankBlackwater('')
    setTankNotes('')
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const openEditModal = (boat: Boat) => {
    setEditingBoat(boat)
    setName(boat.name)
    setType(boat.type || '')
    setLength(boat.length || '')
    setRegistration(boat.registration || '')
    setHomePort(boat.homePort || '')
    setColor(boat.color || '')
    setNotes(boat.notes || '')
    setFuelCapacityGallons(boat.fuelCapacityGallons?.toString() || '')
    setWaterCapacityGallons(boat.waterCapacityGallons?.toString() || '')
    setPhotoUri(boat.photoUri)
    setPhotoUrl(boat.photoUrl)
    setModalVisible(true)
  }

  const handlePickPhoto = async () => {
    setShowPhotoOptions(false)
    try {
      const uri = await pickVesselPhoto()
      if (uri) {
        setPhotoUri(uri)
        // Upload to Supabase if editing existing boat
        if (editingBoat) {
          setUploadingPhoto(true)
          const url = await uploadVesselPhoto(uri, editingBoat.id)
          if (url) {
            setPhotoUrl(url)
            updateBoatPhoto(editingBoat.id, uri, url)
          }
          setUploadingPhoto(false)
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick photo')
    }
  }

  const handleTakePhoto = async () => {
    setShowPhotoOptions(false)
    try {
      const uri = await takeVesselPhoto()
      if (uri) {
        setPhotoUri(uri)
        // Upload to Supabase if editing existing boat
        if (editingBoat) {
          setUploadingPhoto(true)
          const url = await uploadVesselPhoto(uri, editingBoat.id)
          if (url) {
            setPhotoUrl(url)
            updateBoatPhoto(editingBoat.id, uri, url)
          }
          setUploadingPhoto(false)
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo')
    }
  }

  const handleLogTanks = () => {
    if (!showLogTanksModal) return
    
    const logEntry: TankLogEntry = {
      id: `tanklog_${Date.now()}`,
      boatId: showLogTanksModal.id,
      timestamp: new Date().toISOString(),
      fuel: tankFuel ? parseInt(tankFuel) : undefined,
      water: tankWater ? parseInt(tankWater) : undefined,
      blackwater: tankBlackwater ? parseInt(tankBlackwater) : undefined,
      notes: tankNotes.trim() || undefined,
    }
    
    addTankLog(logEntry)
    resetTankForm()
    setShowLogTanksModal(null)
    Alert.alert('Success', 'Tank levels logged')
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a boat name')
      return
    }

    setLoading(true)

    const boatData = {
      name: name.trim(),
      type: type.trim() || undefined,
      length: length.trim() || undefined,
      registration: registration.trim() || undefined,
      homePort: homePort.trim() || undefined,
      color: color.trim() || undefined,
      notes: notes.trim() || undefined,
      fuelCapacityGallons: fuelCapacityGallons ? parseInt(fuelCapacityGallons) : undefined,
      waterCapacityGallons: waterCapacityGallons ? parseInt(waterCapacityGallons) : undefined,
      photoUri,
      photoUrl,
    }

    try {
      const online = await isOnline()

      if (editingBoat) {
        updateBoat(editingBoat.id, boatData)

        if (online) {
          try {
            await boatsApi.update(editingBoat.id, boatData)
          } catch {
            addSyncOperation({
              type: 'update',
              endpoint: `/boats/${editingBoat.id}`,
              method: 'PUT',
              body: boatData,
            })
          }
        } else {
          addSyncOperation({
            type: 'update',
            endpoint: `/boats/${editingBoat.id}`,
            method: 'PUT',
            body: boatData,
          })
        }
      } else {
        const newBoat: Boat = {
          ...boatData,
          id: `${user?.id}_boat_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        addBoat(newBoat)

        if (online) {
          try {
            await boatsApi.create(boatData)
          } catch {
            addSyncOperation({
              type: 'create',
              endpoint: '/boats',
              method: 'POST',
              body: boatData,
            })
          }
        } else {
          addSyncOperation({
            type: 'create',
            endpoint: '/boats',
            method: 'POST',
            body: boatData,
          })
        }
      }

      setModalVisible(false)
      resetForm()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save boat')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (boat: Boat) => {
    Alert.alert('Delete Boat', `Are you sure you want to delete ${boat.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deleteBoat(boat.id)
          addSyncOperation({
            type: 'delete',
            endpoint: `/boats/${boat.id}`,
            method: 'DELETE',
          })
        },
      },
    ])
  }

  const renderItem = ({ item: boat }: { item: Boat }) => (
    <View style={styles.boatCard}>
      <View style={styles.boatHeader}>
        {boat.photoUrl || boat.photoUri ? (
          <Image 
            source={{ uri: boat.photoUrl || boat.photoUri }} 
            style={styles.boatImage} 
          />
        ) : (
          <View style={styles.boatIcon}>
            <Anchor size={24} color={colors.skyBlue} />
          </View>
        )}
        <View style={styles.boatContent}>
          <Text style={styles.boatName}>{boat.name}</Text>
          {boat.type && <Text style={styles.boatDetail}>{boat.type}</Text>}
          {boat.homePort && (
            <Text style={styles.boatDetail}>Home: {boat.homePort}</Text>
          )}
        </View>
        <View style={styles.boatActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEditModal(boat)}
          >
            <Edit size={18} color={colors.skyBlue} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(boat)}
          >
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Tank capacity info */}
      {(boat.fuelCapacityGallons || boat.waterCapacityGallons) && (
        <View style={styles.capacityRow}>
          {boat.fuelCapacityGallons && (
            <View style={styles.capacityItem}>
              <Fuel size={14} color={colors.warning} />
              <Text style={styles.capacityText}>{boat.fuelCapacityGallons} gal fuel</Text>
            </View>
          )}
          {boat.waterCapacityGallons && (
            <View style={styles.capacityItem}>
              <Droplets size={14} color={colors.skyBlue} />
              <Text style={styles.capacityText}>{boat.waterCapacityGallons} gal water</Text>
            </View>
          )}
        </View>
      )}
      
      <View style={styles.boatNavButtons}>
        <TouchableOpacity
          style={styles.boatNavButton}
          onPress={() => navigation.navigate('BoatDevices', { boatId: boat.id, boatName: boat.name })}
        >
          <Radio size={16} color={colors.skyBlue} />
          <Text style={styles.boatNavButtonText}>Devices</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.boatNavButton}
          onPress={() => navigation.navigate('BoatDocuments', { boatId: boat.id, boatName: boat.name })}
        >
          <FileText size={16} color={colors.skyBlue} />
          <Text style={styles.boatNavButtonText}>Documents</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.boatNavButton}
          onPress={() => {
            resetTankForm()
            setShowLogTanksModal(boat)
          }}
        >
          <Fuel size={16} color={colors.skyBlue} />
          <Text style={styles.boatNavButtonText}>Log Tanks</Text>
        </TouchableOpacity>
      </View>
      
      {/* View tank history button */}
      <TouchableOpacity 
        style={styles.historyButton}
        onPress={() => setShowTankHistory(boat)}
      >
        <History size={14} color={colors.textMuted} />
        <Text style={styles.historyButtonText}>View Tank History</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={boats}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ship size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Boats Yet</Text>
            <Text style={styles.emptyText}>
              Add your vessels to quickly create float plans
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Plus size={28} color={colors.textInverse} />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBoat ? 'Edit Boat' : 'Add Boat'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false)
                  resetForm()
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Photo Picker */}
              <View style={styles.photoSection}>
                <TouchableOpacity 
                  style={styles.photoPickerButton}
                  onPress={() => setShowPhotoOptions(true)}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color={colors.skyBlue} />
                  ) : photoUri || photoUrl ? (
                    <Image source={{ uri: photoUri || photoUrl }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Camera size={32} color={colors.textMuted} />
                      <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {(photoUri || photoUrl) && (
                  <TouchableOpacity 
                    style={styles.removePhotoButton}
                    onPress={() => {
                      setPhotoUri(undefined)
                      setPhotoUrl(undefined)
                    }}
                  >
                    <Text style={styles.removePhotoText}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Boat name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Type</Text>
                <TextInput
                  style={styles.input}
                  value={type}
                  onChangeText={setType}
                  placeholder="e.g., Sailboat, Motorboat"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Length</Text>
                <TextInput
                  style={styles.input}
                  value={length}
                  onChangeText={setLength}
                  placeholder="e.g., 32 ft"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Registration</Text>
                <TextInput
                  style={styles.input}
                  value={registration}
                  onChangeText={setRegistration}
                  placeholder="Registration number"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Home Port</Text>
                <TextInput
                  style={styles.input}
                  value={homePort}
                  onChangeText={setHomePort}
                  placeholder="Home port"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Color</Text>
                <TextInput
                  style={styles.input}
                  value={color}
                  onChangeText={setColor}
                  placeholder="Hull color"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Tank Capacities */}
              <View style={styles.capacitiesSection}>
                <Text style={styles.sectionLabel}>Tank Capacities (for SAR reporting)</Text>
                <View style={styles.capacitiesRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
                    <Text style={styles.label}>Fuel (gallons)</Text>
                    <TextInput
                      style={styles.input}
                      value={fuelCapacityGallons}
                      onChangeText={setFuelCapacityGallons}
                      placeholder="e.g., 100"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm }]}>
                    <Text style={styles.label}>Water (gallons)</Text>
                    <TextInput
                      style={styles.input}
                      value={waterCapacityGallons}
                      onChangeText={setWaterCapacityGallons}
                      placeholder="e.g., 50"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {editingBoat ? 'Update Boat' : 'Add Boat'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo Options Modal */}
      <Modal visible={showPhotoOptions} animationType="fade" transparent>
        <TouchableOpacity 
          style={styles.photoOptionsOverlay}
          activeOpacity={1}
          onPress={() => setShowPhotoOptions(false)}
        >
          <View style={styles.photoOptionsContent}>
            <Text style={styles.photoOptionsTitle}>Add Vessel Photo</Text>
            <TouchableOpacity style={styles.photoOption} onPress={handleTakePhoto}>
              <Camera size={24} color={colors.skyBlue} />
              <Text style={styles.photoOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoOption} onPress={handlePickPhoto}>
              <ImageIcon size={24} color={colors.skyBlue} />
              <Text style={styles.photoOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.photoOption, styles.photoOptionCancel]} 
              onPress={() => setShowPhotoOptions(false)}
            >
              <Text style={styles.photoOptionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tank Log Modal */}
      <Modal visible={showLogTanksModal !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.tankModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Tank Levels</Text>
              <TouchableOpacity onPress={() => {
                resetTankForm()
                setShowLogTanksModal(null)
              }}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {showLogTanksModal && (
              <Text style={styles.tankBoatName}>{showLogTanksModal.name}</Text>
            )}
            
            <View style={styles.tankInputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <View style={styles.tankLabelRow}>
                  <Fuel size={16} color={colors.warning} />
                  <Text style={styles.label}>Fuel %</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={tankFuel}
                  onChangeText={setTankFuel}
                  placeholder="0-100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginHorizontal: spacing.sm }]}>
                <View style={styles.tankLabelRow}>
                  <Droplets size={16} color={colors.skyBlue} />
                  <Text style={styles.label}>Water %</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={tankWater}
                  onChangeText={setTankWater}
                  placeholder="0-100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <View style={styles.tankLabelRow}>
                  <Text style={styles.label}>Black %</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={tankBlackwater}
                  onChangeText={setTankBlackwater}
                  placeholder="0-100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={styles.input}
                value={tankNotes}
                onChangeText={setTankNotes}
                placeholder="Optional notes"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            
            <TouchableOpacity style={styles.saveButton} onPress={handleLogTanks}>
              <Text style={styles.saveButtonText}>Save Tank Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tank History Modal */}
      <Modal visible={showTankHistory !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.tankHistoryContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tank History</Text>
              <TouchableOpacity onPress={() => setShowTankHistory(null)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {showTankHistory && (
              <>
                <Text style={styles.tankBoatName}>{showTankHistory.name}</Text>
                <FlatList
                  data={getTankLogsForBoat(showTankHistory.id)}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.tankHistoryItem}>
                      <Text style={styles.tankHistoryDate}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                      <View style={styles.tankHistoryLevels}>
                        {item.fuel !== undefined && (
                          <View style={styles.tankHistoryLevel}>
                            <Fuel size={14} color={colors.warning} />
                            <Text style={styles.tankHistoryValue}>{item.fuel}%</Text>
                          </View>
                        )}
                        {item.water !== undefined && (
                          <View style={styles.tankHistoryLevel}>
                            <Droplets size={14} color={colors.skyBlue} />
                            <Text style={styles.tankHistoryValue}>{item.water}%</Text>
                          </View>
                        )}
                        {item.blackwater !== undefined && (
                          <Text style={styles.tankHistoryValue}>Black: {item.blackwater}%</Text>
                        )}
                      </View>
                      {item.notes && (
                        <Text style={styles.tankHistoryNotes}>{item.notes}</Text>
                      )}
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyHistoryText}>No tank logs recorded yet</Text>
                  }
                />
              </>
            )}
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
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  boatCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  boatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boatImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  boatIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  boatContent: {
    flex: 1,
  },
  boatName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  boatDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  boatActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  capacityRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  capacityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  capacityText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  boatNavButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    gap: spacing.sm,
  },
  boatNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  boatNavButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.skyBlue,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  historyButtonText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing['3xl'],
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  formScroll: {
    maxHeight: 450,
  },
  
  // Photo section
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  photoPickerButton: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.slate100,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  removePhotoButton: {
    marginTop: spacing.sm,
  },
  removePhotoText: {
    fontSize: fontSize.sm,
    color: colors.error,
  },
  
  // Photo options modal
  photoOptionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  photoOptionsContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  photoOptionsTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  photoOptionText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  photoOptionCancel: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: spacing.sm,
  },
  photoOptionCancelText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: 'center',
  },
  
  // Capacities section
  capacitiesSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  capacitiesRow: {
    flexDirection: 'row',
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
  saveButton: {
    backgroundColor: colors.skyBlue,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  
  // Tank modals
  tankModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  tankBoatName: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tankInputRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  tankLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  
  // Tank history
  tankHistoryContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '70%',
  },
  tankHistoryItem: {
    backgroundColor: colors.slate100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tankHistoryDate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tankHistoryLevels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tankHistoryLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tankHistoryValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tankHistoryNotes: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  emptyHistoryText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
})
