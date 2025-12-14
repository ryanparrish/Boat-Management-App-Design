import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Checkbox } from './ui/checkbox'
import { ArrowLeft, Plus, Wrench, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface Task {
  id: string
  title: string
  description?: string
  season: string
  dueDate?: string
  completed: boolean
  recurring: boolean
}

interface SeasonalTasksProps {
  tasks: Task[]
  projectId: string
  accessToken: string
  onBack: () => void
  onRefresh: () => void
}

export function SeasonalTasks({ tasks, projectId, accessToken, onBack, onRefresh }: SeasonalTasksProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [season, setSeason] = useState('spring')
  const [dueDate, setDueDate] = useState('')
  const [recurring, setRecurring] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterSeason, setFilterSeason] = useState('all')

  const seasons = ['spring', 'summer', 'fall', 'winter']

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setSeason('spring')
    setDueDate('')
    setRecurring(true)
    setEditingTask(null)
    setShowForm(false)
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description || '')
    setSeason(task.season)
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
    setRecurring(task.recurring)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!title) {
      toast.error('Please enter task title')
      return
    }

    setSaving(true)
    try {
      const taskData = {
        title,
        description,
        season,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        recurring,
        completed: editingTask?.completed || false
      }

      const url = editingTask
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/tasks/${editingTask.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/tasks`

      const response = await fetch(url, {
        method: editingTask ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      })

      if (!response.ok) {
        toast.error('Failed to save task')
        setSaving(false)
        return
      }

      toast.success(editingTask ? 'Task updated!' : 'Task added!')
      resetForm()
      onRefresh()
    } catch (error) {
      console.error('Error saving task:', error)
      toast.error('Failed to save task')
    }
    setSaving(false)
  }

  const handleToggleComplete = async (task: Task) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/tasks/${task.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ...task, completed: !task.completed })
        }
      )

      if (!response.ok) {
        toast.error('Failed to update task')
        return
      }

      onRefresh()
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    }
  }

  const handleDelete = async (taskId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/tasks/${taskId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        toast.error('Failed to delete task')
        return
      }

      toast.success('Task deleted')
      onRefresh()
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const filteredTasks = filterSeason === 'all'
    ? tasks
    : tasks.filter(task => task.season === filterSeason)

  const getSeasonColor = (seasonName: string) => {
    const colors: Record<string, string> = {
      spring: '#10b981',
      summer: '#f59e0b',
      fall: '#ef4444',
      winter: '#0ea5e9'
    }
    return colors[seasonName] || colors.spring
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <div className="px-4 py-4" style={{ backgroundColor: '#0a192f' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-white">Seasonal Tasks</h1>
          </div>
          {!showForm && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              style={{ backgroundColor: '#0ea5e9' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingTask ? 'Edit Task' : 'Add Task'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Check engine oil"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="season">Season</Label>
                <Select value={season} onValueChange={setSeason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map(s => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={recurring}
                  onCheckedChange={(checked) => setRecurring(checked as boolean)}
                />
                <Label htmlFor="recurring" className="cursor-pointer">
                  Recurring annually
                </Label>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1"
                  style={{ backgroundColor: '#0ea5e9' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Season Filter */}
        {!showForm && tasks.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Label className="text-sm" style={{ color: '#64748b' }}>Filter by Season</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button
                  size="sm"
                  variant={filterSeason === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterSeason('all')}
                  style={filterSeason === 'all' ? { backgroundColor: '#0ea5e9' } : {}}
                >
                  All
                </Button>
                {seasons.map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={filterSeason === s ? 'default' : 'outline'}
                    onClick={() => setFilterSeason(s)}
                    style={filterSeason === s ? { backgroundColor: getSeasonColor(s) } : {}}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tasks.length === 0 && !showForm ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f3e8ff' }}>
                <Wrench className="w-8 h-8" style={{ color: '#a855f7' }} />
              </div>
              <div>
                <p style={{ color: '#64748b' }}>No seasonal tasks yet</p>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Add maintenance tasks to track throughout the year</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <Card key={task.id} style={{ opacity: task.completed ? 0.6 : 1 }}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleComplete(task)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h3 style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                          {task.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap items-center">
                        <div
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: getSeasonColor(task.season), color: 'white' }}
                        >
                          {task.season.charAt(0).toUpperCase() + task.season.slice(1)}
                        </div>
                        {task.recurring && (
                          <div className="px-2 py-1 rounded text-xs" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            Recurring
                          </div>
                        )}
                        {task.dueDate && (
                          <span className="text-xs" style={{ color: '#64748b' }}>
                            Due: {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(task)}
                        style={{ color: '#0ea5e9' }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(task.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
