import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as kv from './kv_store.tsx'

const app = new Hono()

app.use('*', cors())
app.use('*', logger(console.log))

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Helper to verify user auth
async function verifyUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1]
  if (!accessToken) {
    return null
  }
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  if (error || !user) {
    return null
  }
  return user.id
}

// Sign up new user
app.post('/make-server-4ab53527/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json()
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    })
    
    if (error) {
      console.log('Signup error:', error)
      return c.json({ error: error.message }, 400)
    }
    
    // Initialize user data
    await kv.set(`user:${data.user.id}:profile`, { name, email })
    await kv.set(`user:${data.user.id}:floatplans`, [])
    await kv.set(`user:${data.user.id}:boats`, [])
    await kv.set(`user:${data.user.id}:contacts`, [])
    await kv.set(`user:${data.user.id}:inventory`, [])
    await kv.set(`user:${data.user.id}:tasks`, [])
    
    return c.json({ success: true, user: data.user })
  } catch (error) {
    console.log('Signup error:', error)
    return c.json({ error: 'Signup failed' }, 500)
  }
})

// Get all float plans for user
app.get('/make-server-4ab53527/float-plans', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planIds = await kv.get(`user:${userId}:floatplans`) || []
    const plans = await Promise.all(
      planIds.map(async (id: string) => {
        const plan = await kv.get(`floatplan:${id}`)
        return plan ? { ...plan, id } : null
      })
    )
    
    return c.json(plans.filter(p => p !== null))
  } catch (error) {
    console.log('Error fetching float plans:', error)
    return c.json({ error: 'Failed to fetch float plans' }, 500)
  }
})

// Create new float plan
app.post('/make-server-4ab53527/float-plans', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planData = await c.req.json()
    const planId = `${userId}_${Date.now()}`
    
    const floatPlan = {
      ...planData,
      userId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await kv.set(`floatplan:${planId}`, floatPlan)
    
    const planIds = await kv.get(`user:${userId}:floatplans`) || []
    planIds.push(planId)
    await kv.set(`user:${userId}:floatplans`, planIds)
    
    return c.json({ success: true, id: planId, plan: floatPlan })
  } catch (error) {
    console.log('Error creating float plan:', error)
    return c.json({ error: 'Failed to create float plan' }, 500)
  }
})

// Get specific float plan
app.get('/make-server-4ab53527/float-plans/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planId = c.req.param('id')
    const plan = await kv.get(`floatplan:${planId}`)
    
    if (!plan || plan.userId !== userId) {
      return c.json({ error: 'Float plan not found' }, 404)
    }
    
    return c.json({ ...plan, id: planId })
  } catch (error) {
    console.log('Error fetching float plan:', error)
    return c.json({ error: 'Failed to fetch float plan' }, 500)
  }
})

// Update float plan
app.put('/make-server-4ab53527/float-plans/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planId = c.req.param('id')
    const plan = await kv.get(`floatplan:${planId}`)
    
    if (!plan || plan.userId !== userId) {
      return c.json({ error: 'Float plan not found' }, 404)
    }
    
    const updates = await c.req.json()
    const updatedPlan = {
      ...plan,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    await kv.set(`floatplan:${planId}`, updatedPlan)
    
    return c.json({ success: true, plan: updatedPlan })
  } catch (error) {
    console.log('Error updating float plan:', error)
    return c.json({ error: 'Failed to update float plan' }, 500)
  }
})

// Check in on float plan
app.post('/make-server-4ab53527/check-in/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planId = c.req.param('id')
    const plan = await kv.get(`floatplan:${planId}`)
    
    if (!plan || plan.userId !== userId) {
      return c.json({ error: 'Float plan not found' }, 404)
    }
    
    const now = new Date().toISOString()
    const updatedPlan = {
      ...plan,
      status: 'checked_in',
      lastCheckIn: now,
      updatedAt: now
    }
    
    await kv.set(`floatplan:${planId}`, updatedPlan)
    
    return c.json({ success: true, plan: updatedPlan })
  } catch (error) {
    console.log('Error checking in:', error)
    return c.json({ error: 'Failed to check in' }, 500)
  }
})

