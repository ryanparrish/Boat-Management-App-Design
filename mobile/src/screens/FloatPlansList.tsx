import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import {
  Ship,
  Plus,
  ChevronRight,
  AlertTriangle,
  Clock,
  CheckCircle,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import type { RootStackParamList, FloatPlan } from '../types'

type NavigationProp = StackNavigationProp<RootStackParamList>

export function FloatPlansList() {
  const navigation = useNavigation<NavigationProp>()
  const floatPlans = useAppStore((s) => s.floatPlans)
  
  const plansList = Object.values(floatPlans).sort((a, b) => {
    // Active first, then by deadline
    if (a.status === 'active' && b.status !== 'active') return -1
    if (b.status === 'active' && a.status !== 'active') return 1
    return new Date(b.checkInDeadline).getTime() - new Date(a.checkInDeadline).getTime()
  })

  const getStatusInfo = (plan: FloatPlan) => {
    const deadline = new Date(plan.checkInDeadline)
    const now = new Date()
    
    if (plan.status === 'active' && deadline < now) {
      return { label: 'Overdue', color: colors.error, bgColor: colors.errorLight, icon: AlertTriangle }
    }
    if (plan.status === 'active') {
      const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntil <= 1) {
        return { label: 'Due Soon', color: colors.warning, bgColor: colors.warningLight, icon: Clock }
      }
      return { label: 'Active', color: colors.success, bgColor: colors.successLight, icon: CheckCircle }
    }
    if (plan.status === 'checked_in') {
      return { label: 'Checked In', color: colors.success, bgColor: colors.successLight, icon: CheckCircle }
    }
    if (plan.status === 'draft') {
      return { label: 'Draft', color: colors.textSecondary, bgColor: colors.slate200, icon: Clock }
    }
    return { label: plan.status, color: colors.textSecondary, bgColor: colors.slate200, icon: Clock }
  }

  const renderItem = ({ item: plan }: { item: FloatPlan }) => {
    const status = getStatusInfo(plan)
    const StatusIcon = status.icon
    
    return (
      <TouchableOpacity
        style={styles.planCard}
        onPress={() => navigation.navigate('FloatPlanDetail', { id: plan.id })}
      >
        <View style={styles.planIcon}>
          <Ship size={24} color={colors.skyBlue} />
        </View>
        
        <View style={styles.planContent}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.vesselName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
              <StatusIcon size={12} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>
          
          <Text style={styles.planRoute}>
            {plan.departure} → {plan.destination}
          </Text>
          
          <Text style={styles.planDeadline}>
            Check-in: {new Date(plan.checkInDeadline).toLocaleString()}
          </Text>
        </View>
        
        <ChevronRight size={20} color={colors.textMuted} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plansList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ship size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Float Plans</Text>
            <Text style={styles.emptyText}>
              Create a float plan to let others know your trip details
            </Text>
          </View>
        }
      />
      
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateFloatPlan', {})}
      >
        <Plus size={28} color={colors.textInverse} />
      </TouchableOpacity>
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
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  planContent: {
    flex: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  planName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },
  planRoute: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  planDeadline: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
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
})
