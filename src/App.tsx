/**
 * Main Application Component
 * 
 * Float Plan Safety Manager - A comprehensive boat management application
 * for creating float plans, tracking inventory, managing crew, and ensuring
 * safe boating through check-in notifications.
 * 
 * Architecture:
 * - Supabase backend for authentication and data storage
 * - KV store for all user data (boats, float plans, inventory, tasks, contacts)
 * - Responsive design (mobile-first, scales to desktop)
 * - Real-time data synchronization
 * 
 * @component
 */

import { useState, useEffect } from 'react'
import { Toaster } from './components/ui/sonner'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { FloatPlanDetail } from './components/FloatPlanDetail'
import { CreateFloatPlan } from './components/CreateFloatPlan'
import { FloatPlansList } from './components/FloatPlansList'
import { ContactsManager } from './components/ContactsManager'
import { InventoryList } from './components/InventoryList'
import { SeasonalTasks } from './components/SeasonalTasks'
import { BoatsManager } from './components/BoatsManager'
import { createClient } from './utils/supabase/client'
import { projectId, publicAnonKey } from './utils/supabase/info'

/**
 * Available views/screens in the application
 */
type View = 
  | 'dashboard' 
  | 'boats'
  | 'float-plans' 
  | 'float-plan-detail' 
  | 'create-float-plan' 
  | 'edit-float-plan' 
  | 'contacts' 
  | 'inventory' 
  | 'tasks'

