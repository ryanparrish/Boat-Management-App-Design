import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'npm:@supabase/supabase-js@2'

const app = new Hono()

app.use('*', cors())
app.use('*', logger(console.log))

// Create Supabase client with service role for database operations
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Helper to verify user auth and return user ID
async function verifyUser(request: Request): Promise<string | null> {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1]
  if (!accessToken) {
    return null
  }
  
  const supabase = getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  if (error || !user) {
    return null
  }
  return user.id
}

// Helper to convert snake_case to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      acc[camelKey] = toCamelCase(obj[key])
      return acc
    }, {} as any)
  }
  return obj
}

// Helper to convert camelCase to snake_case
function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
      acc[snakeKey] = toSnakeCase(obj[key])
      return acc
    }, {} as any)
  }
  return obj
}

// ============================================
// AUTH ROUTES
// ============================================

// Sign up new user
app.post('/server/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true
    })
    
    if (error) {
      console.log('Signup error:', error)
      return c.json({ error: error.message }, 400)
    }
    
    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, email, name })
    
    if (profileError) {
      console.log('Profile creation error:', profileError)
    }
    
    return c.json({ success: true, user: data.user })
  } catch (error) {
    console.log('Signup error:', error)
    return c.json({ error: 'Signup failed' }, 500)
  }
})

// ============================================
// FLOAT PLANS ROUTES
// ============================================

// Get all float plans for user
app.get('/server/float-plans', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('float_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return c.json(toCamelCase(data))
  } catch (error) {
    console.log('Error fetching float plans:', error)
    return c.json({ error: 'Failed to fetch float plans' }, 500)
  }
})

// Get specific float plan
app.get('/server/float-plans/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planId = c.req.param('id')
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('float_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Float plan not found' }, 404)
    }
    
    return c.json(toCamelCase(data))
  } catch (error) {
    console.log('Error fetching float plan:', error)
    return c.json({ error: 'Failed to fetch float plan' }, 500)
  }
})

// Create new float plan
app.post('/server/float-plans', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planData = await c.req.json()
    const supabase = getSupabase()
    
    // Convert camelCase to snake_case and add user_id
    const dbData = {
      ...toSnakeCase(planData),
      user_id: userId,
    }
    
    // Handle coordinate fields specially
    if (planData.departureCoords) {
      dbData.departure_lat = planData.departureCoords.latitude
      dbData.departure_lng = planData.departureCoords.longitude
      delete dbData.departure_coords
    }
    if (planData.destinationCoords) {
      dbData.destination_lat = planData.destinationCoords.latitude
      dbData.destination_lng = planData.destinationCoords.longitude
      delete dbData.destination_coords
    }
    
    const { data, error } = await supabase
      .from('float_plans')
      .insert(dbData)
      .select()
      .single()
    
    if (error) throw error
    
    return c.json({ success: true, id: data.id, plan: toCamelCase(data) })
  } catch (error) {
    console.log('Error creating float plan:', error)
    return c.json({ error: 'Failed to create float plan' }, 500)
  }
})

// Update float plan
app.put('/server/float-plans/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planId = c.req.param('id')
    const updates = await c.req.json()
    const supabase = getSupabase()
    
    // Convert to snake_case
    const dbUpdates = toSnakeCase(updates)
    
    // Handle coordinate fields specially
    if (updates.departureCoords) {
      dbUpdates.departure_lat = updates.departureCoords.latitude
      dbUpdates.departure_lng = updates.departureCoords.longitude
      delete dbUpdates.departure_coords
    }
    if (updates.destinationCoords) {
      dbUpdates.destination_lat = updates.destinationCoords.latitude
      dbUpdates.destination_lng = updates.destinationCoords.longitude
      delete dbUpdates.destination_coords
    }
    
    const { data, error } = await supabase
      .from('float_plans')
      .update(dbUpdates)
      .eq('id', planId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Float plan not found' }, 404)
    }
    
    return c.json({ success: true, plan: toCamelCase(data) })
  } catch (error) {
    console.log('Error updating float plan:', error)
    return c.json({ error: 'Failed to update float plan' }, 500)
  }
})

