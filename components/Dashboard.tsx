'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, isToday, isTomorrow, addDays } from 'date-fns'

interface DashboardProps {
  householdId: string
  userId: string
}

interface Event {
  id: string
  title: string
  start_time: string
  all_day: boolean
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date?: string
}

interface Note {
  id: string
  content: string
  created_at: string
  is_private: boolean
}

export function Dashboard({ householdId, userId }: DashboardProps) {
  const [showModal, setShowModal] = useState<'grocery' | 'task' | 'event' | null>(null)
  const [groceryItem, setGroceryItem] = useState('')
  const [groceryQuantity, setGroceryQuantity] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [eventTime, setEventTime] = useState('')
  const [eventAllDay, setEventAllDay] = useState(false)

  const queryClient = useQueryClient()

  // Get user's profile for personalized greeting
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    },
  })

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  // Fetch upcoming events
  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['dashboard-events', householdId],
    queryFn: async () => {
      const today = new Date()
      const nextWeek = addDays(today, 7)

      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_time, all_day')
        .eq('household_id', householdId)
        .gte('start_time', today.toISOString())
        .lte('start_time', nextWeek.toISOString())
        .order('start_time', { ascending: true })
        .limit(5)

      if (error) throw error
      return data as Event[]
    },
  })

  // Fetch tasks due soon
  const { data: tasksDueSoon = [] } = useQuery({
    queryKey: ['dashboard-tasks', householdId],
    queryFn: async () => {
      const nextWeek = addDays(new Date(), 7)

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('household_id', householdId)
        .neq('status', 'done')
        .lte('due_date', nextWeek.toISOString())
        .order('due_date', { ascending: true })
        .limit(5)

      if (error) throw error
      return data as Task[]
    },
  })

  // Fetch recent notes
  const { data: recentNotes = [] } = useQuery({
    queryKey: ['dashboard-notes', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('id, content, created_at, is_private')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (error) throw error
      return data as Note[]
    },
  })

  // Fetch grocery list stats
  const { data: groceryStats } = useQuery({
    queryKey: ['dashboard-grocery', householdId],
    queryFn: async () => {
      const { data: lists } = await supabase
        .from('lists')
        .select('id')
        .eq('household_id', householdId)
        .eq('type', 'grocery')
        .limit(1)

      if (!lists || lists.length === 0) return { total: 0, pending: 0 }

      const { data: items, error } = await supabase
        .from('list_items')
        .select('id, is_completed')
        .eq('list_id', lists[0].id)

      if (error) throw error

      const total = items?.length || 0
      const pending = items?.filter(item => !item.is_completed).length || 0

      return { total, pending }
    },
  })

  // Count all active tasks
  const { data: taskStats } = useQuery({
    queryKey: ['dashboard-task-stats', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('status')
        .eq('household_id', householdId)

      if (error) throw error

      const active = data?.filter(t => t.status !== 'done').length || 0
      const total = data?.length || 0

      return { active, total }
    },
  })

  // Add grocery item mutation
  const addGroceryMutation = useMutation({
    mutationFn: async () => {
      // Get or create grocery list
      const { data: lists } = await supabase
        .from('lists')
        .select('id')
        .eq('household_id', householdId)
        .eq('type', 'grocery')
        .limit(1)

      let listId = lists?.[0]?.id

      if (!listId) {
        const { data: newList, error: listError } = await supabase
          .from('lists')
          .insert([{ household_id: householdId, name: 'Grocery List', type: 'grocery', created_by: userId }])
          .select()
          .single()

        if (listError) throw listError
        listId = newList.id
      }

      const { error } = await supabase.from('list_items').insert([
        {
          list_id: listId,
          text: groceryItem.trim(),
          quantity: groceryQuantity.trim() || null,
          added_by: userId,
        },
      ])

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-grocery'] })
      setGroceryItem('')
      setGroceryQuantity('')
      setShowModal(null)
    },
  })

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tasks').insert([
        {
          household_id: householdId,
          title: taskTitle.trim(),
          due_date: taskDueDate || null,
          priority: taskPriority,
          status: 'todo',
          created_by: userId,
          is_private: false,
        },
      ])

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-task-stats'] })
      setTaskTitle('')
      setTaskDueDate('')
      setTaskPriority('medium')
      setShowModal(null)
    },
  })

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async () => {
      const startTime = new Date(eventDate)
      if (!eventAllDay && eventTime) {
        const [hours, minutes] = eventTime.split(':')
        startTime.setHours(parseInt(hours), parseInt(minutes))
      }

      const { error } = await supabase.from('events').insert([
        {
          household_id: householdId,
          title: eventTitle.trim(),
          start_time: startTime.toISOString(),
          all_day: eventAllDay,
          created_by: userId,
        },
      ])

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-events'] })
      setEventTitle('')
      setEventDate(format(new Date(), 'yyyy-MM-dd'))
      setEventTime('')
      setEventAllDay(false)
      setShowModal(null)
    },
  })

  const getEventDate = (event: Event) => {
    const eventDate = new Date(event.start_time)
    if (isToday(eventDate)) return 'Today'
    if (isTomorrow(eventDate)) return 'Tomorrow'
    return format(eventDate, 'MMM d')
  }

  const getTaskDate = (task: Task) => {
    if (!task.due_date) return 'No due date'
    const dueDate = new Date(task.due_date)
    if (isToday(dueDate)) return 'Due today'
    if (isTomorrow(dueDate)) return 'Due tomorrow'
    return `Due ${format(dueDate, 'MMM d')}`
  }

  const getPriorityColor = (priority: string) => {
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

  const closeModal = () => {
    setShowModal(null)
    setGroceryItem('')
    setGroceryQuantity('')
    setTaskTitle('')
    setTaskDueDate('')
    setTaskPriority('medium')
    setEventTitle('')
    setEventDate(format(new Date(), 'yyyy-MM-dd'))
    setEventTime('')
    setEventAllDay(false)
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl shadow-xl p-6 sm:p-8 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {getGreeting()}{userProfile?.name ? `, ${userProfile.name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-teal-50 text-lg">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-teal-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Grocery Items</p>
                <p className="text-3xl font-bold text-teal-600">
                  {groceryStats?.pending || 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">to buy</p>
              </div>
              <div className="text-4xl">🛒</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-cyan-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active Tasks</p>
                <p className="text-3xl font-bold text-cyan-600">
                  {taskStats?.active || 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">in progress</p>
              </div>
              <div className="text-4xl">✓</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Upcoming Events</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {upcomingEvents.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">this week</p>
              </div>
              <div className="text-4xl">📅</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Events */}
          <div className="bg-white rounded-lg shadow-xl p-6 border border-teal-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                📅 Upcoming Events
              </h2>
            </div>

            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-200 hover:border-teal-300 transition-all"
                  >
                    <div className="font-medium text-gray-900">{event.title}</div>
                    <div className="text-sm text-teal-600 font-medium mt-1">
                      {getEventDate(event)}
                      {!event.all_day && ` at ${format(new Date(event.start_time), 'h:mm a')}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📅</div>
                <p className="text-sm">No upcoming events this week</p>
              </div>
            )}
          </div>

          {/* Tasks Due Soon */}
          <div className="bg-white rounded-lg shadow-xl p-6 border border-teal-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                ✓ Tasks Due Soon
              </h2>
            </div>

            {tasksDueSoon.length > 0 ? (
              <div className="space-y-3">
                {tasksDueSoon.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-gradient-to-r from-cyan-50 to-teal-50 rounded-lg border border-cyan-200 hover:border-cyan-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {getTaskDate(task)}
                        </div>
                      </div>
                      <span className={`text-xs font-bold uppercase ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-sm">No tasks due this week</p>
              </div>
            )}
          </div>

          {/* Recent Notes */}
          <div className="bg-white rounded-lg shadow-xl p-6 border border-teal-100 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                📝 Recent Notes
              </h2>
            </div>

            {recentNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recentNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border-2 border-teal-100 hover:border-teal-300 transition-all"
                  >
                    <p className="text-gray-900 text-sm line-clamp-3 mb-2">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{format(new Date(note.created_at), 'MMM d')}</span>
                      {note.is_private && (
                        <span className="text-amber-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Private
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📝</div>
                <p className="text-sm">No notes yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-xl p-6 border border-teal-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚡ Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setShowModal('grocery')}
              className="p-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg font-semibold"
            >
              + Add to Grocery List
            </button>
            <button
              onClick={() => setShowModal('task')}
              className="p-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg font-semibold"
            >
              + Create Task
            </button>
            <button
              onClick={() => setShowModal('event')}
              className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg font-semibold"
            >
              + Add Event
            </button>
          </div>
        </div>
      </div>

      {/* Grocery Modal */}
      {showModal === 'grocery' && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative border-2 border-teal-200">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Add Grocery Item
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); addGroceryMutation.mutate(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Item</label>
                <input
                  type="text"
                  value={groceryItem}
                  onChange={(e) => setGroceryItem(e.target.value)}
                  placeholder="Milk, eggs, bread..."
                  className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity (optional)</label>
                <input
                  type="text"
                  value={groceryQuantity}
                  onChange={(e) => setGroceryQuantity(e.target.value)}
                  placeholder="2, 1 lb, 3 cans..."
                  className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={!groceryItem.trim() || addGroceryMutation.isPending}
                className="w-full px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg hover:from-teal-700 hover:to-cyan-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
              >
                {addGroceryMutation.isPending ? 'Adding...' : 'Add Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showModal === 'task' && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative border-2 border-cyan-200">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
              Create Task
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); addTaskMutation.mutate(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Task</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full px-4 py-3 border-2 border-cyan-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date (optional)</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-cyan-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full px-4 py-3 border-2 border-cyan-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 font-medium transition-all"
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="high">🔴 High Priority</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!taskTitle.trim() || addTaskMutation.isPending}
                className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-lg hover:from-cyan-700 hover:to-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
              >
                {addTaskMutation.isPending ? 'Creating...' : 'Create Task'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showModal === 'event' && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative border-2 border-emerald-200">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Add Event
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); addEventMutation.mutate(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2 hover:text-gray-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={eventAllDay}
                    onChange={(e) => setEventAllDay(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                  />
                  <span className="font-medium">All day event</span>
                </label>

                {!eventAllDay && (
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 transition-all"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={!eventTitle.trim() || addEventMutation.isPending}
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
              >
                {addEventMutation.isPending ? 'Adding...' : 'Add Event'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}