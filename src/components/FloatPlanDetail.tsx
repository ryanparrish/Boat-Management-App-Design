import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ArrowLeft, MapPin, Users, FileText, Clock, CheckCircle2, AlertCircle, Edit } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface FloatPlanDetailProps {
  planId: string
  projectId: string
  accessToken: string
  onBack: () => void
  onEdit: (planId: string) => void
  onRefresh: () => void
}

export function FloatPlanDetail({ planId, projectId, accessToken, onBack, onEdit, onRefresh }: FloatPlanDetailProps) {
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
    loadPlan()
  }, [planId])

  const loadPlan = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/float-plans/${planId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        toast.error('Failed to load float plan')
        onBack()
        return
      }

      const data = await response.json()
      setPlan(data)
    } catch (error) {
      console.error('Error loading float plan:', error)
      toast.error('Failed to load float plan')
    }
    setLoading(false)
  }

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/check-in/${planId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        toast.error('Failed to check in')
        setCheckingIn(false)
        return
      }

      toast.success('Successfully checked in!')
      await loadPlan()
      onRefresh()
    } catch (error) {
      console.error('Error checking in:', error)
      toast.error('Failed to check in')
    }
    setCheckingIn(false)
  }

  const handleActivate = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/float-plans/${planId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'active' })
        }
      )

      if (!response.ok) {
        toast.error('Failed to activate float plan')
        return
      }

      toast.success('Float plan activated!')
      await loadPlan()
      onRefresh()
    } catch (error) {
      console.error('Error activating float plan:', error)
      toast.error('Failed to activate float plan')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f1f5f9' }}>
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
    )
  }

  if (!plan) return null

  const isOverdue = plan.checkInDeadline && new Date(plan.checkInDeadline) < new Date() && plan.status === 'active'
  
  const getStatusBadge = (status: string) => {
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

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <div className="px-4 py-4" style={{ backgroundColor: '#0a192f' }}>
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-white flex-1">Float Plan</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(planId)}
            className="text-white"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card style={{ borderColor: isOverdue ? '#ef4444' : '#e2e8f0' }}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2>{plan.vesselName}</h2>
              {getStatusBadge(plan.status)}
            </div>

            {plan.status === 'draft' && (
              <Button
                onClick={handleActivate}
                className="w-full"
                style={{ backgroundColor: '#0ea5e9' }}
              >
                Activate Float Plan
              </Button>
            )}

            {(plan.status === 'active' || isOverdue) && (
              <Button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full"
                style={{ backgroundColor: '#10b981' }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {checkingIn ? 'Checking In...' : 'Check In Now'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Vessel Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" style={{ color: '#0ea5e9' }} />
              Vessel & Route
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm" style={{ color: '#64748b' }}>Vessel Name</p>
              <p>{plan.vesselName}</p>
            </div>
            
            {plan.vesselType && (
              <div>
                <p className="text-sm" style={{ color: '#64748b' }}>Vessel Type</p>
                <p>{plan.vesselType}</p>
              </div>
            )}
            
            {plan.departure && (
              <div>
                <p className="text-sm" style={{ color: '#64748b' }}>Departure</p>
                <p>{plan.departure}</p>
              </div>
            )}
            
            {plan.destination && (
              <div>
                <p className="text-sm" style={{ color: '#64748b' }}>Destination</p>
                <p>{plan.destination}</p>
              </div>
            )}
            
            {plan.route && (
              <div>
                <p className="text-sm" style={{ color: '#64748b' }}>Route</p>
                <p>{plan.route}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-In Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: '#f59e0b' }} />
              Check-In Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm" style={{ color: '#64748b' }}>Next Check-In Deadline</p>
              <p className={isOverdue ? '' : ''} style={isOverdue ? { color: '#ef4444' } : {}}>
                {formatTime(plan.checkInDeadline)}
              </p>
            </div>
            
            {plan.gracePeriod && (
              <div>
                <p className="text-sm" style={{ color: '#64748b' }}>Grace Period</p>
                <p>{plan.gracePeriod} minutes</p>
              </div>
            )}
            
            {plan.lastCheckIn && (
              <div>
                <p className="text-sm" style={{ color: '#64748b' }}>Last Check-In</p>
                <p style={{ color: '#10b981' }}>{formatTime(plan.lastCheckIn)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crew List */}
        {plan.crew && plan.crew.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: '#0ea5e9' }} />
                Crew ({plan.crew.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.crew.map((member: string, index: number) => (
                <div key={index} className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: '#e2e8f0' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e0f2fe' }}>
                    <Users className="w-4 h-4" style={{ color: '#0ea5e9' }} />
                  </div>
                  <p>{member}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {plan.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: '#64748b' }} />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#475569' }}>{plan.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Escalation Preview */}
        <Card style={{ backgroundColor: '#fef3c7', borderColor: '#f59e0b' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" style={{ color: '#f59e0b' }} />
              Safety Protocol
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">If check-in is missed, the following will occur:</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f59e0b' }}>
                  <span className="text-white text-xs">1</span>
                </div>
                <p>Grace period of {plan.gracePeriod || 30} minutes begins</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f59e0b' }}>
                  <span className="text-white text-xs">2</span>
                </div>
                <p>Emergency contacts are notified via email/SMS</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f59e0b' }}>
                  <span className="text-white text-xs">3</span>
                </div>
                <p>Float plan details are shared with designated contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
