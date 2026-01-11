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
  FileText,
  Shield,
  Building2,
  ClipboardCheck,
  Plus,
  Edit,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import type { RootStackParamList, BoatDocument, DocumentType } from '../types'

type RouteType = RouteProp<RootStackParamList, 'BoatDocuments'>

const DOCUMENT_TYPES: { type: DocumentType; label: string; icon: any }[] = [
  { type: 'federal_registration', label: 'Federal Registration', icon: Building2 },
  { type: 'state_registration', label: 'State Registration', icon: FileText },
  { type: 'insurance', label: 'Insurance', icon: Shield },
  { type: 'survey', label: 'Survey', icon: ClipboardCheck },
  { type: 'other', label: 'Other', icon: FileText },
]

const getDocumentIcon = (type: DocumentType) => {
  const config = DOCUMENT_TYPES.find(d => d.type === type)
  return config?.icon || FileText
}

const getDocumentLabel = (type: DocumentType) => {
  const config = DOCUMENT_TYPES.find(d => d.type === type)
  return config?.label || 'Document'
}

export function BoatDocuments() {
  const route = useRoute<RouteType>()
  const { boatId, boatName } = route.params

  const [modalVisible, setModalVisible] = useState(false)
  const [editingDoc, setEditingDoc] = useState<BoatDocument | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [docType, setDocType] = useState<DocumentType>('federal_registration')
  const [name, setName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [provider, setProvider] = useState('')
  const [notes, setNotes] = useState('')

  const { boatDocuments, addBoatDocument, updateBoatDocument, deleteBoatDocument, addSyncOperation, user } = useAppStore((s) => ({
    boatDocuments: s.boatDocuments.filter(d => d.boatId === boatId),
    addBoatDocument: s.addBoatDocument,
    updateBoatDocument: s.updateBoatDocument,
    deleteBoatDocument: s.deleteBoatDocument,
    addSyncOperation: s.addSyncOperation,
    user: s.user,
  }))

  const resetForm = () => {
    setDocType('federal_registration')
    setName('')
    setDocumentNumber('')
    setIssueDate('')
    setExpirationDate('')
    setProvider('')
    setNotes('')
    setEditingDoc(null)
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const openEditModal = (doc: BoatDocument) => {
    setEditingDoc(doc)
    setDocType(doc.type)
    setName(doc.name)
    setDocumentNumber(doc.documentNumber || '')
    setIssueDate(doc.issueDate || '')
    setExpirationDate(doc.expirationDate || '')
    setProvider(doc.provider || '')
    setNotes(doc.notes || '')
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a document name')
      return
    }

    setLoading(true)

    const docData = {
      boatId,
      type: docType,
      name: name.trim(),
      documentNumber: documentNumber.trim() || undefined,
      issueDate: issueDate.trim() || undefined,
      expirationDate: expirationDate.trim() || undefined,
      provider: provider.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      if (editingDoc) {
        updateBoatDocument(editingDoc.id, docData)
        addSyncOperation({
          type: 'update',
          endpoint: `/boat-documents/${editingDoc.id}`,
          method: 'PUT',
          body: docData,
        })
      } else {
        const newDoc: BoatDocument = {
          ...docData,
          id: `${user?.id}_doc_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        addBoatDocument(newDoc)
        addSyncOperation({
          type: 'create',
          endpoint: '/boat-documents',
          method: 'POST',
          body: docData,
        })
      }

      setModalVisible(false)
      resetForm()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save document')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (doc: BoatDocument) => {
    Alert.alert('Delete Document', `Are you sure you want to remove ${doc.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteBoatDocument(doc.id)
          addSyncOperation({
            type: 'delete',
            endpoint: `/boat-documents/${doc.id}`,
            method: 'DELETE',
          })
        },
      },
    ])
  }

  const getExpirationStatus = (expDate?: string) => {
    if (!expDate) return { status: 'none', label: '' }
    
    const exp = new Date(expDate)
    const now = new Date()
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    
    if (exp < now) {
      return { status: 'expired', label: 'Expired' }
    } else if (exp <= thirtyDaysFromNow) {
      return { status: 'expiring', label: 'Expiring Soon' }
    }
    return { status: 'valid', label: 'Valid' }
  }

  const renderItem = ({ item: doc }: { item: BoatDocument }) => {
    const Icon = getDocumentIcon(doc.type)
    const expStatus = getExpirationStatus(doc.expirationDate)
    const isWarning = expStatus.status === 'expiring' || expStatus.status === 'expired'

    return (
      <View style={styles.docCard}>
        <View style={[styles.docIcon, isWarning && styles.docIconWarning]}>
          <Icon size={24} color={isWarning ? colors.warning : colors.skyBlue} />
        </View>
        <View style={styles.docContent}>
          <View style={styles.docHeader}>
            <Text style={styles.docName}>{doc.name}</Text>
            {expStatus.status !== 'none' && (
              <View style={[
                styles.statusBadge,
                expStatus.status === 'expired' && styles.statusExpired,
                expStatus.status === 'expiring' && styles.statusExpiring,
                expStatus.status === 'valid' && styles.statusValid,
              ]}>
                {isWarning && <AlertTriangle size={12} color={expStatus.status === 'expired' ? colors.error : colors.warning} />}
                <Text style={[
                  styles.statusText,
                  expStatus.status === 'expired' && styles.statusTextExpired,
                  expStatus.status === 'expiring' && styles.statusTextExpiring,
                  expStatus.status === 'valid' && styles.statusTextValid,
                ]}>
                  {expStatus.label}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.docType}>{getDocumentLabel(doc.type)}</Text>
          {doc.documentNumber && (
            <Text style={styles.docNumber}>#{doc.documentNumber}</Text>
          )}
          {doc.provider && (
            <Text style={styles.docProvider}>{doc.provider}</Text>
          )}
          {doc.expirationDate && (
            <Text style={[styles.expirationDate, isWarning && styles.expirationWarning]}>
              Expires: {new Date(doc.expirationDate).toLocaleDateString()}
            </Text>
          )}
        </View>
        <View style={styles.docActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(doc)}>
            <Edit size={18} color={colors.skyBlue} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(doc)}>
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={boatDocuments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <FileText size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Documents Yet</Text>
            <Text style={styles.emptyText}>
              Add registrations, insurance, and other important documents
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
                {editingDoc ? 'Edit Document' : 'Add Document'}
              </Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Document Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.typeOptions}>
                    {DOCUMENT_TYPES.map((dt) => (
                      <TouchableOpacity
                        key={dt.type}
                        style={[
                          styles.typeOption,
                          docType === dt.type && styles.typeOptionActive,
                        ]}
                        onPress={() => setDocType(dt.type)}
                      >
                        <dt.icon size={16} color={docType === dt.type ? colors.textInverse : colors.textSecondary} />
                        <Text style={[
                          styles.typeOptionText,
                          docType === dt.type && styles.typeOptionTextActive,
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
                  placeholder="e.g., USCG Documentation"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Document Number</Text>
                <TextInput
                  style={styles.input}
                  value={documentNumber}
                  onChangeText={setDocumentNumber}
                  placeholder="Registration or policy number"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Provider / Issuing Authority</Text>
                <TextInput
                  style={styles.input}
                  value={provider}
                  onChangeText={setProvider}
                  placeholder="e.g., USCG, State of Florida"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Issue Date</Text>
                  <TextInput
                    style={styles.input}
                    value={issueDate}
                    onChangeText={setIssueDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Expiration Date</Text>
                  <TextInput
                    style={styles.input}
                    value={expirationDate}
                    onChangeText={setExpirationDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />
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
                {editingDoc ? 'Update Document' : 'Add Document'}
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
  docCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...shadows.sm,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  docIconWarning: {
    backgroundColor: colors.warningLight,
  },
  docContent: {
    flex: 1,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  docName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusExpired: {
    backgroundColor: colors.errorLight,
  },
  statusExpiring: {
    backgroundColor: colors.warningLight,
  },
  statusValid: {
    backgroundColor: colors.successLight,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  statusTextExpired: {
    color: colors.error,
  },
  statusTextExpiring: {
    color: colors.warning,
  },
  statusTextValid: {
    color: colors.success,
  },
  docType: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  docNumber: {
    fontSize: fontSize.sm,
    color: colors.skyBlue,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
  docProvider: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
  docActions: {
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
  row: {
    flexDirection: 'row',
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
