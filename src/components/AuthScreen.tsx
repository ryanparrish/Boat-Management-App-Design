import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Anchor } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface AuthScreenProps {
  onLogin: (accessToken: string, userId: string) => void
  supabase: any
  projectId: string
  publicAnonKey: string
}

export function AuthScreen({ onLogin, supabase, projectId, publicAnonKey }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4ab53527/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ email, password, name })
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      toast.success('Account created! Please sign in.')
      setIsSignUp(false)
      setPassword('')
    } catch (error) {
      console.error('Signup error:', error)
      toast.error('Signup failed')
    }
    setLoading(false)
  }

  const handleSignIn = async () => {
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      if (data.session) {
        toast.success('Welcome back!')
        onLogin(data.session.access_token, data.user.id)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('Sign in failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, #0a192f 0%, #1e3a5f 100%)' }}>
      <Card className="w-full max-w-md" style={{ borderColor: '#2c5282' }}>
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0ea5e9' }}>
            <Anchor className="w-8 h-8 text-white" />
          </div>
          <CardTitle>{isSignUp ? 'Create Account' : 'Welcome Back'}</CardTitle>
          <CardDescription>
            {isSignUp ? 'Start managing your boat safely' : 'Sign in to your float plan manager'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Captain John"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="captain@example.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button
            className="w-full"
            onClick={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </Button>

          <button
            type="button"
            className="w-full text-center text-sm"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ color: '#0ea5e9' }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
