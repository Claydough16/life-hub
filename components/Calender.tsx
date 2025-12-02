'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'

interface Event {
	id: string
	title: string
	description?: string
	start_time: string
	end_time?: string
	all_day: boolean
	location?: string
	created_by: string
}

interface CalendarProps {
	householdId: string
	userId: string
}

export function Calendar({ householdId, userId }: CalendarProps) {
	const [currentMonth, setCurrentMonth] = useState(new Date())
	const [selectedDate, setSelectedDate] = useState<Date | null>(null)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [newEventTitle, setNewEventTitle] = useState('')
	const [newEventTime, setNewEventTime] = useState('')
	const [newEventAllDay, setNewEventAllDay] = useState(false)
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
	const queryClient = useQueryClient()

	// Get events for current month
	const { data: events = [], isLoading } = useQuery({
		queryKey: ['events', householdId, currentMonth.getMonth()],
		queryFn: async () => {
			const start = startOfMonth(currentMonth)
			const end = endOfMonth(currentMonth)

			const { data, error } = await supabase
				.from('events')
				.select('*')
				.eq('household_id', householdId)
				.gte('start_time', start.toISOString())
				.lte('start_time', end.toISOString())
				.order('start_time', { ascending: true })

			if (error) throw error
			return data as Event[]
		},
	})

	// Add event mutation
	const addEventMutation = useMutation({
		mutationFn: async () => {
			if (!selectedDate || !newEventTitle.trim()) return

			let startTime = selectedDate
			if (!newEventAllDay && newEventTime) {
				const [hours, minutes] = newEventTime.split(':')
				startTime = new Date(selectedDate)
				startTime.setHours(parseInt(hours), parseInt(minutes))
			}

			const { error } = await supabase.from('events').insert([
				{
					household_id: householdId,
					title: newEventTitle.trim(),
					start_time: startTime.toISOString(),
					all_day: newEventAllDay,
					created_by: userId,
				},
			])

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['events', householdId] })
			setNewEventTitle('')
			setNewEventTime('')
			setNewEventAllDay(false)
			setShowAddDialog(false)
			setSelectedDate(null)
		},
	})

	// Delete event mutation
	const deleteEventMutation = useMutation({
		mutationFn: async (eventId: string) => {
			const { error } = await supabase.from('events').delete().eq('id', eventId)
			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['events', householdId] })
		},
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		addEventMutation.mutate()
	}

	// Get calendar days
	const monthStart = startOfMonth(currentMonth)
	const monthEnd = endOfMonth(currentMonth)
	const calendarStart = startOfWeek(monthStart)
	const calendarEnd = endOfWeek(monthEnd)
	const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

	// Get events for a specific day
	const getEventsForDay = (day: Date) => {
		return events.filter((event) =>
			isSameDay(new Date(event.start_time), day)
		)
	}

	// Get days with events for list view
	const daysWithEvents = eachDayOfInterval({ start: monthStart, end: monthEnd })
		.map(day => ({
			date: day,
			events: getEventsForDay(day)
		}))
		.filter(day => day.events.length > 0)

	const previousMonth = () => {
		setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
	}

	const nextMonth = () => {
		setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-gray-600">Loading calendar...</div>
			</div>
		)
	}

	return (
		<>
			<div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 max-w-4xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
						📅 {format(currentMonth, 'MMMM yyyy')}
					</h2>
					<div className="flex gap-2">
						{/* View Toggle */}
						<button
							onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
							className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium text-sm"
							title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
						>
							{viewMode === 'grid' ? '📋' : '📅'}
						</button>

						<button
							onClick={previousMonth}
							className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
						>
							←
						</button>
						<button
							onClick={nextMonth}
							className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
						>
							→
						</button>
					</div>
				</div>

				{/* Calendar Grid View */}
				{viewMode === 'grid' && (
					<div className="mb-6">
						{/* Day headers */}
						<div className="grid grid-cols-7 gap-2 mb-2">
							{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
								<div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
									{day}
								</div>
							))}
						</div>

						{/* Calendar days */}
						<div className="grid grid-cols-7 gap-2">
							{calendarDays.map((day, index) => {
								const dayEvents = getEventsForDay(day)
								const isCurrentMonth = isSameMonth(day, currentMonth)
								const isCurrentDay = isToday(day)

								return (
									<button
										key={index}
										onClick={() => {
											setSelectedDate(day)
											setShowAddDialog(true)
										}}
										className={`
              min-h-[80px] p-2 rounded-lg border transition-colors text-left
              ${isCurrentMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}
              ${isCurrentDay ? 'ring-2 ring-blue-500' : ''}
              hover:bg-blue-50 hover:border-blue-300
            `}
									>
										<div className={`text-sm font-medium mb-1 ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
											{format(day, 'd')}
										</div>
										<div className="space-y-1">
											{dayEvents.slice(0, 2).map((event) => (
												<div
													key={event.id}
													className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded truncate"
												>
													{event.all_day ? '🌟' : format(new Date(event.start_time), 'h:mm a')} {event.title}
												</div>
											))}
											{dayEvents.length > 2 && (
												<div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>
											)}
										</div>
									</button>
								)
							})}
						</div>
					</div>
				)}

				{/* List View */}
				{viewMode === 'list' && (
					<div className="mb-6">
						{/* Add Event Button */}
						<button
							onClick={() => {
								setSelectedDate(new Date())
								setShowAddDialog(true)
							}}
							className="w-full mb-4 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
						>
							+ Add Event
						</button>

						{daysWithEvents.length > 0 ? (
							<div className="space-y-4">
								{daysWithEvents.map(({ date, events }) => (
									<div key={date.toISOString()} className="border-l-4 border-blue-500 pl-4">
										<div className="font-bold text-gray-900 mb-2">
											{format(date, 'EEEE, MMM d')}
											{isToday(date) && (
												<span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
													Today
												</span>
											)}
										</div>
										<div className="space-y-2">
											{events.map((event) => (
												<div
													key={event.id}
													className="flex items-start justify-between bg-gray-50 p-3 rounded-lg"
												>
													<div className="flex-1">
														<div className="font-medium text-gray-900">{event.title}</div>
														<div className="text-sm text-gray-600">
															{event.all_day ? 'All day' : format(new Date(event.start_time), 'h:mm a')}
														</div>
													</div>
													{event.created_by === userId && (
														<button
															onClick={() => deleteEventMutation.mutate(event.id)}
															className="text-red-600 hover:text-red-800 ml-2"
														>
															<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
															</svg>
														</button>
													)}
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-12">
								<div className="text-6xl mb-4">📅</div>
								<p className="text-gray-600 text-lg mb-2">No events this month</p>
								<p className="text-gray-400 text-sm">Tap the button above to add one!</p>
							</div>
						)}
					</div>
				)}

				{/* Upcoming Events List - only show in grid view */}
				{viewMode === 'grid' && events.length > 0 && (
					<div className="border-t pt-6">
						<h3 className="text-lg font-bold text-gray-900 mb-3">Upcoming Events</h3>
						<div className="space-y-2">
							{events.slice(0, 5).map((event) => (
								<div
									key={event.id}
									className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
								>
									<div>
										<div className="font-medium text-gray-900">{event.title}</div>
										<div className="text-sm text-gray-600">
											{event.all_day
												? format(new Date(event.start_time), 'MMM d, yyyy')
												: format(new Date(event.start_time), 'MMM d, yyyy • h:mm a')}
										</div>
									</div>
									{event.created_by === userId && (
										<button
											onClick={() => deleteEventMutation.mutate(event.id)}
											className="text-red-600 hover:text-red-800 text-sm font-medium"
										>
											Delete
										</button>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Add Event Dialog */}
			{showAddDialog && selectedDate && (
				<div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full relative">
						<button
							onClick={() => {
								setShowAddDialog(false)
								setSelectedDate(null)
								setNewEventTitle('')
								setNewEventTime('')
								setNewEventAllDay(false)
							}}
							className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
						>
							<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>

						<h3 className="text-xl font-bold mb-4 text-gray-900">
							Add Event - {format(selectedDate, 'MMM d, yyyy')}
						</h3>

						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Event Title
								</label>
								<input
									type="text"
									value={newEventTitle}
									onChange={(e) => setNewEventTitle(e.target.value)}
									placeholder="What's happening?"
									className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
									autoFocus
								/>
							</div>

							<div>
								<label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
									<input
										type="checkbox"
										checked={newEventAllDay}
										onChange={(e) => setNewEventAllDay(e.target.checked)}
										className="w-4 h-4 text-blue-600 rounded border-gray-300"
									/>
									<span>All day event</span>
								</label>

								{!newEventAllDay && (
									<input
										type="time"
										value={newEventTime}
										onChange={(e) => setNewEventTime(e.target.value)}
										className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
									/>
								)}
							</div>

							<button
								type="submit"
								disabled={!newEventTitle.trim() || addEventMutation.isPending}
								className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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