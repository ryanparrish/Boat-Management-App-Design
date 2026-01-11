import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import {
  Anchor,
  Ship,
  MapPin,
  Users,
  Package,
  ClipboardList,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  LogOut,
  Home,
  FileText,
  CloudSun,
  CloudLightning,
  Navigation2,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import { syncAllData } from '../services/sync'
import { clearAccessToken } from '../services/supabase'
import { getAlertSeverityColor } from '../services/weather'
import type { RootStackParamList, FloatPlan, MarineAlert } from '../types'

type NavigationProp = StackNavigationProp<RootStackParamList>

export function Dashboard() {
  const navigation = useNavigation<NavigationProp>()
  const [refreshing, setRefreshing] = useState(false)
  
  const { floatPlans, boats, contacts, boatDocuments, boatDevices, isSyncing, logout, cachedAlerts, subscribedZones } = useAppStore((s) => ({
    floatPlans: s.floatPlans,
    boats: s.boats,
    contacts: s.contacts,
    boatDocuments: s.boatDocuments,
    boatDevices: s.boatDevices,
    isSyncing: s.isSyncing,
    logout: s.logout,
    cachedAlerts: s.cachedAlerts,
    subscribedZones: s.subscribedZones,
  }))

  // Get all active weather alerts (cachedAlerts is a flat array)
  const activeAlerts = React.useMemo(() => {
    return cachedAlerts
  }, [cachedAlerts])

  const plansList = Object.values(floatPlans)
  
  // Calculate plan statistics
  const activePlans = plansList.filter((p) => p.status === 'active')
  const overduePlans = activePlans.filter((p) => {
    const deadline = new Date(p.checkInDeadline)
    return deadline < new Date()
  })
  const upcomingPlans = activePlans.filter((p) => {
    const deadline = new Date(p.checkInDeadline)
    const now = new Date()
    const hourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    return deadline > now && deadline <= hourFromNow
  })

  // Calculate expiring documents and devices
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const now = new Date()
  
  const expiringDocuments = boatDocuments.filter((doc) => {
    if (!doc.expirationDate) return false
    const exp = new Date(doc.expirationDate)
    return exp <= thirtyDaysFromNow && exp >= now
  })
  
  const expiredDocuments = boatDocuments.filter((doc) => {
    if (!doc.expirationDate) return false
    return new Date(doc.expirationDate) < now
  })
  
  const expiringDevices = boatDevices.filter((dev) => {
    if (!dev.expirationDate) return false
    const exp = new Date(dev.expirationDate)
    return exp <= thirtyDaysFromNow && exp >= now
  })
  
  const expiredDevices = boatDevices.filter((dev) => {
    if (!dev.expirationDate) return false
    return new Date(dev.expirationDate) < now
  })
  
  const totalExpiring = expiringDocuments.length + expiringDevices.length
  const totalExpired = expiredDocuments.length + expiredDevices.length

  useEffect(() => {
    // Sync data on mount
    syncAllData()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await syncAllData()
    setRefreshing(false)
  }

  const handleLogout = () => {
    clearAccessToken()
    logout()
  }

  const renderQuickAction = (
    icon: React.ReactNode,
    label: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>{icon}</View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  )

  const renderPlanCard = (plan: FloatPlan) => {
    const deadline = new Date(plan.checkInDeadline)
    const isOverdue = deadline < new Date() && plan.status === 'active'
    const isUrgent =
      !isOverdue &&
      deadline < new Date(Date.now() + 60 * 60 * 1000) &&
      plan.status === 'active'

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isOverdue && styles.planCardOverdue,
          isUrgent && styles.planCardUrgent,
        ]}
        onPress={() => navigation.navigate('FloatPlanDetail', { id: plan.id })}
      >
        <View style={styles.planCardHeader}>
          <View style={styles.planCardTitle}>
            <Ship size={20} color={isOverdue ? colors.error : colors.skyBlue} />
            <Text style={styles.planCardName}>{plan.vesselName}</Text>
          </View>
          {isOverdue && (
            <View style={styles.statusBadge}>
              <AlertTriangle size={14} color={colors.error} />
              <Text style={styles.statusBadgeText}>Overdue</Text>
            </View>
          )}
          {isUrgent && !isOverdue && (
            <View style={[styles.statusBadge, styles.statusBadgeUrgent]}>
              <Clock size={14} color={colors.warning} />
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextUrgent]}>
                Soon
              </Text>
            </View>
          )}
        </View>
        <View style={styles.planCardDetails}>
          <Text style={styles.planCardRoute}>
            {plan.departure} → {plan.destination}
          </Text>
          <Text style={styles.planCardDeadline}>
            Check-in: {deadline.toLocaleString()}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.textMuted} style={styles.chevron} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Anchor size={24} color={colors.textInverse} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Float Plan</Text>
            <Text style={styles.headerSubtitle}>Safety Manager</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status Cards */}
        {overduePlans.length > 0 && (
          <View style={styles.alertCard}>
            <AlertTriangle size={24} color={colors.error} />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                {overduePlans.length} Overdue Check-in{overduePlans.length > 1 ? 's' : ''}
              </Text>
              <Text style={styles.alertText}>
                Tap to view and check in now
              </Text>
            </View>
          </View>
        )}

        {/* Expiring Documents/Devices Alert */}
        {(totalExpired > 0 || totalExpiring > 0) && (
          <View style={[styles.alertCard, totalExpired > 0 ? styles.alertCardExpired : styles.alertCardWarning]}>
            <FileText size={24} color={totalExpired > 0 ? colors.error : colors.warning} />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, totalExpired === 0 && styles.alertTitleWarning]}>
                {totalExpired > 0 
                  ? `${totalExpired} Expired Document${totalExpired > 1 ? 's' : ''}/Device${totalExpired > 1 ? 's' : ''}`
                  : `${totalExpiring} Expiring Soon`}
              </Text>
              <Text style={styles.alertText}>
                {totalExpired > 0 
                  ? 'Update your registrations and certifications'
                  : 'Documents or devices expiring within 30 days'}
              </Text>
            </View>
          </View>
        )}

        {/* Marine Weather Alerts */}
        {activeAlerts.length > 0 && (
          <TouchableOpacity 
            style={[styles.alertCard, { backgroundColor: getAlertSeverityColor(activeAlerts[0].severity) + '20', borderLeftColor: getAlertSeverityColor(activeAlerts[0].severity) }]}
            onPress={() => navigation.navigate('WeatherDashboard')}
          >
            <CloudLightning size={24} color={getAlertSeverityColor(activeAlerts[0].severity)} />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: getAlertSeverityColor(activeAlerts[0].severity) }]}>
                {activeAlerts.length} Active Marine Alert{activeAlerts.length > 1 ? 's' : ''}
              </Text>
              <Text style={styles.alertText} numberOfLines={1}>
                {activeAlerts[0].event}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Weather Dashboard Quick Access */}
        {subscribedZones.length > 0 && activeAlerts.length === 0 && (
          <TouchableOpacity 
            style={styles.weatherCard}
            onPress={() => navigation.navigate('WeatherDashboard')}
          >
            <CloudSun size={24} color={colors.skyBlue} />
            <View style={styles.alertContent}>
              <Text style={styles.weatherCardTitle}>Marine Weather</Text>
              <Text style={styles.weatherCardSubtitle}>
                {subscribedZones.length} zone{subscribedZones.length > 1 ? 's' : ''} • No active alerts
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ship size={28} color={colors.skyBlue} />
            <Text style={styles.statValue}>{activePlans.length}</Text>
            <Text style={styles.statLabel}>Active Plans</Text>
          </View>
          <View style={styles.statCard}>
            <Anchor size={28} color={colors.skyBlue} />
            <Text style={styles.statValue}>{boats.length}</Text>
            <Text style={styles.statLabel}>Boats</Text>
          </View>
          <View style={styles.statCard}>
            <Users size={28} color={colors.skyBlue} />
            <Text style={styles.statValue}>{contacts.length}</Text>
            <Text style={styles.statLabel}>Contacts</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {renderQuickAction(
            <Plus size={24} color={colors.skyBlue} />,
            'New Float Plan',
            () => navigation.navigate('CreateFloatPlan', {})
          )}
          {renderQuickAction(
            <Ship size={24} color={colors.skyBlue} />,
            'My Boats',
            () => navigation.navigate('BoatsManager')
          )}
          {renderQuickAction(
            <Users size={24} color={colors.skyBlue} />,
            'Contacts',
            () => navigation.navigate('ContactsManager')
          )}
          {renderQuickAction(
            <Package size={24} color={colors.skyBlue} />,
            'Inventory',
            () => navigation.navigate('InventoryList')
          )}
          {renderQuickAction(
            <Home size={24} color={colors.skyBlue} />,
            'Household',
            () => navigation.navigate('HouseholdManager')
          )}
          {renderQuickAction(
            <CloudSun size={24} color={colors.skyBlue} />,
            'Marine Weather',
            () => navigation.navigate('WeatherDashboard')
          )}
          {renderQuickAction(
            <Navigation2 size={24} color={colors.skyBlue} />,
            'Buoy Finder',
            () => navigation.navigate('BuoyMap')
          )}
        </View>

        {/* Active Float Plans */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Float Plans</Text>
          <TouchableOpacity onPress={() => navigation.navigate('FloatPlansList')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {activePlans.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={48} color={colors.textMuted} />
            <Text style={styles.emptyStateText}>No active float plans</Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => navigation.navigate('CreateFloatPlan', {})}
            >
              <Plus size={18} color={colors.textInverse} />
              <Text style={styles.emptyStateButtonText}>Create Float Plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          activePlans.slice(0, 3).map(renderPlanCard)
        )}

        {/* Sync Status */}
        {isSyncing && (
          <View style={styles.syncIndicator}>
            <Text style={styles.syncText}>Syncing...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.navy,
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.skyBlueLight,
  },
  logoutButton: {
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  alertCard: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  alertCardExpired: {
    backgroundColor: colors.errorLight,
    borderLeftColor: colors.error,
  },
  alertCardWarning: {
    backgroundColor: colors.warningLight,
    borderLeftColor: colors.warning,
  },
  alertContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  alertTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.error,
  },
  alertTitleWarning: {
    color: colors.warning,
  },
  alertText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  weatherCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.skyBlue,
    ...shadows.sm,
  },
  weatherCardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  weatherCardSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  seeAllText: {
    fontSize: fontSize.sm,
    color: colors.skyBlue,
    fontWeight: fontWeight.medium,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickAction: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
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
  planCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  planCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  planCardHeader: {
    flex: 1,
  },
  planCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  planCardName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  planCardDetails: {
    flex: 1,
  },
  planCardRoute: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  planCardDeadline: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  statusBadgeUrgent: {
    backgroundColor: colors.warningLight,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginLeft: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  statusBadgeTextUrgent: {
    color: colors.warning,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyStateText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.skyBlue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyStateButtonText: {
    color: colors.textInverse,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.sm,
  },
  syncIndicator: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  syncText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
})
