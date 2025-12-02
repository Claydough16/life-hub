'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface Task {
	id: string
	title: string
	description?: string
	assigned_to?: string
	due_date?: string
	priority: 'low' | 'medium' | 'high'
	status: 'todo' | 'in-progress' | 'done'
	project?: string
	created_by: string
	is_private: boolean
}

interface TasksProps {
	householdId: string
	userId: string
}

export function Tasks({ householdId, userId }: TasksProps) {
	const [newTaskTitle, setNewTaskTitle] = useState('')
	const [newTaskDueDate, setNewTaskDueDate] = useState('')
	const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
	const queryClient = useQueryClient()

	// Get tasks
	const { data: tasks = [], isLoading } = useQuery({
		queryKey: ['tasks', householdId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('tasks')
				.select('*')
				.eq('household_id', householdId)
				.order('due_date', { ascending: true, nullsFirst: false })

			if (error) throw error
			return data as Task[]
		},
	})

	// Add task mutation
	const addTaskMutation = useMutation({
		mutationFn: async () => {
			if (!newTaskTitle.trim()) return

			const { error } = await supabase.from('tasks').insert([
				{
					household_id: householdId,
					title: newTaskTitle.trim(),
					due_date: newTaskDueDate || null,
					priority: newTaskPriority,
					status: 'todo',
					created_by: userId,
					is_private: false,
				},
			])

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tasks', householdId] })
			setNewTaskTitle('')
			setNewTaskDueDate('')
			setNewTaskPriority('medium')
		},
	})

	// Update task status mutation
	const updateTaskStatusMutation = useMutation({
		mutationFn: async ({ taskId, newStatus }: { taskId: string; newStatus: Task['status'] }) => {
			const { error } = await supabase
				.from('tasks')
				.update({ status: newStatus })
				.eq('id', taskId)

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tasks', householdId] })
		},
	})

	// Delete task mutation
	const deleteTaskMutation = useMutation({
		mutationFn: async (taskId: string) => {
			const { error } = await supabase.from('tasks').delete().eq('id', taskId)
			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tasks', householdId] })
		},
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		addTaskMutation.mutate()
	}

	const handleStatusChange = (task: Task) => {
		let newStatus: Task['status']
		if (task.status === 'todo') newStatus = 'in-progress'
		else if (task.status === 'in-progress') newStatus = 'done'
		else newStatus = 'todo'

		updateTaskStatusMutation.mutate({ taskId: task.id, newStatus })
	}

	const getPriorityColor = (priority: Task['priority']) => {
		switch (priority) {
			case 'high':
				return 'text-red-600 bg-red-50'
			case 'medium':
				return 'text-yellow-600 bg-yellow-50'
			case 'low':
				return 'text-green-600 bg-green-50'
		}
	}

	const getStatusIcon = (status: Task['status']) => {
		switch (status) {
			case 'todo':
				return '⭕'
			case 'in-progress':
				return '🔄'
			case 'done':
				return '✅'
		}
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-gray-600">Loading tasks...</div>
			</div>
		)
	}

	const activeTasks = tasks.filter((task) => task.status !== 'done')
	const completedTasks = tasks.filter((task) => task.status === 'done')

	return (
		<div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 max-w-2xl mx-auto">
			{/* Header */}
			<div className="mb-6">
				<h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
					✓ Tasks
				</h2>
				<p className="text-sm text-gray-500 mt-1">
					Track your to-dos and projects
				</p>
			</div>

			{/* Add task form */}
			<form onSubmit={handleSubmit} className="mb-6">
				<div className="space-y-3">
					<div className="flex gap-2">
						<input
							type="text"
							value={newTaskTitle}
							onChange={(e) => setNewTaskTitle(e.target.value)}
							placeholder="What needs to be done?"
							className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
							autoFocus
						/>
						<button
							type="submit"
							disabled={!newTaskTitle.trim() || addTaskMutation.isPending}
							className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{addTaskMutation.isPending ? 'Adding...' : 'Add'}
						</button>
					</div>

					<div className="flex gap-2">
						<input
							type="date"
							value={newTaskDueDate}
							onChange={(e) => setNewTaskDueDate(e.target.value)}
							className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
						/>
						<select
							value={newTaskPriority}
							onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
							className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
						>
							<option value="low">Low Priority</option>
							<option value="medium">Medium Priority</option>
							<option value="high">High Priority</option>
						</select>
					</div>
				</div>
			</form>

			{/* Active tasks */}
			{activeTasks.length > 0 && (
				<div className="mb-6">
					<h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
						Active Tasks ({activeTasks.length})
					</h3>
					<div className="space-y-2">
						{activeTasks.map((task) => (
							<div
								key={task.id}
								className="group flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
							>
								<button
									onClick={() => handleStatusChange(task)}
									className="text-2xl hover:scale-110 transition-transform"
								>
									{getStatusIcon(task.status)}
								</button>

								<div className="flex-1 min-w-0">
									<div className="flex items-start gap-2 mb-1">
										<h4 className="font-medium text-gray-900 flex-1">{task.title}</h4>
										<span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
											{task.priority}
										</span>
									</div>

									{task.due_date && (
										<div className="text-sm text-gray-600 mb-1">
											📅 Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
										</div>
									)}

									<div className="text-xs text-gray-500">
										Status: <span className="font-medium">{task.status}</span>
									</div>
								</div>

								{task.created_by === userId && (
									<button
										onClick={() => deleteTaskMutation.mutate(task.id)}
										className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition-opacity"
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
			)}

			{/* Completed tasks */}
			{completedTasks.length > 0 && (
				<div className="border-t pt-6">
					<h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
						Completed ({completedTasks.length})
					</h3>
					<div className="space-y-2">
						{completedTasks.map((task) => (
							<div
								key={task.id}
								className="group flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors opacity-60"
							>
								<button
									onClick={() => handleStatusChange(task)}
									className="text-2xl hover:scale-110 transition-transform"
								>
									{getStatusIcon(task.status)}
								</button>

								<div className="flex-1 min-w-0">
									<h4 className="font-medium text-gray-900 line-through">{task.title}</h4>
									{task.due_date && (
										<div className="text-sm text-gray-600 mt-1">
											📅 {format(new Date(task.due_date), 'MMM d, yyyy')}
										</div>
									)}
								</div>

								{task.created_by === userId && (
									<button
										onClick={() => deleteTaskMutation.mutate(task.id)}
										className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition-opacity"
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
			)}

			{/* Empty state */}
			{tasks.length === 0 && (
				<div className="text-center py-12">
					<div className="text-6xl mb-4">✓</div>
					<p className="text-gray-600 text-lg mb-2">No tasks yet</p>
					<p className="text-gray-400 text-sm">
						Add your first task above to get started!
					</p>
				</div>
			)}

			{/* Stats footer */}
			{tasks.length > 0 && (
				<div className="mt-6 pt-4 border-t text-center">
					<p className="text-sm text-gray-500">
						{activeTasks.length === 0 ? (
							<span className="text-green-600 font-medium">
								🎉 All tasks completed!
							</span>
						) : (
							<>
								<span className="font-medium text-gray-700">{activeTasks.length}</span>{' '}
								{activeTasks.length === 1 ? 'task' : 'tasks'} remaining
							</>
						)}
					</p>
				</div>
			)}
		</div>
	)
}