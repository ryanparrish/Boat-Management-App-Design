import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { ArrowLeft, Plus, Mail, Phone, Edit, Trash2, User } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  method: string
  permission: string
}

interface ContactsManagerProps {
  contacts: Contact[]
  projectId: string
  accessToken: string
  onBack: () => void
  onRefresh: () => void
}

export function ContactsManager({ contacts, projectId, accessToken, onBack, onRefresh }: ContactsManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState('email')
  const [permission, setPermission] = useState('view')
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setMethod('email')
    setPermission('view')
    setEditingContact(null)
    setShowForm(false)
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setName(contact.name)
    setEmail(contact.email || '')
    setPhone(contact.phone || '')
    setMethod(contact.method)
    setPermission(contact.permission)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name || (method === 'email' && !email) || (method === 'sms' && !phone)) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const contactData = {
        name,
        email: method === 'email' ? email : undefined,
        phone: method === 'sms' ? phone : undefined,
        method,
        permission
      }

      const url = editingContact
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/contacts/${editingContact.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/contacts`

      const response = await fetch(url, {
        method: editingContact ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactData)
      })

      if (!response.ok) {
        toast.error('Failed to save contact')
        setSaving(false)
        return
      }

      toast.success(editingContact ? 'Contact updated!' : 'Contact added!')
      resetForm()
      onRefresh()
    } catch (error) {
      console.error('Error saving contact:', error)
      toast.error('Failed to save contact')
    }
    setSaving(false)
  }

  const handleDelete = async (contactId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/contacts/${contactId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        toast.error('Failed to delete contact')
        return
      }

      toast.success('Contact deleted')
      onRefresh()
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast.error('Failed to delete contact')
    }
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
            <h1 className="text-white">Emergency Contacts</h1>
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
              <CardTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Notification Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="both">Email & SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(method === 'email' || method === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              )}

              {(method === 'sms' || method === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="permission">Permission Level</Label>
                <Select value={permission} onValueChange={setPermission}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View Only</SelectItem>
                    <SelectItem value="emergency">Emergency Only</SelectItem>
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

        {contacts.length === 0 && !showForm ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef3c7' }}>
                <User className="w-8 h-8" style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <p style={{ color: '#64748b' }}>No emergency contacts yet</p>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Add contacts who should be notified if you miss a check-in</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#e0f2fe' }}>
                        <User className="w-5 h-5" style={{ color: '#0ea5e9' }} />
                      </div>
                      <div className="flex-1">
                        <h3>{contact.name}</h3>
                        <div className="space-y-1 mt-2">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
                              <Mail className="w-4 h-4" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm" style={{ color: '#64748b' }}>
                              <Phone className="w-4 h-4" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(contact)}
                        style={{ color: '#0ea5e9' }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(contact.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 rounded text-xs" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
                      {contact.method}
                    </div>
                    <div className="px-2 py-1 rounded text-xs" style={{ backgroundColor: '#fef3c7', color: '#f59e0b' }}>
                      {contact.permission}
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