// Delete float plan
app.delete('/server/float-plans/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planId = c.req.param('id')
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('float_plans')
      .delete()
      .eq('id', planId)
      .eq('user_id', userId)
    
    if (error) throw error
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting float plan:', error)
    return c.json({ error: 'Failed to delete float plan' }, 500)
  }
})

// Check in on float plan
app.post('/server/float-plans/:id/check-in', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const planId = c.req.param('id')
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('float_plans')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString()
      })
      .eq('id', planId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Float plan not found' }, 404)
    }
    
    return c.json({ success: true, plan: toCamelCase(data) })
  } catch (error) {
    console.log('Error checking in:', error)
    return c.json({ error: 'Failed to check in' }, 500)
  }
})

// ============================================
// BOATS ROUTES
// ============================================

// Get all boats for user
app.get('/server/boats', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('boats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return c.json(toCamelCase(data))
  } catch (error) {
    console.log('Error fetching boats:', error)
    return c.json({ error: 'Failed to fetch boats' }, 500)
  }
})

// Create new boat
app.post('/server/boats', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatData = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('boats')
      .insert({
        ...toSnakeCase(boatData),
        user_id: userId
      })
      .select()
      .single()
    
    if (error) throw error
    
    return c.json({ success: true, boat: toCamelCase(data) })
  } catch (error) {
    console.log('Error creating boat:', error)
    return c.json({ error: 'Failed to create boat' }, 500)
  }
})

// Update boat
app.put('/server/boats/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatId = c.req.param('id')
    const updates = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('boats')
      .update(toSnakeCase(updates))
      .eq('id', boatId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Boat not found' }, 404)
    }
    
    return c.json({ success: true, boat: toCamelCase(data) })
  } catch (error) {
    console.log('Error updating boat:', error)
    return c.json({ error: 'Failed to update boat' }, 500)
  }
})

// Delete boat
app.delete('/server/boats/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatId = c.req.param('id')
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('boats')
      .delete()
      .eq('id', boatId)
      .eq('user_id', userId)
    
    if (error) throw error
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting boat:', error)
    return c.json({ error: 'Failed to delete boat' }, 500)
  }
})

// ============================================
// CONTACTS ROUTES
// ============================================

// Get all contacts for user
app.get('/server/contacts', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
    
    if (error) throw error
    
    return c.json(toCamelCase(data))
  } catch (error) {
    console.log('Error fetching contacts:', error)
    return c.json({ error: 'Failed to fetch contacts' }, 500)
  }
})

// Create contact
app.post('/server/contacts', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const contactData = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        ...toSnakeCase(contactData),
        user_id: userId
      })
      .select()
      .single()
    
    if (error) throw error
    
    return c.json({ success: true, contact: toCamelCase(data) })
  } catch (error) {
    console.log('Error creating contact:', error)
    return c.json({ error: 'Failed to create contact' }, 500)
  }
})

// Update contact
app.put('/server/contacts/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const contactId = c.req.param('id')
    const updates = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('contacts')
      .update(toSnakeCase(updates))
      .eq('id', contactId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Contact not found' }, 404)
    }
    
    return c.json({ success: true, contact: toCamelCase(data) })
  } catch (error) {
    console.log('Error updating contact:', error)
    return c.json({ error: 'Failed to update contact' }, 500)
  }
})

// Delete contact
app.delete('/server/contacts/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const contactId = c.req.param('id')
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', userId)
    
    if (error) throw error
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting contact:', error)
    return c.json({ error: 'Failed to delete contact' }, 500)
  }
})

// ============================================
// INVENTORY ROUTES
// ============================================

