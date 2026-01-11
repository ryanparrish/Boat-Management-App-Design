import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import {
  Users,
  Plus,
  Trash2,
  X,
  Mail,
  Crown,
  UserCheck,
  Clock,
  LogOut,
  Home,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import { householdApi } from '../services/supabase'
import type { HouseholdMember, HouseholdInvite } from '../types'

export function HouseholdManager() {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [inviteModalVisible, setInviteModalVisible] = useState(false)
  const [householdName, setHouseholdName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const {
    user,
    household,
    householdMembers,
    pendingInvites,
    setHousehold,
    setHouseholdMembers,
    addHouseholdMember,
    removeHouseholdMember,
    setPendingInvites,
    removeInvite,
  } = useAppStore((s) => ({
    user: s.user,
    household: s.household,
    householdMembers: s.householdMembers,
    pendingInvites: s.pendingInvites,
    setHousehold: s.setHousehold,
    setHouseholdMembers: s.setHouseholdMembers,
    addHouseholdMember: s.addHouseholdMember,
    removeHouseholdMember: s.removeHouseholdMember,
    setPendingInvites: s.setPendingInvites,
    removeInvite: s.removeInvite,
  }))

  const isOwner = household && user && household.ownerId === user.id

  const loadData = async () => {
    try {
      const [householdData, invites] = await Promise.all([
        householdApi.get(),
        householdApi.getPendingInvites(),
      ])

      setHousehold(householdData)
      setPendingInvites(invites)

      if (householdData) {
        const members = await householdApi.getMembers(householdData.id)
        setHouseholdMembers(members)
      }
    } catch (error) {
      console.error('Failed to load household data:', error)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name')
      return
    }

    setSaving(true)
    try {
      const newHousehold = await householdApi.create(householdName.trim())
      setHousehold(newHousehold)
      setHouseholdName('')
      setCreateModalVisible(false)
      Alert.alert('Success', 'Household created! You can now invite family members.')
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create household')
    } finally {
      setSaving(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address')
      return
    }

    if (!household) return

    setSaving(true)
    try {
      await householdApi.inviteMember(household.id, inviteEmail.trim().toLowerCase())
      setInviteEmail('')
      setInviteModalVisible(false)
      Alert.alert('Invite Sent', `An invitation has been sent to ${inviteEmail}`)
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invite')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = (member: HouseholdMember) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.email} from your household?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await householdApi.removeMember(household!.id, member.id)
              removeHouseholdMember(member.id)
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove member')
            }
          },
        },
      ]
    )
  }

  const handleAcceptInvite = async (invite: HouseholdInvite) => {
    try {
      const member = await householdApi.acceptInvite(invite.id)
      removeInvite(invite.id)
      addHouseholdMember(member)
      // Reload household data
      await loadData()
      Alert.alert('Success', `You've joined ${invite.householdName}!`)
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invite')
    }
  }

  const handleDeclineInvite = async (invite: HouseholdInvite) => {
    try {
      await householdApi.declineInvite(invite.id)
      removeInvite(invite.id)
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to decline invite')
    }
  }

  const handleLeaveHousehold = () => {
    Alert.alert(
      'Leave Household',
      'Are you sure you want to leave this household? You will lose access to shared data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await householdApi.leave(household!.id)
              setHousehold(null)
              setHouseholdMembers([])
              Alert.alert('Success', 'You have left the household')
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave household')
            }
          },
        },
      ]
    )
  }

  const renderMemberItem = ({ item: member }: { item: HouseholdMember }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.memberIcon}>
          {member.role === 'owner' ? (
            <Crown size={20} color={colors.warning} />
          ) : (
            <UserCheck size={20} color={colors.skyBlue} />
          )}
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberEmail}>{member.email}</Text>
          <Text style={styles.memberRole}>
            {member.role === 'owner' ? 'Owner' : 'Member'}
            {member.status === 'pending' && ' • Pending'}
          </Text>
        </View>
      </View>
      {isOwner && member.role !== 'owner' && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveMember(member)}
        >
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      )}
    </View>
  )

  const renderInviteItem = ({ item: invite }: { item: HouseholdInvite }) => (
    <View style={styles.inviteCard}>
      <View style={styles.inviteInfo}>
        <Home size={24} color={colors.skyBlue} />
        <View style={styles.inviteDetails}>
          <Text style={styles.inviteHousehold}>{invite.householdName}</Text>
          <Text style={styles.inviteFrom}>Invited by {invite.inviterEmail}</Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <TouchableOpacity
          style={[styles.inviteButton, styles.acceptButton]}
          onPress={() => handleAcceptInvite(invite)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inviteButton, styles.declineButton]}
          onPress={() => handleDeclineInvite(invite)}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.skyBlue} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Pending Invites Section */}
      {pendingInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Clock size={16} color={colors.warning} /> Pending Invites
          </Text>
          <FlatList
            data={pendingInvites}
            renderItem={renderInviteItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* No Household State */}
      {!household && (
        <View style={styles.emptyState}>
          <Users size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Household</Text>
          <Text style={styles.emptyText}>
            Create a household to share boats, contacts, and float plans with family members.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <Plus size={20} color={colors.textInverse} />
            <Text style={styles.createButtonText}>Create Household</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Household View */}
      {household && (
        <>
          <View style={styles.householdHeader}>
            <View style={styles.householdInfo}>
              <Home size={28} color={colors.skyBlue} />
              <View>
                <Text style={styles.householdName}>{household.name}</Text>
                <Text style={styles.householdMeta}>
                  {householdMembers.length} member{householdMembers.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            {!isOwner && (
              <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveHousehold}>
                <LogOut size={20} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              {isOwner && (
                <TouchableOpacity
                  style={styles.inviteIconButton}
                  onPress={() => setInviteModalVisible(true)}
                >
                  <Mail size={20} color={colors.skyBlue} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={householdMembers}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              ListEmptyComponent={
                <Text style={styles.emptyMemberText}>No members yet</Text>
              }
            />
          </View>

          {isOwner && (
            <TouchableOpacity
              style={styles.inviteMemberButton}
              onPress={() => setInviteModalVisible(true)}
            >
              <Plus size={20} color={colors.textInverse} />
              <Text style={styles.inviteMemberButtonText}>Invite Family Member</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Create Household Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Household</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Give your household a name (e.g., "The Smith Family" or "Lake House Crew")
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Household Name</Text>
              <TextInput
                style={styles.input}
                value={householdName}
                onChangeText={setHouseholdName}
                placeholder="Enter household name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleCreateHousehold}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Create Household</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Invite Member Modal */}
      <Modal visible={inviteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Member</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter the email address of the family member you want to invite. They will receive an
              invitation to join your household.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="family@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleInviteMember}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Send Invite</Text>
              )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  section: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  householdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  householdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  householdName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  householdMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  leaveButton: {
    padding: spacing.sm,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  memberDetails: {
    flex: 1,
  },
  memberEmail: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  memberRole: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.sm,
  },
  emptyMemberText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.sm,
    paddingVertical: spacing.lg,
  },
  inviteCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.skyBlueLight,
    ...shadows.sm,
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  inviteDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  inviteHousehold: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  inviteFrom: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inviteButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: colors.skyBlue,
  },
  acceptButtonText: {
    color: colors.textInverse,
    fontWeight: fontWeight.medium,
  },
  declineButton: {
    backgroundColor: colors.slate200,
  },
  declineButtonText: {
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
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
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.skyBlue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  createButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  inviteIconButton: {
    padding: spacing.sm,
  },
  inviteMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.skyBlue,
    margin: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  inviteMemberButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  modalDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 20,
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
  saveButton: {
    backgroundColor: colors.skyBlue,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
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