export default function App() {
  // ============================================================================
  // Authentication State
  // ============================================================================
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [userId, setUserId] = useState('')
  
  // ============================================================================
  // Navigation State
  // ============================================================================
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedFloatPlanId, setSelectedFloatPlanId] = useState('')
  const [editingFloatPlan, setEditingFloatPlan] = useState<any>(null)
  
  // ============================================================================
  // Data State - All user data from backend
  // ============================================================================
  const [boats, setBoats] = useState<any[]>([])
  const [floatPlans, setFloatPlans] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  
  // ============================================================================
  // Loading State
  // ============================================================================
  const [loading, setLoading] = useState(true)
  
  // ============================================================================
  // Supabase Client Instance
  // ============================================================================
  const supabase = createClient()

  /**
   * Effect: Check for existing session on mount
   * Attempts to restore user session if they were previously logged in
   */
  useEffect(() => {
    checkSession()
  }, [])

  /**
   * Effect: Load all data when user is authenticated
   * Fetches boats, float plans, contacts, inventory, and tasks
   */
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadAllData()
    }
  }, [isAuthenticated, accessToken])

  /**
   * Check for existing Supabase session
   * Used on app initialization to restore logged-in state
   */
  const checkSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession()
      
      if (data?.session) {
        setIsAuthenticated(true)
        setAccessToken(data.session.access_token)
        setUserId(data.user.id)
      }
    } catch (error) {
      console.error('Session check error during app initialization:', error)
    }
    setLoading(false)
  }

  /**
   * Handle successful login
   * Sets authentication state and tokens
   * 
   * @param token - Supabase access token
   * @param uid - User ID
   */
  const handleLogin = (token: string, uid: string) => {
    setAccessToken(token)
    setUserId(uid)
    setIsAuthenticated(true)
  }

  /**
   * Handle user logout
   * Clears all state and returns to login screen
   */
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setAccessToken('')
    setUserId('')
    setCurrentView('dashboard')
    
    // Clear all data
    setBoats([])
    setFloatPlans([])
    setContacts([])
    setInventory([])
    setTasks([])
  }

  // ============================================================================
  // Data Loading Functions
  // ============================================================================

  /**
   * Load all user data from backend
   * Fetches boats, float plans, contacts, inventory, and tasks in parallel
   */
  const loadAllData = async () => {
    await Promise.all([
      loadBoats(),
      loadFloatPlans(),
      loadContacts(),
      loadInventory(),
      loadTasks()
    ])
  }

  /**
   * Load user's boats from backend
   */
  const loadBoats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/boats`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setBoats(data)
      }
    } catch (error) {
      console.error('Error loading boats from backend:', error)
    }
  }

  /**
   * Load user's float plans from backend
   */
  const loadFloatPlans = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/float-plans`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setFloatPlans(data)
      }
    } catch (error) {
      console.error('Error loading float plans from backend:', error)
    }
  }

  /**
   * Load user's emergency contacts from backend
   */
  const loadContacts = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/contacts`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setContacts(data)
      }
    } catch (error) {
      console.error('Error loading contacts from backend:', error)
    }
  }

  /**
   * Load user's inventory items from backend
   */
  const loadInventory = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/inventory`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setInventory(data)
      }
    } catch (error) {
      console.error('Error loading inventory from backend:', error)
    }
  }

  /**
   * Load user's seasonal tasks from backend
   */
  const loadTasks = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/tasks`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
      }
    } catch (error) {
      console.error('Error loading tasks from backend:', error)
    }
  }

  // ============================================================================
  // Navigation Handlers
  // ============================================================================

  /**
   * Navigate to a different view/screen
   * Resets any selection state when navigating
   * 
   * @param view - Target view to navigate to
   */
  const handleNavigate = (view: View) => {
    setCurrentView(view)
    setSelectedFloatPlanId('')
    setEditingFloatPlan(null)
  }

  /**
   * Select a float plan to view details
   * 
   * @param id - Float plan ID
   */
  const handleSelectFloatPlan = (id: string) => {
    setSelectedFloatPlanId(id)
    setCurrentView('float-plan-detail')
  }

  /**
   * Edit an existing float plan
   * 
   * @param id - Float plan ID to edit
   */
  const handleEditFloatPlan = async (id: string) => {
    const plan = floatPlans.find(p => p.id === id)
    if (plan) {
      setEditingFloatPlan(plan)
      setCurrentView('edit-float-plan')
    }
  }

  /**
   * Handle successful float plan creation/update
   * Refreshes data and returns to dashboard
   */
  const handleFloatPlanSuccess = async () => {
    await loadFloatPlans()
    setCurrentView('dashboard')
    setEditingFloatPlan(null)
  }

  // ============================================================================
  // Render Logic
  // ============================================================================

  /**
   * Loading state - shown during initial session check
   */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f1f5f9' }}>
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
    )
  }

  /**
   * Unauthenticated state - show login/signup screen
   */
  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen
          onLogin={handleLogin}
          supabase={supabase}
          projectId={projectId}
          publicAnonKey={publicAnonKey}
        />
        <Toaster />
      </>
    )
  }

  /**
   * Authenticated state - show app content
   * Wrapped in responsive container (mobile-first, scales to desktop)
   */
  return (
    <>
      {/* Responsive container: mobile-first (max 428px), centered on larger screens */}
      <div className="w-full max-w-[428px] sm:max-w-full lg:max-w-[428px] mx-auto" style={{ backgroundColor: '#ffffff' }}>
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <Dashboard
            boats={boats}
            floatPlans={floatPlans}
            inventory={inventory}
            tasks={tasks}
            onNavigate={handleNavigate}
            onSelectFloatPlan={handleSelectFloatPlan}
            onLogout={handleLogout}
          />
        )}
        
        {/* Boats Management View */}
        {currentView === 'boats' && (
          <BoatsManager
            boats={boats}
            projectId={projectId}
            accessToken={accessToken}
            onBack={() => handleNavigate('dashboard')}
            onRefresh={loadBoats}
          />
        )}
        
        {/* Float Plans List View */}
        {currentView === 'float-plans' && (
          <FloatPlansList
            floatPlans={floatPlans}
            onBack={() => handleNavigate('dashboard')}
            onCreate={() => handleNavigate('create-float-plan')}
            onSelect={handleSelectFloatPlan}
          />
        )}
        
        {/* Float Plan Detail View */}
        {currentView === 'float-plan-detail' && selectedFloatPlanId && (
          <FloatPlanDetail
            planId={selectedFloatPlanId}
            projectId={projectId}
            accessToken={accessToken}
            onBack={() => handleNavigate('dashboard')}
            onEdit={handleEditFloatPlan}
            onRefresh={loadFloatPlans}
          />
        )}
        
        {/* Create Float Plan View */}
        {currentView === 'create-float-plan' && (
          <CreateFloatPlan
            boats={boats}
            projectId={projectId}
            accessToken={accessToken}
            onBack={() => handleNavigate('dashboard')}
            onSuccess={handleFloatPlanSuccess}
          />
        )}
        
        {/* Edit Float Plan View */}
        {currentView === 'edit-float-plan' && editingFloatPlan && (
          <CreateFloatPlan
            boats={boats}
            projectId={projectId}
            accessToken={accessToken}
            onBack={() => handleNavigate('float-plan-detail')}
            onSuccess={handleFloatPlanSuccess}
            editPlan={editingFloatPlan}
          />
        )}
        
        {/* Emergency Contacts View */}
        {currentView === 'contacts' && (
          <ContactsManager
            contacts={contacts}
            projectId={projectId}
            accessToken={accessToken}
            onBack={() => handleNavigate('dashboard')}
            onRefresh={loadContacts}
          />
        )}
        
        {/* Inventory Management View */}
        {currentView === 'inventory' && (
          <InventoryList
            inventory={inventory}
            projectId={projectId}
            accessToken={accessToken}
            onBack={() => handleNavigate('dashboard')}
            onRefresh={loadInventory}
          />
        )}
        
        {/* Seasonal Tasks View */}
        {currentView === 'tasks' && (
          <SeasonalTasks
            tasks={tasks}
            projectId={projectId}
            accessToken={accessToken}
            onBack={() => handleNavigate('dashboard')}
            onRefresh={loadTasks}
          />
        )}
      </div>
      
      {/* Toast notifications for user feedback */}
      <Toaster />
    </>
  )
}
