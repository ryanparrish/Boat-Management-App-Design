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
  ScrollView,
} from 'react-native'
import { useRoute, RouteProp } from '@react-navigation/native'
import {
  Radio,
  Antenna,
  LifeBuoy,
  Navigation,
  Plus,
  Edit,
  Trash2,
  X,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import type { RootStackParamList, BoatDevice, DeviceType } from '../types'

type RouteType = RouteProp<RootStackParamList, 'BoatDevices'>

const DEVICE_TYPES: { type: DeviceType; label: string; icon: any }[] = [
  { type: 'dsc_radio', label: 'DSC VHF Radio', icon: Radio },
  { type: 'ssb_radio', label: 'SSB Radio', icon: Antenna },
  { type: 'epirb', label: 'EPIRB', icon: LifeBuoy },
  { type: 'plb', label: 'PLB', icon: LifeBuoy },
  { type: 'ais', label: 'AIS Transponder', icon: Navigation },
  { type: 'other', label: 'Other', icon: Radio },
]

const getDeviceIcon = (type: DeviceType) => {
  const config = DEVICE_TYPES.find(d => d.type === type)
  return config?.icon || Radio
}

const getDeviceLabel = (type: DeviceType) => {
  const config = DEVICE_TYPES.find(d => d.type === type)
  return config?.label || 'Device'
}

export function BoatDevices() {
  const route = useRoute<RouteType>()
  const { boatId, boatName } = route.params

  const [modalVisible, setModalVisible] = useState(false)
  const [editingDevice, setEditingDevice] = useState<BoatDevice | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [deviceType, setDeviceType] = useState<DeviceType>('dsc_radio')
  const [name, setName] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')

  const { boatDevices, addBoatDevice, updateBoatDevice, deleteBoatDevice, addSyncOperation, user } = useAppStore((s) => ({
    boatDevices: s.boatDevices.filter(d => d.boatId === boatId),
    addBoatDevice: s.addBoatDevice,
    updateBoatDevice: s.updateBoatDevice,
    deleteBoatDevice: s.deleteBoatDevice,
    addSyncOperation: s.addSyncOperation,
    user: s.user,
  }))

  const resetForm = () => {
    setDeviceType('dsc_radio')
    setName('')
    setDeviceId('')
    setSerialNumber('')
    setExpirationDate('')
    setNotes('')
    setEditingDevice(null)
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const openEditModal = (device: BoatDevice) => {
    setEditingDevice(device)
    setDeviceType(device.type)
    setName(device.name)
    setDeviceId(device.deviceId || '')
    setSerialNumber(device.serialNumber || '')
    setExpirationDate(device.expirationDate || '')
    setNotes(device.notes || '')
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a device name')
      return
    }

    setLoading(true)

    const deviceData = {
      boatId,
      type: deviceType,
      name: name.trim(),
      deviceId: deviceId.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      expirationDate: expirationDate.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      if (editingDevice) {
        updateBoatDevice(editingDevice.id, deviceData)
        addSyncOperation({
          type: 'update',
          endpoint: `/boat-devices/${editingDevice.id}`,
          method: 'PUT',
          body: deviceData,
        })
      } else {
        const newDevice: BoatDevice = {
          ...deviceData,
          id: `${user?.id}_device_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        addBoatDevice(newDevice)
        addSyncOperation({
          type: 'create',
          endpoint: '/boat-devices',
          method: 'POST',
          body: deviceData,
        })
      }

      setModalVisible(false)
      resetForm()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save device')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (device: BoatDevice) => {
    Alert.alert('Delete Device', `Are you sure you want to remove ${device.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteBoatDevice(device.id)
          addSyncOperation({
            type: 'delete',
            endpoint: `/boat-devices/${device.id}`,
            method: 'DELETE',
          })
        },
      },
    ])
  }

  const renderItem = ({ item: device }: { item: BoatDevice }) => {
    const Icon = getDeviceIcon(device.type)
    const isExpiring = device.expirationDate && 
      new Date(device.expirationDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    return (
      <View style={styles.deviceCard}>
        <View style={[styles.deviceIcon, isExpiring && styles.deviceIconWarning]}>
          <Icon size={24} color={isExpiring ? colors.warning : colors.skyBlue} />
        </View>
        <View style={styles.deviceContent}>
          <Text style={styles.deviceName}>{device.name}</Text>
          <Text style={styles.deviceType}>{getDeviceLabel(device.type)}</Text>
          {device.deviceId && (
            <Text style={styles.deviceId}>ID: {device.deviceId}</Text>
          )}
          {device.expirationDate && (
            <Text style={[styles.expirationDate, isExpiring && styles.expirationWarning]}>
              Expires: {new Date(device.expirationDate).toLocaleDateString()}
            </Text>
          )}
        </View>
        <View style={styles.deviceActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(device)}>
            <Edit size={18} color={colors.skyBlue} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(device)}>
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={boatDevices}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Radio size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Devices Yet</Text>
            <Text style={styles.emptyText}>
              Add your radios, EPIRB, and other safety devices
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
                {editingDevice ? 'Edit Device' : 'Add Device'}
              </Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Device Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.typeOptions}>
                    {DEVICE_TYPES.map((dt) => (
                      <TouchableOpacity
                        key={dt.type}
                        style={[
                          styles.typeOption,
                          deviceType === dt.type && styles.typeOptionActive,
                        ]}
                        onPress={() => setDeviceType(dt.type)}
                      >
                        <dt.icon size={16} color={deviceType === dt.type ? colors.textInverse : colors.textSecondary} />
                        <Text style={[
                          styles.typeOptionText,
                          deviceType === dt.type && styles.typeOptionTextActive,
                        ]}>
                          {dt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Icom IC-M506"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Device ID (MMSI / HEX ID)</Text>
                <TextInput
                  style={styles.input}
                  value={deviceId}
                  onChangeText={setDeviceId}
                  placeholder="e.g., 338123456"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Serial Number</Text>
                <TextInput
                  style={styles.input}
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                  placeholder="Serial number"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expiration Date (for EPIRB/PLB registration)</Text>
                <TextInput
                  style={styles.input}
                  value={expirationDate}
                  onChangeText={setExpirationDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes (battery expiration, etc.)"
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
                {editingDevice ? 'Update Device' : 'Add Device'}
              </Text>
            </TouchableOpacity>
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
  deviceCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...shadows.sm,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  deviceIconWarning: {
    backgroundColor: colors.warningLight,
  },
  deviceContent: {
    flex: 1,
  },
  deviceName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  deviceType: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  deviceId: {
    fontSize: fontSize.sm,
    color: colors.skyBlue,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
  expirationDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  expirationWarning: {
    color: colors.warning,
    fontWeight: fontWeight.medium,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    maxHeight: 400,
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
  typeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  typeOptionActive: {
    backgroundColor: colors.skyBlue,
  },
  typeOptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  typeOptionTextActive: {
    color: colors.textInverse,
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
})
