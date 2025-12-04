'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface Note {
	id: string
	title?: string
	content: string
	created_by: string
	is_private: boolean
	created_at: string
	updated_at: string
}

interface QuickNotesProps {
	householdId: string
	userId: string
}

export function QuickNotes({ householdId, userId }: QuickNotesProps) {
	const [newNoteContent, setNewNoteContent] = useState('')
	const [isPrivate, setIsPrivate] = useState(false)
	const queryClient = useQueryClient()
	const [confirmDialog, setConfirmDialog] = useState<{
		isOpen: boolean
		title: string
		message: string
		onConfirm: () => void
	} | null>(null)

	// Get notes
	const { data: notes = [], isLoading } = useQuery({
		queryKey: ['notes', householdId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('notes')
				.select('*')
				.eq('household_id', householdId)
				.order('created_at', { ascending: false })

			if (error) throw error
			return data as Note[]
		},
	})

	// Add note mutation
	const addNoteMutation = useMutation({
		mutationFn: async () => {
			if (!newNoteContent.trim()) return

			const { error } = await supabase.from('notes').insert([
				{
					household_id: householdId,
					content: newNoteContent.trim(),
					created_by: userId,
					is_private: isPrivate,
				},
			])

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notes', householdId] })
			setNewNoteContent('')
			setIsPrivate(false)
		},
	})

	// Delete note mutation
	const deleteNoteMutation = useMutation({
		mutationFn: async (noteId: string) => {
			const { error } = await supabase.from('notes').delete().eq('id', noteId)

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notes', householdId] })
		},
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		addNoteMutation.mutate()
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
		<div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-2xl mx-auto border border-teal-100">
			{/* Header */}
			<div className="mb-6">
				<h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
					📝 Quick Notes
				</h2>
				<p className="text-sm text-gray-500 mt-1">
					Jot down thoughts, ideas, or reminders
				</p>
			</div>

			{/* Add note form */}
			<form onSubmit={handleSubmit} className="mb-6">
				<div className="space-y-3">
					<textarea
						value={newNoteContent}
						onChange={(e) => setNewNoteContent(e.target.value)}
						placeholder="What's on your mind?"
						rows={3}
						className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none transition-all"
						autoFocus
					/>

					<div className="flex items-center justify-between">
						<label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900 transition-colors">
							<input
								type="checkbox"
								checked={isPrivate}
								onChange={(e) => setIsPrivate(e.target.checked)}
								className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
							/>
							<span className="flex items-center gap-1">
								<svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
								</svg>
								Private (Self only)
							</span>
						</label>

						<button
							type="submit"
							disabled={!newNoteContent.trim() || addNoteMutation.isPending}
							className="px-6 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium rounded-lg hover:from-teal-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
						>
							{addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
						</button>
					</div>
				</div>
			</form>

			{/* Notes list */}
			{notes.length > 0 ? (
				<div className="space-y-3">
					{notes.map((note) => (
						<div
							key={note.id}
							className="group border-2 border-teal-100 rounded-lg p-4 hover:border-teal-300 hover:shadow-md transition-all bg-gradient-to-br from-white to-teal-50/30"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex-1">
									<p className="text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
										{note.content}
									</p>
									<div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
										<span className="flex items-center gap-1">
											<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											{format(new Date(note.created_at), 'MMM d, h:mm a')}
										</span>
										{note.is_private && (
											<span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
												<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
													<path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
												</svg>
												Private
											</span>
										)}
									</div>
								</div>

								{note.created_by === userId && (
									<button
										onClick={() => setConfirmDialog({
											isOpen: true,
											title: 'Delete Note',
											message: `Are you sure you want to delete this note?`,
											onConfirm: () => {
												deleteNoteMutation.mutate(note.id)
												setConfirmDialog(null)
											}
										})}
										className="sm:opacity-0 sm:group-hover:opacity-100 text-red-600 hover:text-red-800 transition-all hover:scale-110 flex-shrink-0"
										title="Delete note"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="text-center py-12">
					<div className="text-6xl mb-4">📝</div>
					<p className="text-gray-600 text-lg mb-2 font-semibold">No notes yet</p>
					<p className="text-gray-400 text-sm">
						Start jotting down your thoughts above!
					</p>
				</div>
			)}

			{/* Stats footer */}
			{notes.length > 0 && (
				<div className="mt-6 pt-4 border-t border-teal-100 text-center">
					<p className="text-sm text-gray-500">
						<span className="font-semibold text-teal-700">{notes.length}</span>{' '}
						{notes.length === 1 ? 'note' : 'notes'} saved
					</p>
				</div>
			)}
			{/* Confirm Delete Dialog */}
			{confirmDialog && (
				<ConfirmDialog
					isOpen={confirmDialog.isOpen}
					title={confirmDialog.title}
					message={confirmDialog.message}
					onConfirm={confirmDialog.onConfirm}
					onCancel={() => setConfirmDialog(null)}
					isLoading={deleteNoteMutation.isPending}
				/>
			)}
		</div>
	)
}