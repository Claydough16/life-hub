'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ConfirmDialog } from './ConfirmDialog'

interface HouseholdMember {
  user_id: string
  role: string
  joined_at: string
  profiles: {
    name: string
    email: string
  } | null
}

interface SettingsProps {
  householdId: string
  userId: string
}

export function Settings({ householdId, userId }: SettingsProps) {
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const queryClient = useQueryClient()
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  // Get household info and members
  const { data: household } = useQuery({
    queryKey: ['household-details', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
        .single()

      if (error) throw error
      return data
    },
  })

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['household-members', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select(`
          user_id,
          role,
          joined_at,
          profiles!inner (
            name,
            email
          )
        `)
        .eq('household_id', householdId)

      if (error) throw error
      return data as unknown as HouseholdMember[]
    },
  })

  // Check if current user is owner
  const currentUserMember = members.find(m => m.user_id === userId)
  const isOwner = currentUserMember?.role === 'owner'

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      setMessage(null)

      // Find user by email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single()

      if (profileError || !profiles) {
        throw new Error('No user found with that email. They need to sign up first!')
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId)
        .eq('user_id', profiles.id)
        .single()

      if (existing) {
        throw new Error('This user is already a member of your household!')
      }

      // Add to household
      const { error: insertError } = await supabase
        .from('household_members')
        .insert([
          {
            household_id: householdId,
            user_id: profiles.id,
            role: 'member',
          },
        ])

      if (insertError) throw insertError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-members', householdId] })
      setInviteEmail('')
      setMessage({ type: 'success', text: 'Member added successfully! 🎉' })
    },
    onError: (error) => {
      setMessage({ type: 'error', text: (error as Error).message })
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('user_id', memberUserId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-members', householdId] })
      setMessage({ type: 'success', text: 'Member removed successfully!' })
    },
    onError: (error) => {
      setMessage({ type: 'error', text: (error as Error).message })
    },
  })

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      setPasswordMessage(null)

      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
    },
    onSuccess: () => {
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setShowPasswordChange(false), 2000)
    },
    onError: (error) => {
      setPasswordMessage({ type: 'error', text: (error as Error).message })
    },
  })

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    addMemberMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Household Info */}
      <div className="bg-white rounded-lg shadow-xl p-6 border border-teal-100">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent mb-6 flex items-center gap-2">
          ⚙️ Household Settings
        </h2>

        <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border-2 border-teal-100">
          <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wider mb-2">Household Name</h3>
          <p className="text-xl font-semibold text-gray-900">{household?.name}</p>
        </div>

        {/* Add Member Form - Only show to owners */}
        {isOwner && (
          <div className="border-t-2 border-teal-100 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <h3 className="text-lg font-bold text-gray-900">Add Member</h3>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 transition-all"
                />
                <p className="text-sm text-gray-500 mt-2 flex items-start gap-2">
                  <svg className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>They must have an account first. Ask them to sign up at your app URL.</span>
                </p>
              </div>

              {message && (
                <div
                  className={`p-4 rounded-lg text-sm font-medium border-2 ${message.type === 'error'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={!inviteEmail.trim() || addMemberMutation.isPending}
                className="w-full px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02]"
              >
                {addMemberMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Adding member...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Add Member
                  </span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg shadow-xl p-6 border border-teal-100">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-bold text-gray-900">
            Household Members ({members.length})
          </h3>
        </div>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between p-4 border-2 border-teal-100 rounded-lg hover:border-teal-300 hover:shadow-md transition-all bg-gradient-to-r from-white to-teal-50/20"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {member.profiles?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {member.profiles?.name || 'Unknown User'}
                    {member.user_id === userId && (
                      <span className="text-xs bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-2 py-1 rounded-full font-bold">
                        You
                      </span>
                    )}
                    {member.role === 'owner' && (
                      <span className="text-xs bg-gradient-to-r from-amber-400 to-orange-400 text-white px-2 py-1 rounded-full font-bold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">{member.profiles?.email || 'No email'}</div>
                </div>
              </div>

              {isOwner && member.user_id !== userId && (
                <button
                  onClick={() => setConfirmDialog({
                    isOpen: true,
                    title: 'Remove Member',
                    message: `Are you sure you want to remove ${member.profiles?.name || 'this user'} from your household?`,
                    onConfirm: () => {
                      removeMemberMutation.mutate(member.user_id)
                      setConfirmDialog(null)
                    }
                  })}
                  className="text-red-600 hover:text-red-800 text-sm font-semibold px-3 py-1 rounded-lg hover:bg-red-50 transition-all flex-shrink-0"
                  title="Remove member"
                >
                  <span className="hidden sm:inline">Remove</span>
                  <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-white rounded-lg shadow-xl p-6 border border-teal-100">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="text-lg font-bold text-gray-900">
            Account Settings
          </h3>
        </div>

        {/* Change Password */}
        <div className="mb-4">
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border-2 border-teal-100 hover:border-teal-300 transition-all"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span className="font-semibold text-gray-900">Change Password</span>
            </div>
            <svg
              className={`w-5 h-5 text-teal-600 transition-transform ${showPasswordChange ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPasswordChange && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                changePasswordMutation.mutate()
              }}
              className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={6}
                  className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 transition-all"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                  className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 transition-all"
                />
              </div>

              {passwordMessage && (
                <div
                  className={`p-4 rounded-lg text-sm font-medium border-2 ${passwordMessage.type === 'error'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false)
                    setNewPassword('')
                    setConfirmPassword('')
                    setPasswordMessage(null)
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPassword || !confirmPassword || changePasswordMutation.isPending}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Add more settings here in the future */}
        <p className="text-xs text-gray-400 text-center mt-4">
          More account settings coming soon...
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-lg p-6">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-bold text-teal-900 mb-1">Shared Household</h4>
            <p className="text-sm text-teal-700">
              All members can see and manage grocery lists, notes, calendar events, and tasks.
              Private notes remain visible only to their creator.
            </p>
          </div>
        </div>
      </div>
      {/* Confirm Delete Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          isLoading={removeMemberMutation.isPending}
        />
      )}
    </div>
  )
}