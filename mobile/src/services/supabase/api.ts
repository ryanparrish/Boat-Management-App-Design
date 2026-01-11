import { functionsUrl } from './config'
import { getAccessToken } from './client'
import type { FloatPlan, Boat, Contact, InventoryItem, Task, Household, HouseholdMember, HouseholdInvite } from '../../types'

// Base API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()
  
  const response = await fetch(`${functionsUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// Auth API
export const authApi = {
  signup: async (email: string, password: string) => {
    return apiRequest<{ user: { id: string; email: string }; token: string }>('/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },
}

// Float Plans API
export const floatPlansApi = {
  getAll: async (): Promise<FloatPlan[]> => {
    return apiRequest<FloatPlan[]>('/float-plans')
  },

  getById: async (id: string): Promise<FloatPlan> => {
    return apiRequest<FloatPlan>(`/float-plans/${id}`)
  },

  create: async (plan: Omit<FloatPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<FloatPlan> => {
    return apiRequest<FloatPlan>('/float-plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
  },

  update: async (id: string, updates: Partial<FloatPlan>): Promise<FloatPlan> => {
    return apiRequest<FloatPlan>(`/float-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest(`/float-plans/${id}`, { method: 'DELETE' })
  },

  checkIn: async (id: string): Promise<FloatPlan> => {
    return apiRequest<FloatPlan>(`/float-plans/${id}/check-in`, {
      method: 'POST',
    })
  },
}

// Boats API
export const boatsApi = {
  getAll: async (): Promise<Boat[]> => {
    return apiRequest<Boat[]>('/boats')
  },

  create: async (boat: Omit<Boat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Boat> => {
    return apiRequest<Boat>('/boats', {
      method: 'POST',
      body: JSON.stringify(boat),
    })
  },

  update: async (id: string, updates: Partial<Boat>): Promise<Boat> => {
    return apiRequest<Boat>(`/boats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest(`/boats/${id}`, { method: 'DELETE' })
  },
}

// Contacts API
export const contactsApi = {
  getAll: async (): Promise<Contact[]> => {
    return apiRequest<Contact[]>('/contacts')
  },

  create: async (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> => {
    return apiRequest<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    })
  },

  update: async (id: string, updates: Partial<Contact>): Promise<Contact> => {
    return apiRequest<Contact>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest(`/contacts/${id}`, { method: 'DELETE' })
  },
}

// Inventory API
export const inventoryApi = {
  getAll: async (): Promise<InventoryItem[]> => {
    return apiRequest<InventoryItem[]>('/inventory')
  },

  create: async (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem> => {
    return apiRequest<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    })
  },

  update: async (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    return apiRequest<InventoryItem>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest(`/inventory/${id}`, { method: 'DELETE' })
  },
}

// Tasks API
export const tasksApi = {
  getAll: async (): Promise<Task[]> => {
    return apiRequest<Task[]>('/tasks')
  },

  create: async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> => {
    return apiRequest<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  },

  update: async (id: string, updates: Partial<Task>): Promise<Task> => {
    return apiRequest<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest(`/tasks/${id}`, { method: 'DELETE' })
  },
}

// Household API
export const householdApi = {
  // Get current user's household
  get: async (): Promise<Household | null> => {
    try {
      return await apiRequest<Household>('/household')
    } catch {
      return null
    }
  },

  // Create a new household
  create: async (name: string): Promise<Household> => {
    return apiRequest<Household>('/household', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  // Update household name
  update: async (id: string, name: string): Promise<Household> => {
    return apiRequest<Household>(`/household/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  },

  // Delete household (owner only)
  delete: async (id: string): Promise<void> => {
    await apiRequest(`/household/${id}`, { method: 'DELETE' })
  },

  // Get household members
  getMembers: async (householdId: string): Promise<HouseholdMember[]> => {
    return apiRequest<HouseholdMember[]>(`/household/${householdId}/members`)
  },

  // Invite a member by email
  inviteMember: async (householdId: string, email: string): Promise<HouseholdInvite> => {
    return apiRequest<HouseholdInvite>(`/household/${householdId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  // Remove a member (owner only)
  removeMember: async (householdId: string, memberId: string): Promise<void> => {
    await apiRequest(`/household/${householdId}/members/${memberId}`, {
      method: 'DELETE',
    })
  },

  // Get pending invites for current user
  getPendingInvites: async (): Promise<HouseholdInvite[]> => {
    return apiRequest<HouseholdInvite[]>('/household/invites')
  },

  // Accept an invite
  acceptInvite: async (inviteId: string): Promise<HouseholdMember> => {
    return apiRequest<HouseholdMember>(`/household/invites/${inviteId}/accept`, {
      method: 'POST',
    })
  },

  // Decline an invite
  declineInvite: async (inviteId: string): Promise<void> => {
    await apiRequest(`/household/invites/${inviteId}/decline`, {
      method: 'POST',
    })
  },

  // Leave household (member only, not owner)
  leave: async (householdId: string): Promise<void> => {
    await apiRequest(`/household/${householdId}/leave`, {
      method: 'POST',
    })
  },
}
