'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface SearchProps {
  householdId: string
  onNavigate: (tab: string) => void
}

interface SearchResult {
  id: string
  type: 'grocery' | 'note' | 'event' | 'task'
  title: string
  preview?: string
  date?: string
  priority?: string
}

export function Search({ householdId, onNavigate }: SearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search query
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', householdId, searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return []

      // const searchLower = searchTerm.toLowerCase()
      const allResults: SearchResult[] = []

      // Search grocery items
      const { data: lists } = await supabase
        .from('lists')
        .select('id')
        .eq('household_id', householdId)
        .eq('type', 'grocery')
        .limit(1)

      if (lists && lists.length > 0) {
        const { data: groceryItems } = await supabase
          .from('list_items')
          .select('id, text, quantity')
          .eq('list_id', lists[0].id)
          .ilike('text', `%${searchTerm}%`)
          .limit(5)

        if (groceryItems) {
          allResults.push(
            ...groceryItems.map((item) => ({
              id: item.id,
              type: 'grocery' as const,
              title: item.text,
              preview: item.quantity ? `Quantity: ${item.quantity}` : undefined,
            }))
          )
        }
      }

      // Search notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id, content, created_at')
        .eq('household_id', householdId)
        .ilike('content', `%${searchTerm}%`)
        .limit(5)

      if (notes) {
        allResults.push(
          ...notes.map((note) => ({
            id: note.id,
            type: 'note' as const,
            title: note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
            preview: format(new Date(note.created_at), 'MMM d, yyyy'),
            date: note.created_at,
          }))
        )
      }

      // Search events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_time, all_day')
        .eq('household_id', householdId)
        .ilike('title', `%${searchTerm}%`)
        .limit(5)

      if (events) {
        allResults.push(
          ...events.map((event) => ({
            id: event.id,
            type: 'event' as const,
            title: event.title,
            preview: event.all_day
              ? format(new Date(event.start_time), 'MMM d, yyyy')
              : format(new Date(event.start_time), 'MMM d, yyyy h:mm a'),
            date: event.start_time,
          }))
        )
      }

      // Search tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, status')
        .eq('household_id', householdId)
        .ilike('title', `%${searchTerm}%`)
        .limit(5)

      if (tasks) {
        allResults.push(
          ...tasks.map((task) => ({
            id: task.id,
            type: 'task' as const,
            title: task.title,
            preview: task.due_date ? format(new Date(task.due_date), 'Due MMM d') : 'No due date',
            priority: task.priority,
          }))
        )
      }

      return allResults
    },
    enabled: searchTerm.length >= 2,
  })

  const handleResultClick = (result: SearchResult) => {
    const tabMap = {
      grocery: 'grocery',
      note: 'notes',
      event: 'calendar',
      task: 'tasks',
    }
    onNavigate(tabMap[result.type])
    setShowResults(false)
    setSearchTerm('')
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'grocery':
        return '🛒'
      case 'note':
        return '📝'
      case 'event':
        return '📅'
      case 'task':
        return '✓'
    }
  }

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'grocery':
        return 'Grocery'
      case 'note':
        return 'Note'
      case 'event':
        return 'Event'
      case 'task':
        return 'Task'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600'
      case 'medium':
        return 'text-amber-600'
      case 'low':
        return 'text-emerald-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div ref={searchRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search everything..."
          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/30 rounded-lg text-white placeholder-teal-100 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all backdrop-blur-sm"
        />
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-teal-100"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Results Dropdown */}
      {showResults && searchTerm.length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-2xl border-2 border-teal-100 max-h-96 overflow-y-auto z-50">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">No results found for &quot;{searchTerm}&quot;</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 hover:bg-teal-50 transition-colors text-left flex items-start gap-3"
                >
                  <span className="text-2xl flex-shrink-0">{getIcon(result.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-teal-600 uppercase">
                        {getTypeLabel(result.type)}
                      </span>
                      {result.priority && (
                        <span className={`text-xs font-bold uppercase ${getPriorityColor(result.priority)}`}>
                          {result.priority}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 truncate">{result.title}</p>
                    {result.preview && (
                      <p className="text-sm text-gray-500 truncate">{result.preview}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}