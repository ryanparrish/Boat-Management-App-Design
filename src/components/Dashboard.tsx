import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Anchor, MapPin, Package, Wrench, Bell, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

interface FloatPlan {
  id: string
  vesselName: string
  status: string
  checkInDeadline?: string
  lastCheckIn?: string
  destination?: string
}

interface InventoryItem {
  id: string
  name: string
  expirationDate?: string
  condition?: string
}

interface Task {
  id: string
  title: string
  season: string
  completed: boolean
  dueDate?: string
}

interface DashboardProps {
  floatPlans: FloatPlan[]
  inventory: InventoryItem[]
  tasks: Task[]
  boats: any[]
  onNavigate: (view: string) => void
  onSelectFloatPlan: (id: string) => void
  onLogout: () => void
}

export function Dashboard({ floatPlans, inventory, tasks, boats, onNavigate, onSelectFloatPlan, onLogout }: DashboardProps) {
  // Get active float plan
  const activeFloatPlan = floatPlans.find(fp => fp.status === 'active' || fp.status === 'pending')
  
  // Check for overdue float plans
  const isOverdue = activeFloatPlan?.checkInDeadline && new Date(activeFloatPlan.checkInDeadline) < new Date()
  
  // Get upcoming tasks (next 3)
  const upcomingTasks = tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    .slice(0, 3)
  
  // Check for expired inventory
  const expiredItems = inventory.filter(item => {
    if (!item.expirationDate) return false
    return new Date(item.expirationDate) < new Date()
  })

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      draft: { label: 'Draft', color: '#94a3b8', icon: Clock },
      pending: { label: 'Pending', color: '#f59e0b', icon: AlertCircle },
      active: { label: 'Active', color: '#0ea5e9', icon: MapPin },
      checked_in: { label: 'Checked In', color: '#10b981', icon: CheckCircle2 },
      overdue: { label: 'Overdue', color: '#ef4444', icon: AlertCircle }
    }
    
    const effectiveStatus = isOverdue && status === 'active' ? 'overdue' : status
    const config = statusConfig[effectiveStatus] || statusConfig.draft
    const Icon = config.icon
    
    return (
      <Badge className="flex items-center gap-1" style={{ backgroundColor: config.color }}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <div className="px-4 py-6" style={{ backgroundColor: '#0a192f' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0ea5e9' }}>
              <Anchor className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white">Float Plan</h1>
              <p className="text-xs" style={{ color: '#94a3b8' }}>Safety Manager</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-white"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Current Float Plan Status */}
        <Card style={{ borderColor: isOverdue ? '#ef4444' : '#e2e8f0' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Current Float Plan</span>
              {activeFloatPlan && getStatusBadge(activeFloatPlan.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeFloatPlan ? (
              <>
                <div>
                  <p className="text-sm" style={{ color: '#64748b' }}>Vessel</p>
                  <p>{activeFloatPlan.vesselName}</p>
                </div>
                
                {activeFloatPlan.destination && (
                  <div>
                    <p className="text-sm" style={{ color: '#64748b' }}>Destination</p>
                    <p>{activeFloatPlan.destination}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm" style={{ color: '#64748b' }}>Next Check-In</p>
                  <p className={isOverdue ? '' : ''} style={isOverdue ? { color: '#ef4444' } : {}}>
                    {formatTime(activeFloatPlan.checkInDeadline)}
                  </p>
                </div>
                
                {activeFloatPlan.lastCheckIn && (
                  <div>
                    <p className="text-sm" style={{ color: '#64748b' }}>Last Check-In</p>
                    <p style={{ color: '#10b981' }}>{formatTime(activeFloatPlan.lastCheckIn)}</p>
                  </div>
                )}
                
                <Button
                  className="w-full mt-2"
                  onClick={() => onSelectFloatPlan(activeFloatPlan.id)}
                  style={{ backgroundColor: '#0ea5e9' }}
                >
                  View Details
                </Button>
              </>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p style={{ color: '#64748b' }}>No active float plan</p>
                <Button
                  onClick={() => onNavigate('create-float-plan')}
                  style={{ backgroundColor: '#0ea5e9' }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Float Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate('boats')}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e0f2fe' }}>
                <Anchor className="w-6 h-6" style={{ color: '#0ea5e9' }} />
              </div>
              <p>My Boats</p>
              <p className="text-xs" style={{ color: '#64748b' }}>{boats.length} vessels</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate('float-plans')}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e0f2fe' }}>
                <MapPin className="w-6 h-6" style={{ color: '#0ea5e9' }} />
              </div>
              <p>Float Plans</p>
              <p className="text-xs" style={{ color: '#64748b' }}>{floatPlans.length} total</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate('contacts')}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef3c7' }}>
                <Bell className="w-6 h-6" style={{ color: '#f59e0b' }} />
              </div>
              <p>Contacts</p>
              <p className="text-xs" style={{ color: '#64748b' }}>Emergency</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate('inventory')}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: expiredItems.length > 0 ? '#fee2e2' : '#dcfce7' }}>
                <Package className="w-6 h-6" style={{ color: expiredItems.length > 0 ? '#ef4444' : '#10b981' }} />
              </div>
              <p>Inventory</p>
              <p className="text-xs" style={{ color: expiredItems.length > 0 ? '#ef4444' : '#64748b' }}>
                {expiredItems.length > 0 ? `${expiredItems.length} expired` : `${inventory.length} items`}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow col-span-2"
            onClick={() => onNavigate('tasks')}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f3e8ff' }}>
                <Wrench className="w-6 h-6" style={{ color: '#a855f7' }} />
              </div>
              <p>Tasks</p>
              <p className="text-xs" style={{ color: '#64748b' }}>{upcomingTasks.length} upcoming</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Seasonal Tasks */}
        {upcomingTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Upcoming Maintenance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#e2e8f0' }}>
                  <div className="flex-1">
                    <p>{task.title}</p>
                    <p className="text-sm" style={{ color: '#64748b' }}>{task.season}</p>
                  </div>
                  {task.dueDate && (
                    <p className="text-sm" style={{ color: '#64748b' }}>
                      {formatTime(task.dueDate)}
                    </p>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => onNavigate('tasks')}
              >
                View All Tasks
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Inventory Alerts */}
        {expiredItems.length > 0 && (
          <Card style={{ borderColor: '#ef4444' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
                Inventory Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#64748b' }}>
                {expiredItems.length} {expiredItems.length === 1 ? 'item has' : 'items have'} expired
              </p>
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => onNavigate('inventory')}
                style={{ borderColor: '#ef4444', color: '#ef4444' }}
              >
                Review Inventory
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}