// Get notification contacts
app.get('/make-server-4ab53527/contacts', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const contacts = await kv.get(`user:${userId}:contacts`) || []
    return c.json(contacts)
  } catch (error) {
    console.log('Error fetching contacts:', error)
    return c.json({ error: 'Failed to fetch contacts' }, 500)
  }
})

// Create notification contact
app.post('/make-server-4ab53527/contacts', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const contactData = await c.req.json()
    const contacts = await kv.get(`user:${userId}:contacts`) || []
    
    const newContact = {
      ...contactData,
      id: `${userId}_${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    
    contacts.push(newContact)
    await kv.set(`user:${userId}:contacts`, contacts)
    
    return c.json({ success: true, contact: newContact })
  } catch (error) {
    console.log('Error creating contact:', error)
    return c.json({ error: 'Failed to create contact' }, 500)
  }
})

// Update notification contact
app.put('/make-server-4ab53527/contacts/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const contactId = c.req.param('id')
    const contacts = await kv.get(`user:${userId}:contacts`) || []
    
    const index = contacts.findIndex((c: any) => c.id === contactId)
    if (index === -1) {
      return c.json({ error: 'Contact not found' }, 404)
    }
    
    const updates = await c.req.json()
    contacts[index] = { ...contacts[index], ...updates }
    
    await kv.set(`user:${userId}:contacts`, contacts)
    
    return c.json({ success: true, contact: contacts[index] })
  } catch (error) {
    console.log('Error updating contact:', error)
    return c.json({ error: 'Failed to update contact' }, 500)
  }
})

// Delete notification contact
app.delete('/make-server-4ab53527/contacts/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const contactId = c.req.param('id')
    const contacts = await kv.get(`user:${userId}:contacts`) || []
    
    const filtered = contacts.filter((c: any) => c.id !== contactId)
    await kv.set(`user:${userId}:contacts`, filtered)
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting contact:', error)
    return c.json({ error: 'Failed to delete contact' }, 500)
  }
})

// Get inventory items
app.get('/make-server-4ab53527/inventory', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const inventory = await kv.get(`user:${userId}:inventory`) || []
    return c.json(inventory)
  } catch (error) {
    console.log('Error fetching inventory:', error)
    return c.json({ error: 'Failed to fetch inventory' }, 500)
  }
})

// Create inventory item
app.post('/make-server-4ab53527/inventory', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const itemData = await c.req.json()
    const inventory = await kv.get(`user:${userId}:inventory`) || []
    
    const newItem = {
      ...itemData,
      id: `${userId}_${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    
    inventory.push(newItem)
    await kv.set(`user:${userId}:inventory`, inventory)
    
    return c.json({ success: true, item: newItem })
  } catch (error) {
    console.log('Error creating inventory item:', error)
    return c.json({ error: 'Failed to create inventory item' }, 500)
  }
})

// Update inventory item
app.put('/make-server-4ab53527/inventory/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const itemId = c.req.param('id')
    const inventory = await kv.get(`user:${userId}:inventory`) || []
    
    const index = inventory.findIndex((i: any) => i.id === itemId)
    if (index === -1) {
      return c.json({ error: 'Item not found' }, 404)
    }
    
    const updates = await c.req.json()
    inventory[index] = { ...inventory[index], ...updates }
    
    await kv.set(`user:${userId}:inventory`, inventory)
    
    return c.json({ success: true, item: inventory[index] })
  } catch (error) {
    console.log('Error updating inventory item:', error)
    return c.json({ error: 'Failed to update inventory item' }, 500)
  }
})

