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
import {
  Package,
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Filter,
  Anchor,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import { inventoryApi } from '../services/supabase'
import { isOnline } from '../services/sync'
import type { InventoryItem } from '../types'

const CATEGORIES = [
  'All',
  'Safety',
  'Navigation',
  'Communication',
  'First Aid',
  'Tools',
  'Supplies',
  'Other',
]

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Replace']

export function InventoryList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedBoatId, setSelectedBoatId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Safety')
  const [quantity, setQuantity] = useState('1')
  const [expirationDate, setExpirationDate] = useState('')
  const [condition, setCondition] = useState('Good')
  const [location, setLocation] = useState('')
  const [itemBoatId, setItemBoatId] = useState<string | undefined>(undefined)

  const { inventory, boats, addInventoryItem, updateInventoryItem, deleteInventoryItem, addSyncOperation, user } = useAppStore((s) => ({
    inventory: s.inventory,
    boats: s.boats,
    addInventoryItem: s.addInventoryItem,
    updateInventoryItem: s.updateInventoryItem,
    deleteInventoryItem: s.deleteInventoryItem,
    addSyncOperation: s.addSyncOperation,
    user: s.user,
  }))

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
    const matchesBoat = selectedBoatId === null || item.boatId === selectedBoatId
    return matchesSearch && matchesCategory && matchesBoat
  })

  const resetForm = () => {
    setName('')
    setCategory('Safety')
    setQuantity('1')
    setExpirationDate('')
    setCondition('Good')
    setLocation('')
    setItemBoatId(undefined)
    setEditingItem(null)
  }

  const openAddModal = () => {
    resetForm()
    // Pre-select current boat filter if one is selected
    if (selectedBoatId) {
      setItemBoatId(selectedBoatId)
    }
    setModalVisible(true)
  }

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item)
    setName(item.name)
    setCategory(item.category)
    setQuantity(String(item.quantity))
    setExpirationDate(item.expirationDate || '')
    setCondition(item.condition || 'Good')
    setLocation(item.location || '')
    setItemBoatId(item.boatId)
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an item name')
      return
    }

    setLoading(true)

    const itemData = {
      name: name.trim(),
      category,
      quantity: parseInt(quantity) || 1,
      expirationDate: expirationDate.trim() || undefined,
      condition,
      location: location.trim() || undefined,
      boatId: itemBoatId,
    }

    try {
      const online = await isOnline()

      if (editingItem) {
        updateInventoryItem(editingItem.id, itemData)

        if (online) {
          try {
            await inventoryApi.update(editingItem.id, itemData)
          } catch {
            addSyncOperation({
              type: 'update',
              endpoint: `/inventory/${editingItem.id}`,
              method: 'PUT',
              body: itemData,
            })
          }
        } else {
          addSyncOperation({
            type: 'update',
            endpoint: `/inventory/${editingItem.id}`,
            method: 'PUT',
            body: itemData,
          })
        }
      } else {
        const newItem: InventoryItem = {
          ...itemData,
          id: `${user?.id}_inv_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        addInventoryItem(newItem)

        if (online) {
          try {
            await inventoryApi.create(itemData)
          } catch {
            addSyncOperation({
              type: 'create',
              endpoint: '/inventory',
              method: 'POST',
              body: itemData,
            })
          }
        } else {
          addSyncOperation({
            type: 'create',
            endpoint: '/inventory',
            method: 'POST',
            body: itemData,
          })
        }
      }

      setModalVisible(false)
      resetForm()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (item: InventoryItem) => {
    Alert.alert('Delete Item', `Are you sure you want to remove ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deleteInventoryItem(item.id)
          addSyncOperation({
            type: 'delete',
            endpoint: `/inventory/${item.id}`,
            method: 'DELETE',
          })
        },
      },
    ])
  }

  const getConditionColor = (cond?: string) => {
    switch (cond) {
      case 'Excellent':
        return colors.success
      case 'Good':
        return colors.skyBlue
      case 'Fair':
        return colors.warning
      case 'Poor':
      case 'Replace':
        return colors.error
      default:
        return colors.textSecondary
    }
  }

  const getBoatName = (boatId?: string) => {
    if (!boatId) return null
    const boat = boats.find(b => b.id === boatId)
    return boat?.name
  }

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const boatName = getBoatName(item.boatId)
    
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemIcon}>
          <Package size={24} color={colors.skyBlue} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityText}>×{item.quantity}</Text>
            </View>
          </View>
          <View style={styles.itemMeta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            {boatName && (
              <View style={styles.boatBadge}>
                <Anchor size={10} color={colors.skyBlue} />
                <Text style={styles.boatBadgeText}>{boatName}</Text>
              </View>
            )}
            {item.condition && (
              <Text style={[styles.conditionText, { color: getConditionColor(item.condition) }]}>
                {item.condition}
              </Text>
            )}
          </View>
          {item.location && (
            <Text style={styles.locationText}>📍 {item.location}</Text>
          )}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}>
            <Edit size={18} color={colors.skyBlue} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Search & Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search inventory..."
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterChip,
              selectedCategory === cat && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === cat && styles.filterChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Boat Filter */}
      {boats.length > 0 && (
        <View style={styles.boatFilterContainer}>
          <Anchor size={16} color={colors.textSecondary} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.boatFilterContent}
          >
            <TouchableOpacity
              style={[
                styles.boatFilterChip,
                selectedBoatId === null && styles.boatFilterChipActive,
              ]}
              onPress={() => setSelectedBoatId(null)}
            >
              <Text
                style={[
                  styles.boatFilterChipText,
                  selectedBoatId === null && styles.boatFilterChipTextActive,
                ]}
              >
                All Boats
              </Text>
            </TouchableOpacity>
            {boats.map((boat) => (
              <TouchableOpacity
                key={boat.id}
                style={[
                  styles.boatFilterChip,
                  selectedBoatId === boat.id && styles.boatFilterChipActive,
                ]}
                onPress={() => setSelectedBoatId(boat.id)}
              >
                <Text
                  style={[
                    styles.boatFilterChipText,
                    selectedBoatId === boat.id && styles.boatFilterChipTextActive,
                  ]}
                >
                  {boat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredInventory}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Items Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'All'
                ? 'Try adjusting your search or filter'
                : 'Add safety equipment and supplies to track'}
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
                {editingItem ? 'Edit Item' : 'Add Item'}
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

            <ScrollView style={styles.formScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Item name"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryOptions}>
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryOption,
                          category === cat && styles.categoryOptionActive,
                        ]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            category === cat && styles.categoryOptionTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {boats.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Assign to Boat (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.categoryOptions}>
                      <TouchableOpacity
                        style={[
                          styles.categoryOption,
                          !itemBoatId && styles.categoryOptionActive,
                        ]}
                        onPress={() => setItemBoatId(undefined)}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            !itemBoatId && styles.categoryOptionTextActive,
                          ]}
                        >
                          No Boat
                        </Text>
                      </TouchableOpacity>
                      {boats.map((boat) => (
                        <TouchableOpacity
                          key={boat.id}
                          style={[
                            styles.categoryOption,
                            itemBoatId === boat.id && styles.categoryOptionActive,
                          ]}
                          onPress={() => setItemBoatId(boat.id)}
                        >
                          <Text
                            style={[
                              styles.categoryOptionText,
                              itemBoatId === boat.id && styles.categoryOptionTextActive,
                            ]}
                          >
                            {boat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g., Cabin"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Condition</Text>
                <View style={styles.conditionOptions}>
                  {CONDITIONS.map((cond) => (
                    <TouchableOpacity
                      key={cond}
                      style={[
                        styles.conditionOption,
                        condition === cond && styles.conditionOptionActive,
                      ]}
                      onPress={() => setCondition(cond)}
                    >
                      <Text
                        style={[
                          styles.conditionOptionText,
                          condition === cond && styles.conditionOptionTextActive,
                        ]}
                      >
                        {cond}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Expiration Date</Text>
                <TextInput
                  style={styles.input}
                  value={expirationDate}
                  onChangeText={setExpirationDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {editingItem ? 'Update Item' : 'Add Item'}
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
  searchContainer: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  filterContainer: {
    maxHeight: 48,
  },
  filterContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    ...shadows.sm,
  },
  filterChipActive: {
    backgroundColor: colors.skyBlue,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
    fontWeight: fontWeight.medium,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...shadows.sm,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  itemName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  quantityBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  quantityText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryBadge: {
    backgroundColor: colors.skyBlueLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    fontSize: fontSize.xs,
    color: colors.navy,
    fontWeight: fontWeight.medium,
  },
  conditionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  locationText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  boatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.skyBlue + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  boatBadgeText: {
    fontSize: fontSize.xs,
    color: colors.skyBlue,
    fontWeight: fontWeight.medium,
  },
  boatFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  boatFilterContent: {
    gap: spacing.sm,
  },
  boatFilterChip: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  boatFilterChipActive: {
    backgroundColor: colors.skyBlue + '20',
    borderColor: colors.skyBlue,
  },
  boatFilterChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  boatFilterChipTextActive: {
    color: colors.skyBlue,
    fontWeight: fontWeight.medium,
  },
  itemActions: {
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
  row: {
    flexDirection: 'row',
  },
  categoryOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryOption: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  categoryOptionActive: {
    backgroundColor: colors.skyBlue,
  },
  categoryOptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  categoryOptionTextActive: {
    color: colors.textInverse,
  },
  conditionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  conditionOption: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  conditionOptionActive: {
    backgroundColor: colors.skyBlue,
  },
  conditionOptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  conditionOptionTextActive: {
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
