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
  Switch,
} from 'react-native'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  X,
  Mail,
  Phone,
  User,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import { contactsApi } from '../services/supabase'
import { isOnline } from '../services/sync'
import type { Contact } from '../types'

export function ContactsManager() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<'email' | 'sms' | 'both'>('email')
  const [permission, setPermission] = useState(false)

  const { contacts, addContact, updateContact, deleteContact, addSyncOperation, user } = useAppStore((s) => ({
    contacts: s.contacts,
    addContact: s.addContact,
    updateContact: s.updateContact,
    deleteContact: s.deleteContact,
    addSyncOperation: s.addSyncOperation,
    user: s.user,
  }))

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setMethod('email')
    setPermission(false)
    setEditingContact(null)
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact)
    setName(contact.name)
    setEmail(contact.email || '')
    setPhone(contact.phone || '')
    setMethod(contact.method)
    setPermission(contact.permission)
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a contact name')
      return
    }
    if (!email.trim() && !phone.trim()) {
      Alert.alert('Error', 'Please enter an email or phone number')
      return
    }

    setLoading(true)

    const contactData = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      method,
      permission,
    }

    try {
      const online = await isOnline()

      if (editingContact) {
        updateContact(editingContact.id, contactData)

        if (online) {
          try {
            await contactsApi.update(editingContact.id, contactData)
          } catch {
            addSyncOperation({
              type: 'update',
              endpoint: `/contacts/${editingContact.id}`,
              method: 'PUT',
              body: contactData,
            })
          }
        } else {
          addSyncOperation({
            type: 'update',
            endpoint: `/contacts/${editingContact.id}`,
            method: 'PUT',
            body: contactData,
          })
        }
      } else {
        const newContact: Contact = {
          ...contactData,
          id: `${user?.id}_contact_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        addContact(newContact)

        if (online) {
          try {
            await contactsApi.create(contactData)
          } catch {
            addSyncOperation({
              type: 'create',
              endpoint: '/contacts',
              method: 'POST',
              body: contactData,
            })
          }
        } else {
          addSyncOperation({
            type: 'create',
            endpoint: '/contacts',
            method: 'POST',
            body: contactData,
          })
        }
      }

      setModalVisible(false)
      resetForm()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save contact')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to remove ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            deleteContact(contact.id)
            addSyncOperation({
              type: 'delete',
              endpoint: `/contacts/${contact.id}`,
              method: 'DELETE',
            })
          },
        },
      ]
    )
  }

  const renderItem = ({ item: contact }: { item: Contact }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactIcon}>
        <User size={24} color={colors.skyBlue} />
      </View>
      <View style={styles.contactContent}>
        <Text style={styles.contactName}>{contact.name}</Text>
        {contact.email && (
          <View style={styles.contactDetail}>
            <Mail size={14} color={colors.textMuted} />
            <Text style={styles.contactDetailText}>{contact.email}</Text>
          </View>
        )}
        {contact.phone && (
          <View style={styles.contactDetail}>
            <Phone size={14} color={colors.textMuted} />
            <Text style={styles.contactDetailText}>{contact.phone}</Text>
          </View>
        )}
        <View style={styles.contactMeta}>
          <View style={[styles.methodBadge, contact.permission && styles.methodBadgeActive]}>
            <Text style={[styles.methodBadgeText, contact.permission && styles.methodBadgeTextActive]}>
              {contact.method.toUpperCase()}
            </Text>
          </View>
          {contact.permission && (
            <Text style={styles.permissionText}>✓ Emergency contact</Text>
          )}
        </View>
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(contact)}
        >
          <Edit size={18} color={colors.skyBlue} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(contact)}
        >
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Users size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
            <Text style={styles.emptyText}>
              Add contacts who should be notified if you miss a check-in
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
                {editingContact ? 'Edit Contact' : 'Add Contact'}
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

            <View style={styles.formScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Contact name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 (555) 123-4567"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notification Method</Text>
                <View style={styles.methodOptions}>
                  {(['email', 'sms', 'both'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.methodOption,
                        method === m && styles.methodOptionActive,
                      ]}
                      onPress={() => setMethod(m)}
                    >
                      <Text
                        style={[
                          styles.methodOptionText,
                          method === m && styles.methodOptionTextActive,
                        ]}
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchTitle}>Emergency Contact</Text>
                  <Text style={styles.switchDescription}>
                    Notify this person if I miss a check-in
                  </Text>
                </View>
                <Switch
                  value={permission}
                  onValueChange={setPermission}
                  trackColor={{ false: colors.slate300, true: colors.skyBlueLight }}
                  thumbColor={permission ? colors.skyBlue : colors.slate400}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {editingContact ? 'Update Contact' : 'Add Contact'}
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
  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...shadows.sm,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  contactContent: {
    flex: 1,
  },
  contactName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  contactDetailText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  methodBadge: {
    backgroundColor: colors.slate200,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  methodBadgeActive: {
    backgroundColor: colors.skyBlueLight,
  },
  methodBadgeText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  methodBadgeTextActive: {
    color: colors.navy,
  },
  permissionText: {
    fontSize: fontSize.xs,
    color: colors.success,
  },
  contactActions: {
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
  methodOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodOption: {
    flex: 1,
    backgroundColor: colors.slate100,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  methodOptionActive: {
    backgroundColor: colors.skyBlue,
    borderColor: colors.skyBlue,
  },
  methodOptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  methodOptionTextActive: {
    color: colors.textInverse,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  switchLabel: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  switchDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
