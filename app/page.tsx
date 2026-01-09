'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UserRole } from '@/types'

export default function Home() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('patient')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        // Sign up
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              name,
            },
          },
        })

        if (signUpError) throw signUpError

        if (data.user) {
          // Check if email confirmation is required
          if (data.session) {
            // User is immediately authenticated (no email confirmation required)
            // Wait for trigger to create user profile
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Check if user profile was created by trigger
            const { data: userProfile, error: profileCheckError } = await supabase
              .from('users')
              .select('*')
              .eq('id', data.user.id)
              .single()

            // If profile doesn't exist, create it manually (fallback)
            if (profileCheckError || !userProfile) {
              console.log('Trigger did not create profile, creating manually...')
              const { error: insertError } = await supabase
                .from('users')
                .insert([
                  {
                    id: data.user.id,
                    email: data.user.email || email,
                    role: role,
                    name: name || email,
                  },
                ])

              if (insertError) {
                console.error('Error creating user profile:', insertError)
                // The trigger should have created it, but if not, show a message
                setError('Account created but profile setup failed. Please try signing in.')
                return
              }
            }

            router.push(`/dashboard/${role}`)
          } else {
            // Email confirmation required
            setError('Account created! Please check your email to confirm your account, then sign in.')
          }
        }
      } else {
        // Sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        if (data.user) {
          // Get user role
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single()

          // If user profile doesn't exist, create it with default role
          if (userError || !userData) {
            console.log('User profile not found, creating with default role...')
            const { error: createError } = await supabase
              .from('users')
              .insert([
                {
                  id: data.user.id,
                  email: data.user.email || email,
                  role: 'patient', // Default role
                  name: data.user.email || email,
                },
              ])
            
            if (createError) {
              console.error('Error creating user profile on signin:', createError)
              throw new Error('User profile not found and could not be created. Please contact support.')
            }
            
            // Retry getting user data
            const { data: newUserData, error: retryError } = await supabase
              .from('users')
              .select('role')
              .eq('id', data.user.id)
              .single()
            
            if (retryError || !newUserData) {
              throw new Error('Failed to retrieve user profile')
            }
            
            router.push(`/dashboard/${newUserData.role}`)
          } else {
            router.push(`/dashboard/${userData.role}`)
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          AI Doctor
        </h1>
        <p className="text-center text-gray-600 mb-8">Healthcare Assistant</p>

        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              !isSignUp
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              isSignUp
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={isSignUp}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="fundraiser">Fundraiser</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

