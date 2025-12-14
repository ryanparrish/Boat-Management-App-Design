import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface CreateFloatPlanProps {
  projectId: string
  accessToken: string
  boats: any[]  // User's saved boats
  onBack: () => void
  onSuccess: () => void
  editPlan?: any
}

export function CreateFloatPlan({ projectId, accessToken, boats, onBack, onSuccess, editPlan }: CreateFloatPlanProps) {
  // Vessel information - can be selected from boats or entered manually
  const [selectedBoatId, setSelectedBoatId] = useState('')
  const [vesselName, setVesselName] = useState(editPlan?.vesselName || '')
  const [vesselType, setVesselType] = useState(editPlan?.vesselType || '')
  
  // Route information
  const [departure, setDeparture] = useState(editPlan?.departure || '')
  const [destination, setDestination] = useState(editPlan?.destination || '')
  const [route, setRoute] = useState(editPlan?.route || '')
  
  // Check-in settings
  const [checkInDeadline, setCheckInDeadline] = useState(editPlan?.checkInDeadline ? new Date(editPlan.checkInDeadline).toISOString().slice(0, 16) : '')
  const [gracePeriod, setGracePeriod] = useState(editPlan?.gracePeriod?.toString() || '30')
  
  // Crew management
  const [crew, setCrew] = useState<string[]>(editPlan?.crew || [])
  const [crewInput, setCrewInput] = useState('')
  
  // Additional notes
  const [notes, setNotes] = useState(editPlan?.notes || '')
  
  // Loading state
  const [saving, setSaving] = useState(false)

  /**
   * Handle boat selection from dropdown
   * Auto-fills vessel name and type from selected boat
   */
  const handleBoatSelect = (boatId: string) => {
    setSelectedBoatId(boatId)
    if (boatId === 'manual') {
      // Manual entry mode
      setVesselName('')
      setVesselType('')
    } else {
      // Find selected boat and populate fields
      const boat = boats.find(b => b.id === boatId)
      if (boat) {
        setVesselName(boat.name)
        setVesselType(boat.type)
      }
    }
  }

  /**
   * Add crew member to list
   */
  const handleAddCrew = () => {
    if (crewInput.trim()) {
      setCrew([...crew, crewInput.trim()])
      setCrewInput('')
    }
  }

  /**
   * Remove crew member from list
   */
  const handleRemoveCrew = (index: number) => {
    setCrew(crew.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!vesselName || !departure || !destination || !checkInDeadline) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const planData = {
        vesselName,
        vesselType,
        departure,
        destination,
        route,
        checkInDeadline: new Date(checkInDeadline).toISOString(),
        gracePeriod: parseInt(gracePeriod),
        crew,
        notes
      }

      const url = editPlan
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/float-plans/${editPlan.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/float-plans`

      const response = await fetch(url, {
        method: editPlan ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to save float plan')
        setSaving(false)
        return
      }

      toast.success(editPlan ? 'Float plan updated!' : 'Float plan created!')
      onSuccess()
    } catch (error) {
      console.error('Error saving float plan:', error)
      toast.error('Failed to save float plan')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <div className="px-4 py-4" style={{ backgroundColor: '#0a192f' }}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-white">{editPlan ? 'Edit Float Plan' : 'Create Float Plan'}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Vessel Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Boat Selection Dropdown */}
            {boats.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="boatSelect">Select Boat</Label>
                <Select
                  value={selectedBoatId}
                  onValueChange={handleBoatSelect}
                >
                  <SelectTrigger id="boatSelect">
                    <SelectValue placeholder="Select a boat or enter manually" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    {boats.map(boat => (
                      <SelectItem key={boat.id} value={boat.id}>
                        {boat.name} ({boat.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Vessel Name Input - shown for manual entry or always if no boats */}
            <div className="space-y-2">
              <Label htmlFor="vesselName">Vessel Name *</Label>
              <Input
                id="vesselName"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder="e.g., Sea Breeze"
                disabled={selectedBoatId !== 'manual' && selectedBoatId !== '' && boats.length > 0}
              />
            </div>

            {/* Vessel Type Input - shown for manual entry or always if no boats */}
            <div className="space-y-2">
              <Label htmlFor="vesselType">Vessel Type</Label>
              <Input
                id="vesselType"
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                placeholder="e.g., Sailboat, Motorboat"
                disabled={selectedBoatId !== 'manual' && selectedBoatId !== '' && boats.length > 0}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="departure">Departure Point *</Label>
              <Input
                id="departure"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                placeholder="e.g., Marina Bay"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destination *</Label>
              <Input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Catalina Island"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="route">Planned Route</Label>
              <Textarea
                id="route"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="Describe your planned route..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Check-In Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkInDeadline">Check-In Deadline *</Label>
              <Input
                id="checkInDeadline"
                type="datetime-local"
                value={checkInDeadline}
                onChange={(e) => setCheckInDeadline(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gracePeriod">Grace Period (minutes)</Label>
              <Input
                id="gracePeriod"
                type="number"
                value={gracePeriod}
                onChange={(e) => setGracePeriod(e.target.value)}
                placeholder="30"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crew Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={crewInput}
                onChange={(e) => setCrewInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCrew()}
                placeholder="Enter crew member name"
              />
              <Button onClick={handleAddCrew} style={{ backgroundColor: '#0ea5e9' }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {crew.length > 0 && (
              <div className="space-y-2">
                {crew.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: '#f1f5f9' }}
                  >
                    <span>{member}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCrew(index)}
                      style={{ color: '#ef4444' }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information about this trip..."
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="space-y-2 pb-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {saving ? 'Saving...' : editPlan ? 'Update Float Plan' : 'Create Float Plan'}
          </Button>
          <Button
            variant="outline"
            onClick={onBack}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}