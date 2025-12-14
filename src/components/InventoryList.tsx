import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { ArrowLeft, Plus, Package, Edit, Trash2, AlertCircle, MapPin } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  expirationDate?: string
  condition: string
  location?: string
}

interface InventoryListProps {
  inventory: InventoryItem[]
  projectId: string
  accessToken: string
  onBack: () => void
  onRefresh: () => void
}

export function InventoryList({ inventory, projectId, accessToken, onBack, onRefresh }: InventoryListProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('safety')
  const [quantity, setQuantity] = useState('1')
  const [expirationDate, setExpirationDate] = useState('')
  const [condition, setCondition] = useState('good')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterLocation, setFilterLocation] = useState('all')

  const categories = ['safety', 'food', 'medical', 'tools', 'spare_parts', 'other']

  const locations = [
    'cockpit',
    'engine_room',
    'v_berth',
    'aft_cabin',
    'galley',
    'nav_station',
    'port_locker',
    'starboard_locker',
    'deck_box',
    'other'
  ]

  const resetForm = () => {
    setName('')
    setCategory('safety')
    setQuantity('1')
    setExpirationDate('')
    setCondition('good')
    setLocation('')
    setEditingItem(null)
    setShowForm(false)
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setName(item.name)
    setCategory(item.category)
    setQuantity(item.quantity.toString())
    setExpirationDate(item.expirationDate ? new Date(item.expirationDate).toISOString().split('T')[0] : '')
    setCondition(item.condition)
    setLocation(item.location || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name) {
      toast.error('Please enter item name')
      return
    }

    setSaving(true)
    try {
      const itemData = {
        name,
        category,
        quantity: parseInt(quantity),
        expirationDate: expirationDate ? new Date(expirationDate).toISOString() : undefined,
        condition,
        location: location || undefined
      }

      const url = editingItem
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/inventory/${editingItem.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/inventory`

      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
      })

      if (!response.ok) {
        toast.error('Failed to save item')
        setSaving(false)
        return
      }

      toast.success(editingItem ? 'Item updated!' : 'Item added!')
      resetForm()
      onRefresh()
    } catch (error) {
      console.error('Error saving item:', error)
      toast.error('Failed to save item')
    }
    setSaving(false)
  }

  const handleDelete = async (itemId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/inventory/${itemId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        toast.error('Failed to delete item')
        return
      }

      toast.success('Item deleted')
      onRefresh()
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }

  const isExpired = (expirationDate?: string) => {
    if (!expirationDate) return false
    return new Date(expirationDate) < new Date()
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No expiration'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const filteredInventory = inventory.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false
    if (filterLocation !== 'all' && item.location !== filterLocation) return false
    return true
  })

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      safety: '#ef4444',
      food: '#10b981',
      medical: '#f59e0b',
      tools: '#0ea5e9',
      spare_parts: '#a855f7',
      other: '#64748b'
    }
    return colors[cat] || colors.other
  }

  const getConditionColor = (cond: string) => {
    const colors: Record<string, string> = {
      excellent: '#10b981',
      good: '#0ea5e9',
      fair: '#f59e0b',
      poor: '#ef4444'
    }
    return colors[cond] || colors.good
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
            <h1 className="text-white">Inventory</h1>
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
              <CardTitle>{editingItem ? 'Edit Item' : 'Add Item'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Life Jacket"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expirationDate">Expiration Date (optional)</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc} value={loc}>
                        {loc.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        {/* Category Filter */}
        {!showForm && inventory.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Label className="text-sm" style={{ color: '#64748b' }}>Filter by Category</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button
                  size="sm"
                  variant={filterCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterCategory('all')}
                  style={filterCategory === 'all' ? { backgroundColor: '#0ea5e9' } : {}}
                >
                  All
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={filterCategory === cat ? 'default' : 'outline'}
                    onClick={() => setFilterCategory(cat)}
                    style={filterCategory === cat ? { backgroundColor: getCategoryColor(cat) } : {}}
                  >
                    {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location Filter */}
        {!showForm && inventory.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Label className="text-sm" style={{ color: '#64748b' }}>Filter by Location</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button
                  size="sm"
                  variant={filterLocation === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterLocation('all')}
                  style={filterLocation === 'all' ? { backgroundColor: '#0ea5e9' } : {}}
                >
                  All
                </Button>
                {locations.map(loc => (
                  <Button
                    key={loc}
                    size="sm"
                    variant={filterLocation === loc ? 'default' : 'outline'}
                    onClick={() => setFilterLocation(loc)}
                    style={filterLocation === loc ? { backgroundColor: '#0ea5e9' } : {}}
                  >
                    {loc.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {inventory.length === 0 && !showForm ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dcfce7' }}>
                <Package className="w-8 h-8" style={{ color: '#10b981' }} />
              </div>
              <div>
                <p style={{ color: '#64748b' }}>No inventory items yet</p>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Track safety equipment, supplies, and maintenance items</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredInventory.map((item) => (
              <Card key={item.id} style={{ borderColor: isExpired(item.expirationDate) ? '#ef4444' : '#e2e8f0' }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3>{item.name}</h3>
                        {isExpired(item.expirationDate) && (
                          <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
                        )}
                      </div>
                      <div className="flex gap-2 mb-2">
                        <Badge style={{ backgroundColor: getCategoryColor(item.category) }}>
                          {item.category.replace('_', ' ')}
                        </Badge>
                        <Badge style={{ backgroundColor: getConditionColor(item.condition) }}>
                          {item.condition}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm" style={{ color: '#64748b' }}>
                          Quantity: {item.quantity}
                        </p>
                        <p
                          className="text-sm"
                          style={{ color: isExpired(item.expirationDate) ? '#ef4444' : '#64748b' }}
                        >
                          {isExpired(item.expirationDate) ? 'Expired: ' : 'Expires: '}
                          {formatDate(item.expirationDate)}
                        </p>
                        {item.location && (
                          <p className="text-sm flex items-center gap-1" style={{ color: '#64748b' }}>
                            <MapPin className="w-3 h-3" /> {item.location.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                        style={{ color: '#0ea5e9' }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
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