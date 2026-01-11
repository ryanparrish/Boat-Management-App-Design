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
  Switch,
} from 'react-native'
import {
  ClipboardList,
  Plus,
  Edit,
  Trash2,
  X,
  CheckCircle,
  Circle,
} from 'lucide-react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme'
import { useAppStore } from '../storage/store'
import { tasksApi } from '../services/supabase'
import { isOnline } from '../services/sync'
import type { Task } from '../types'

const SEASONS = ['All', 'Spring', 'Summer', 'Fall', 'Winter', 'Year-round']

export function SeasonalTasks() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState('All')
  const [showCompleted, setShowCompleted] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [season, setSeason] = useState('Spring')
  const [dueDate, setDueDate] = useState('')
  const [recurring, setRecurring] = useState(false)

  const { tasks, addTask, updateTask, deleteTask, addSyncOperation, user } = useAppStore((s) => ({
    tasks: s.tasks,
    addTask: s.addTask,
    updateTask: s.updateTask,
    deleteTask: s.deleteTask,
    addSyncOperation: s.addSyncOperation,
    user: s.user,
  }))

  const filteredTasks = tasks.filter((task) => {
    const matchesSeason = selectedSeason === 'All' || task.season === selectedSeason
    const matchesCompleted = showCompleted || !task.completed
    return matchesSeason && matchesCompleted
  })

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setSeason('Spring')
    setDueDate('')
    setRecurring(false)
    setEditingTask(null)
  }

  const openAddModal = () => {
    resetForm()
    setModalVisible(true)
  }

  const openEditModal = (task: Task) => {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description || '')
    setSeason(task.season)
    setDueDate(task.dueDate || '')
    setRecurring(task.recurring)
    setModalVisible(true)
  }

  const handleToggleComplete = async (task: Task) => {
    const newCompleted = !task.completed
    updateTask(task.id, { completed: newCompleted })

    const online = await isOnline()
    if (online) {
      try {
        await tasksApi.update(task.id, { completed: newCompleted })
      } catch {
        addSyncOperation({
          type: 'update',
          endpoint: `/tasks/${task.id}`,
          method: 'PUT',
          body: { completed: newCompleted },
        })
      }
    } else {
      addSyncOperation({
        type: 'update',
        endpoint: `/tasks/${task.id}`,
        method: 'PUT',
        body: { completed: newCompleted },
      })
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title')
      return
    }

    setLoading(true)

    const taskData = {
      title: title.trim(),
      description: description.trim() || undefined,
      season,
      dueDate: dueDate.trim() || undefined,
      recurring,
      completed: editingTask?.completed || false,
    }

    try {
      const online = await isOnline()

      if (editingTask) {
        updateTask(editingTask.id, taskData)

        if (online) {
          try {
            await tasksApi.update(editingTask.id, taskData)
          } catch {
            addSyncOperation({
              type: 'update',
              endpoint: `/tasks/${editingTask.id}`,
              method: 'PUT',
              body: taskData,
            })
          }
        } else {
          addSyncOperation({
            type: 'update',
            endpoint: `/tasks/${editingTask.id}`,
            method: 'PUT',
            body: taskData,
          })
        }
      } else {
        const newTask: Task = {
          ...taskData,
          id: `${user?.id}_task_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        addTask(newTask)

        if (online) {
          try {
            await tasksApi.create(taskData)
          } catch {
            addSyncOperation({
              type: 'create',
              endpoint: '/tasks',
              method: 'POST',
              body: taskData,
            })
          }
        } else {
          addSyncOperation({
            type: 'create',
            endpoint: '/tasks',
            method: 'POST',
            body: taskData,
          })
        }
      }

      setModalVisible(false)
      resetForm()
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save task')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (task: Task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          deleteTask(task.id)
          addSyncOperation({
            type: 'delete',
            endpoint: `/tasks/${task.id}`,
            method: 'DELETE',
          })
        },
      },
    ])
  }

  const getSeasonColor = (s: string) => {
    switch (s) {
      case 'Spring':
        return colors.success
      case 'Summer':
        return colors.warning
      case 'Fall':
        return '#f97316' // orange
      case 'Winter':
        return colors.info
      case 'Year-round':
        return colors.skyBlue
      default:
        return colors.textSecondary
    }
  }

  const renderItem = ({ item: task }: { item: Task }) => (
    <View style={[styles.taskCard, task.completed && styles.taskCardCompleted]}>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => handleToggleComplete(task)}
      >
        {task.completed ? (
          <CheckCircle size={24} color={colors.success} />
        ) : (
          <Circle size={24} color={colors.slate400} />
        )}
      </TouchableOpacity>
      
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}>
          {task.title}
        </Text>
        {task.description && (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {task.description}
          </Text>
        )}
        <View style={styles.taskMeta}>
          <View style={[styles.seasonBadge, { backgroundColor: `${getSeasonColor(task.season)}20` }]}>
            <Text style={[styles.seasonText, { color: getSeasonColor(task.season) }]}>
              {task.season}
            </Text>
          </View>
          {task.recurring && (
            <Text style={styles.recurringText}>🔄 Recurring</Text>
          )}
          {task.dueDate && (
            <Text style={styles.dueDateText}>📅 {task.dueDate}</Text>
          )}
        </View>
      </View>

      <View style={styles.taskActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(task)}>
          <Edit size={18} color={colors.skyBlue} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(task)}>
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Filter by Season */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {SEASONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterChip,
              selectedSeason === s && styles.filterChipActive,
            ]}
            onPress={() => setSelectedSeason(s)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedSeason === s && styles.filterChipTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Show Completed Toggle */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Show completed tasks</Text>
        <Switch
          value={showCompleted}
          onValueChange={setShowCompleted}
          trackColor={{ false: colors.slate300, true: colors.skyBlueLight }}
          thumbColor={showCompleted ? colors.skyBlue : colors.slate400}
        />
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ClipboardList size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Tasks Found</Text>
            <Text style={styles.emptyText}>
              {selectedSeason !== 'All'
                ? `No ${selectedSeason.toLowerCase()} tasks yet`
                : 'Add seasonal maintenance tasks to stay organized'}
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
                {editingTask ? 'Edit Task' : 'Add Task'}
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
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Task title"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Task details..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Season</Text>
                <View style={styles.seasonOptions}>
                  {SEASONS.filter((s) => s !== 'All').map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.seasonOption,
                        season === s && styles.seasonOptionActive,
                      ]}
                      onPress={() => setSeason(s)}
                    >
                      <Text
                        style={[
                          styles.seasonOptionText,
                          season === s && styles.seasonOptionTextActive,
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Due Date</Text>
                <TextInput
                  style={styles.input}
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchTitle}>Recurring Task</Text>
                  <Text style={styles.switchDescription}>
                    This task repeats each year
                  </Text>
                </View>
                <Switch
                  value={recurring}
                  onValueChange={setRecurring}
                  trackColor={{ false: colors.slate300, true: colors.skyBlueLight }}
                  thumbColor={recurring ? colors.skyBlue : colors.slate400}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {editingTask ? 'Update Task' : 'Add Task'}
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
  filterContainer: {
    maxHeight: 48,
  },
  filterContent: {
    padding: spacing.lg,
    paddingBottom: 0,
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
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toggleLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...shadows.sm,
  },
  taskCardCompleted: {
    opacity: 0.6,
  },
  checkButton: {
    marginRight: spacing.md,
    paddingTop: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  taskDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seasonBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  seasonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  recurringText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  dueDateText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  taskActions: {
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
  seasonOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  seasonOption: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  seasonOptionActive: {
    backgroundColor: colors.skyBlue,
  },
  seasonOptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  seasonOptionTextActive: {
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
