/**
 * BoatsManager Component
 * 
 * Manages the user's fleet of boats/vessels. Users can add, edit, and delete boats
 * which can then be selected when creating float plans.
 * 
 * Features:
 * - Add new boats with detailed information (name, type, registration, etc.)
 * - Edit existing boat details
 * - Delete boats from the fleet
 * - Responsive design (mobile-first, scales to desktop)
 * - Form validation for required fields
 * 
 * @component
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { ArrowLeft, Plus, Anchor, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

/**
 * Boat data structure
 */
interface Boat {
  id: string
  name: string
  type: string
  length?: string
  registration?: string
  homePort?: string
  color?: string
  notes?: string
  createdAt: string
  updatedAt?: string
}

interface BoatsManagerProps {
  boats: Boat[]
  projectId: string
  accessToken: string
  onBack: () => void
  onRefresh: () => void
}

/**
 * Common boat types for quick selection
 */
const BOAT_TYPES = [
  'Sailboat',
  'Motorboat',
  'Yacht',
  'Catamaran',
  'Fishing Boat',
  'Jet Ski',
  'Kayak',
  'Other'
]

export function BoatsManager({ boats, projectId, accessToken, onBack, onRefresh }: BoatsManagerProps) {
  // Form visibility state
  const [showForm, setShowForm] = useState(false)
  
  // Editing state - holds boat being edited or null for new boat
  const [editingBoat, setEditingBoat] = useState<Boat | null>(null)
  
  // Form fields
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [length, setLength] = useState('')
  const [registration, setRegistration] = useState('')
  const [homePort, setHomePort] = useState('')
  const [color, setColor] = useState('')
  const [notes, setNotes] = useState('')
  
  // Loading state for async operations
  const [saving, setSaving] = useState(false)

  /**
   * Reset form to initial empty state
   */
  const resetForm = () => {
    setName('')
    setType('')
    setLength('')
    setRegistration('')
    setHomePort('')
    setColor('')
    setNotes('')
    setEditingBoat(null)
    setShowForm(false)
  }

  /**
   * Populate form with boat data for editing
   * @param boat - The boat to edit
   */
  const handleEdit = (boat: Boat) => {
    setEditingBoat(boat)
    setName(boat.name)
    setType(boat.type)
    setLength(boat.length || '')
    setRegistration(boat.registration || '')
    setHomePort(boat.homePort || '')
    setColor(boat.color || '')
    setNotes(boat.notes || '')
    setShowForm(true)
  }

  /**
   * Save boat (create new or update existing)
   * Validates required fields and makes API call
   */
  const handleSave = async () => {
    // Validation: name and type are required
    if (!name || !type) {
      toast.error('Please enter boat name and type')
      return
    }

    setSaving(true)
    try {
      // Prepare boat data
      const boatData = {
        name,
        type,
        length: length || undefined,
        registration: registration || undefined,
        homePort: homePort || undefined,
        color: color || undefined,
        notes: notes || undefined
      }

      // Determine API endpoint and method
      const url = editingBoat
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/boats/${editingBoat.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/boats`

      const response = await fetch(url, {
        method: editingBoat ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(boatData)
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Failed to save boat')
        setSaving(false)
        return
      }

      // Success - show message and refresh data
      toast.success(editingBoat ? 'Boat updated!' : 'Boat added!')
      resetForm()
      onRefresh()
    } catch (error) {
      console.error('Error saving boat:', error)
      toast.error('Failed to save boat')
    }
    setSaving(false)
  }

  /**
   * Delete boat from fleet
   * @param boatId - ID of boat to delete
   */
  const handleDelete = async (boatId: string) => {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this boat?')) {
      return
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/boats/${boatId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        toast.error('Failed to delete boat')
        return
      }

      toast.success('Boat deleted')
      onRefresh()
    } catch (error) {
      console.error('Error deleting boat:', error)
      toast.error('Failed to delete boat')
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header - Fixed navigation bar */}
      <div className="px-4 py-4" style={{ backgroundColor: '#0a192f' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white p-2"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-white">My Boats</h1>
          </div>
          {!showForm && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              style={{ backgroundColor: '#0ea5e9' }}
              aria-label="Add new boat"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - Scrollable area */}
      <div className="p-4 space-y-4">
        {/* Add/Edit Boat Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingBoat ? 'Edit Boat' : 'Add Boat'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Boat Name - Required */}
              <div className="space-y-2">
                <Label htmlFor="name">Boat Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sea Breeze"
                  required
                />
              </div>

              {/* Boat Type - Required */}
              <div className="space-y-2">
                <Label htmlFor="type">Boat Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOAT_TYPES.map(boatType => (
                      <SelectItem key={boatType} value={boatType}>
                        {boatType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Length - Optional */}
              <div className="space-y-2">
                <Label htmlFor="length">Length</Label>
                <Input
                  id="length"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="e.g., 35 ft"
                />
              </div>

              {/* Registration Number - Optional */}
              <div className="space-y-2">
                <Label htmlFor="registration">Registration Number</Label>
                <Input
                  id="registration"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value)}
                  placeholder="e.g., CA-1234-AB"
                />
              </div>

              {/* Home Port - Optional */}
              <div className="space-y-2">
                <Label htmlFor="homePort">Home Port</Label>
                <Input
                  id="homePort"
                  value={homePort}
                  onChange={(e) => setHomePort(e.target.value)}
                  placeholder="e.g., San Diego Marina"
                />
              </div>

              {/* Color - Optional */}
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g., White with blue trim"
                />
              </div>

              {/* Notes - Optional */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional information..."
                  rows={3}
                />
              </div>

              {/* Form Actions */}
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
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - Show when no boats exist */}
        {boats.length === 0 && !showForm ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e0f2fe' }}>
                <Anchor className="w-8 h-8" style={{ color: '#0ea5e9' }} />
              </div>
              <div>
                <p style={{ color: '#64748b' }}>No boats yet</p>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                  Add your boats to quickly create float plans
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Boats List - Display all boats
          <div className="space-y-3">
            {boats.map((boat) => (
              <Card key={boat.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Boat Icon */}
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" 
                      style={{ backgroundColor: '#e0f2fe' }}
                    >
                      <Anchor className="w-6 h-6" style={{ color: '#0ea5e9' }} />
                    </div>
                    
                    {/* Boat Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="truncate">{boat.name}</h3>
                          <p className="text-sm" style={{ color: '#64748b' }}>{boat.type}</p>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(boat)}
                            style={{ color: '#0ea5e9' }}
                            aria-label={`Edit ${boat.name}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(boat.id)}
                            style={{ color: '#ef4444' }}
                            aria-label={`Delete ${boat.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Additional Info Grid */}
                      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                        {boat.length && (
                          <div>
                            <span style={{ color: '#94a3b8' }}>Length:</span>
                            <p style={{ color: '#475569' }}>{boat.length}</p>
                          </div>
                        )}
                        {boat.registration && (
                          <div>
                            <span style={{ color: '#94a3b8' }}>Reg:</span>
                            <p style={{ color: '#475569' }} className="truncate">{boat.registration}</p>
                          </div>
                        )}
                        {boat.homePort && (
                          <div className="col-span-2">
                            <span style={{ color: '#94a3b8' }}>Home Port:</span>
                            <p style={{ color: '#475569' }} className="truncate">{boat.homePort}</p>
                          </div>
                        )}
                        {boat.color && (
                          <div className="col-span-2">
                            <span style={{ color: '#94a3b8' }}>Color:</span>
                            <p style={{ color: '#475569' }}>{boat.color}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Notes */}
                      {boat.notes && (
                        <div className="mt-3 p-2 rounded" style={{ backgroundColor: '#f8fafc' }}>
                          <p className="text-sm" style={{ color: '#64748b' }}>{boat.notes}</p>
                        </div>
                      )}
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