// Delete inventory item
app.delete('/make-server-4ab53527/inventory/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const itemId = c.req.param('id')
    const inventory = await kv.get(`user:${userId}:inventory`) || []
    
    const filtered = inventory.filter((i: any) => i.id !== itemId)
    await kv.set(`user:${userId}:inventory`, filtered)
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting inventory item:', error)
    return c.json({ error: 'Failed to delete inventory item' }, 500)
  }
})

// Get seasonal tasks
app.get('/make-server-4ab53527/tasks', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const tasks = await kv.get(`user:${userId}:tasks`) || []
    return c.json(tasks)
  } catch (error) {
    console.log('Error fetching tasks:', error)
    return c.json({ error: 'Failed to fetch tasks' }, 500)
  }
})

// Create seasonal task
app.post('/make-server-4ab53527/tasks', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const taskData = await c.req.json()
    const tasks = await kv.get(`user:${userId}:tasks`) || []
    
    const newTask = {
      ...taskData,
      id: `${userId}_${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    
    tasks.push(newTask)
    await kv.set(`user:${userId}:tasks`, tasks)
    
    return c.json({ success: true, task: newTask })
  } catch (error) {
    console.log('Error creating task:', error)
    return c.json({ error: 'Failed to create task' }, 500)
  }
})

// Update seasonal task
app.put('/make-server-4ab53527/tasks/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const taskId = c.req.param('id')
    const tasks = await kv.get(`user:${userId}:tasks`) || []
    
    const index = tasks.findIndex((t: any) => t.id === taskId)
    if (index === -1) {
      return c.json({ error: 'Task not found' }, 404)
    }
    
    const updates = await c.req.json()
    tasks[index] = { ...tasks[index], ...updates }
    
    await kv.set(`user:${userId}:tasks`, tasks)
    
    return c.json({ success: true, task: tasks[index] })
  } catch (error) {
    console.log('Error updating task:', error)
    return c.json({ error: 'Failed to update task' }, 500)
  }
})

/**
 * BOAT MANAGEMENT ROUTES
 * Endpoints for managing user's boats (vessels)
 */

// Get all boats for user
app.get('/make-server-4ab53527/boats', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boats = await kv.get(`user:${userId}:boats`) || []
    return c.json(boats)
  } catch (error) {
    console.log('Error fetching boats:', error)
    return c.json({ error: 'Failed to fetch boats' }, 500)
  }
})

// Create new boat
app.post('/make-server-4ab53527/boats', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatData = await c.req.json()
    const boats = await kv.get(`user:${userId}:boats`) || []
    
    const newBoat = {
      ...boatData,
      id: `${userId}_${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    
    boats.push(newBoat)
    await kv.set(`user:${userId}:boats`, boats)
    
    return c.json({ success: true, boat: newBoat })
  } catch (error) {
    console.log('Error creating boat:', error)
    return c.json({ error: 'Failed to create boat' }, 500)
  }
})

// Update boat
app.put('/make-server-4ab53527/boats/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatId = c.req.param('id')
    const boats = await kv.get(`user:${userId}:boats`) || []
    
    const index = boats.findIndex((b: any) => b.id === boatId)
    if (index === -1) {
      return c.json({ error: 'Boat not found' }, 404)
    }
    
    const updates = await c.req.json()
    boats[index] = { ...boats[index], ...updates, updatedAt: new Date().toISOString() }
    
    await kv.set(`user:${userId}:boats`, boats)
    
    return c.json({ success: true, boat: boats[index] })
  } catch (error) {
    console.log('Error updating boat:', error)
    return c.json({ error: 'Failed to update boat' }, 500)
  }
})

// Delete boat
app.delete('/make-server-4ab53527/boats/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatId = c.req.param('id')
    const boats = await kv.get(`user:${userId}:boats`) || []
    
    const filtered = boats.filter((b: any) => b.id !== boatId)
    await kv.set(`user:${userId}:boats`, filtered)
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting boat:', error)
    return c.json({ error: 'Failed to delete boat' }, 500)
  }
})

Deno.serve(app.fetch)