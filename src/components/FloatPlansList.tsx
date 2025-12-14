import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ArrowLeft, Plus, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

interface FloatPlan {
  id: string
  vesselName: string
  status: string
  destination?: string
  checkInDeadline?: string
  departure?: string
}

interface FloatPlansListProps {
  floatPlans: FloatPlan[]
  onBack: () => void
  onCreate: () => void
  onSelect: (id: string) => void
}

export function FloatPlansList({ floatPlans, onBack, onCreate, onSelect }: FloatPlansListProps) {
  const getStatusBadge = (status: string, checkInDeadline?: string) => {
    const isOverdue = checkInDeadline && new Date(checkInDeadline) < new Date() && status === 'active'
    
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      draft: { label: 'Draft', color: '#94a3b8', icon: Clock },
      pending: { label: 'Pending', color: '#f59e0b', icon: AlertCircle },
      active: { label: 'Active', color: '#0ea5e9', icon: MapPin },
      checked_in: { label: 'Checked In', color: '#10b981', icon: CheckCircle2 },
      overdue: { label: 'Overdue', color: '#ef4444', icon: AlertCircle }
    }
    
    const effectiveStatus = isOverdue ? 'overdue' : status
    const config = statusConfig[effectiveStatus] || statusConfig.draft
    const Icon = config.icon
    
    return (
      <Badge className="flex items-center gap-1" style={{ backgroundColor: config.color }}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
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
            <h1 className="text-white">Float Plans</h1>
          </div>
          <Button
            size="sm"
            onClick={onCreate}
            style={{ backgroundColor: '#0ea5e9' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {floatPlans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e0f2fe' }}>
                <MapPin className="w-8 h-8" style={{ color: '#0ea5e9' }} />
              </div>
              <div>
                <p style={{ color: '#64748b' }}>No float plans yet</p>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Create your first float plan to get started</p>
              </div>
              <Button onClick={onCreate} style={{ backgroundColor: '#0ea5e9' }}>
                <Plus className="w-4 h-4 mr-2" />
                Create Float Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          floatPlans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelect(plan.id)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3>{plan.vesselName}</h3>
                    {plan.destination && (
                      <p className="text-sm" style={{ color: '#64748b' }}>
                        {plan.departure && `${plan.departure} → `}{plan.destination}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(plan.status, plan.checkInDeadline)}
                </div>

                {plan.checkInDeadline && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
                    <Clock className="w-4 h-4" />
                    <span>Check-in: {formatDate(plan.checkInDeadline)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
