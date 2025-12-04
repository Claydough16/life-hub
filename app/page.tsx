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
import { Settings } from '@/components/Settings'
import { Dashboard } from '@/components/Dashboard'
import { Search } from '@/components/Search'
import Image from 'next/image'

export default function Home() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')

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
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'grocery', label: 'Grocery', icon: '🛒' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'tasks', label: 'Tasks', icon: '✓' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50">
      {/* Combined Header with Tabs */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 border-b border-teal-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          {/* Top row - Logo, Search, and User */}
          <div className="flex justify-between items-center gap-4 py-3 border-b border-teal-500/30">
            <div className="flex items-center gap-3 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Life Hub"
                width={48}
                height={48}
                className="bg-white rounded-lg p-2 shadow-md"
              />
              <h1 className="text-xl font-bold text-white hidden sm:block">Life Hub</h1>
            </div>

            {/* Search Bar */}
            {household?.household_id && (
              <Search householdId={household.household_id} onNavigate={setActiveTab} />
            )}

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm text-teal-50 hidden md:inline">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg border border-white/30 hover:border-white/50 transition-all text-sm backdrop-blur-sm"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Bottom row - Tabs */}
          <div className="flex gap-1 py-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap
            ${activeTab === tab.id
                    ? 'bg-white text-teal-700 shadow-md'
                    : 'text-teal-50 hover:bg-teal-500/30 hover:text-white'
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
            {activeTab === 'dashboard' && household?.household_id && (
              <Dashboard householdId={household.household_id} userId={user.id} />
            )}
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
            {activeTab === 'settings' && household?.household_id && (
              <Settings householdId={household.household_id} userId={user.id} />
            )}
          </>
        ) : (
          <div className="text-gray-600">Setting up your household...</div>
        )}
      </div>
    </div>
  )
}