// Get all inventory for user
app.get('/server/inventory', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
    
    if (error) throw error
    
    return c.json(toCamelCase(data))
  } catch (error) {
    console.log('Error fetching inventory:', error)
    return c.json({ error: 'Failed to fetch inventory' }, 500)
  }
})

// Create inventory item
app.post('/server/inventory', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const itemData = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        ...toSnakeCase(itemData),
        user_id: userId
      })
      .select()
      .single()
    
    if (error) throw error
    
    return c.json({ success: true, item: toCamelCase(data) })
  } catch (error) {
    console.log('Error creating inventory item:', error)
    return c.json({ error: 'Failed to create inventory item' }, 500)
  }
})

// Update inventory item
app.put('/server/inventory/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const itemId = c.req.param('id')
    const updates = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('inventory')
      .update(toSnakeCase(updates))
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Item not found' }, 404)
    }
    
    return c.json({ success: true, item: toCamelCase(data) })
  } catch (error) {
    console.log('Error updating inventory item:', error)
    return c.json({ error: 'Failed to update inventory item' }, 500)
  }
})

// Delete inventory item
app.delete('/server/inventory/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const itemId = c.req.param('id')
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)
    
    if (error) throw error
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting inventory item:', error)
    return c.json({ error: 'Failed to delete inventory item' }, 500)
  }
})

// ============================================
// TASKS ROUTES
// ============================================

// Get all tasks for user
app.get('/server/tasks', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false })
    
    if (error) throw error
    
    return c.json(toCamelCase(data))
  } catch (error) {
    console.log('Error fetching tasks:', error)
    return c.json({ error: 'Failed to fetch tasks' }, 500)
  }
})

// Create task
app.post('/server/tasks', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const taskData = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...toSnakeCase(taskData),
        user_id: userId
      })
      .select()
      .single()
    
    if (error) throw error
    
    return c.json({ success: true, task: toCamelCase(data) })
  } catch (error) {
    console.log('Error creating task:', error)
    return c.json({ error: 'Failed to create task' }, 500)
  }
})

// Update task
app.put('/server/tasks/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const taskId = c.req.param('id')
    const updates = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('tasks')
      .update(toSnakeCase(updates))
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error || !data) {
      return c.json({ error: 'Task not found' }, 404)
    }
    
    return c.json({ success: true, task: toCamelCase(data) })
  } catch (error) {
    console.log('Error updating task:', error)
    return c.json({ error: 'Failed to update task' }, 500)
  }
})

// Delete task
app.delete('/server/tasks/:id', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const taskId = c.req.param('id')
    const supabase = getSupabase()
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId)
    
    if (error) throw error
    
    return c.json({ success: true })
  } catch (error) {
    console.log('Error deleting task:', error)
    return c.json({ error: 'Failed to delete task' }, 500)
  }
})

// ============================================
// TANK LOGS ROUTES
// ============================================

// Get tank logs for a boat
app.get('/server/boats/:boatId/tank-logs', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatId = c.req.param('boatId')
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('tank_logs')
      .select('*')
      .eq('boat_id', boatId)
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    return c.json(toCamelCase(data))
  } catch (error) {
    console.log('Error fetching tank logs:', error)
    return c.json({ error: 'Failed to fetch tank logs' }, 500)
  }
})

// Create tank log
app.post('/server/boats/:boatId/tank-logs', async (c) => {
  const userId = await verifyUser(c.req.raw)
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  try {
    const boatId = c.req.param('boatId')
    const logData = await c.req.json()
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('tank_logs')
      .insert({
        ...toSnakeCase(logData),
        boat_id: boatId,
        user_id: userId
      })
      .select()
      .single()
    
    if (error) throw error
    
    return c.json({ success: true, log: toCamelCase(data) })
  } catch (error) {
    console.log('Error creating tank log:', error)
    return c.json({ error: 'Failed to create tank log' }, 500)
  }
})

Deno.serve(app.fetch)
