'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AuthForm } from '@/components/AuthForm'
import { GroceryList } from '@/components/GroceryList'
import { QuickNotes } from '@/components/QuickNotes'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { Calendar } from '@/components/Calender'
import { Tasks } from '@/components/Tasks'

export default function Home() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('grocery')

  // Get user's household
  const { data: household } = useQuery({
    queryKey: ['household', user?.id],
    queryFn: async () => {
      if (!user?.id) return null

      const { data, error } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const tabs = [
    { id: 'grocery', label: 'Grocery', icon: '🛒' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'tasks', label: 'Tasks', icon: '✓' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <AuthForm />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Combined Header with Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          {/* Top row - Logo and User */}
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Life Hub</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-red-600 hover:underline"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Bottom row - Tabs */}
          <div className="flex gap-1 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {household?.household_id ? (
          <>
            {activeTab === 'grocery' && (
              <GroceryList householdId={household.household_id} userId={user.id} />
            )}
            {activeTab === 'notes' && (
              <QuickNotes householdId={household.household_id} userId={user.id} />
            )}
            {activeTab === 'calendar' && (
              <Calendar householdId={household.household_id} userId={user.id} />
            )}
            {activeTab === 'tasks' && (
              <Tasks householdId={household.household_id} userId={user.id} />
            )}
          </>
        ) : (
          <div className="text-gray-600">Setting up your household...</div>
        )}
      </div>
    </div>
  )
}