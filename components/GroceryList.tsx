'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface ListItem {
	id: string
	text: string
	is_completed: boolean
	quantity?: string
	added_by?: string
}

interface GroceryListProps {
	householdId: string
	userId: string
}

export function GroceryList({ householdId, userId }: GroceryListProps) {
	const [newItemText, setNewItemText] = useState('')
	const [newItemQuantity, setNewItemQuantity] = useState('')
	const [showQuantityDialog, setShowQuantityDialog] = useState(false)
	const [pendingItemText, setPendingItemText] = useState('')
	const [showPreviousWeek, setShowPreviousWeek] = useState(false)
	const [showFrequent, setShowFrequent] = useState(false)
	const queryClient = useQueryClient()
	const [confirmDialog, setConfirmDialog] = useState<{
		isOpen: boolean
		title: string
		message: string
		onConfirm: () => void
	} | null>(null)

	// Get or create grocery list
	const { data: list, isLoading: listLoading } = useQuery({
		queryKey: ['grocery-list', householdId],
		queryFn: async () => {
			// Try to find existing grocery list
			const { data: existingLists } = await supabase
				.from('lists')
				.select('*')
				.eq('household_id', householdId)
				.eq('type', 'grocery')
				.limit(1)

			if (existingLists && existingLists.length > 0) {
				return existingLists[0]
			}

			// Create new grocery list if none exists
			const { data: newList, error } = await supabase
				.from('lists')
				.insert([
					{
						household_id: householdId,
						name: 'Grocery List',
						type: 'grocery',
						created_by: userId,
					},
				])
				.select()
				.single()

			if (error) throw error
			return newList
		},
	})

	// Get list items
	const { data: items = [], isLoading: itemsLoading } = useQuery({
		queryKey: ['list-items', list?.id],
		queryFn: async () => {
			if (!list?.id) return []

			const { data, error } = await supabase
				.from('list_items')
				.select('*')
				.eq('list_id', list.id)
				.order('created_at', { ascending: true })

			if (error) throw error
			return data as ListItem[]
		},
		enabled: !!list?.id,
	})

	// Get last week's items (Previously Ordered)
	const { data: previousWeekItems = [] } = useQuery({
		queryKey: ['previous-week-items', list?.id],
		queryFn: async () => {
			if (!list?.id) return []

			// Get the most recent week_start from history
			const { data: latestWeek } = await supabase
				.from('list_history')
				.select('week_start')
				.eq('list_id', list.id)
				.order('week_start', { ascending: false })
				.limit(1)
				.single()

			if (!latestWeek) return []

			// Get all items from that week
			const { data, error } = await supabase
				.from('list_history')
				.select('text, quantity')
				.eq('list_id', list.id)
				.eq('week_start', latestWeek.week_start)
				.order('text', { ascending: true })

			if (error) throw error

			// Deduplicate items - keep the first occurrence of each unique text
			const uniqueItems = (data || []).filter(
				(item, index, self) =>
					index === self.findIndex((t) => t.text.toLowerCase() === item.text.toLowerCase())
			)

			return uniqueItems
		},
		enabled: !!list?.id,
	})

	// Get frequently bought items (from all history)
	const { data: frequentItems = [] } = useQuery({
		queryKey: ['frequent-items', list?.id],
		queryFn: async () => {
			if (!list?.id) return []

			const { data: historyData, error } = await supabase
				.from('list_history')
				.select('text')
				.eq('list_id', list.id)

			if (error) throw error

			// Count occurrences and track original casing
			const counts: { [key: string]: number } = {}
			const textMap: { [key: string]: string } = {}

			historyData?.forEach((historyItem) => {
				const lowerText = historyItem.text.toLowerCase().trim()
				counts[lowerText] = (counts[lowerText] || 0) + 1
				if (!textMap[lowerText]) {
					textMap[lowerText] = historyItem.text.trim() // Store original casing
				}
			})

			// Get top 8 most frequent (appeared 2+ times)
			const frequent = Object.entries(counts)
				.filter(([_, count]) => count >= 2)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 8)
				.map(([lowerText]) => textMap[lowerText]) // Use original casing

			return frequent
		},
		enabled: !!list?.id,
	})

	// Add item mutation
	const addItemMutation = useMutation({
		mutationFn: async ({ text, quantity }: { text: string; quantity?: string }) => {
			if (!list?.id || !text.trim()) return

			const { error } = await supabase.from('list_items').insert([
				{
					list_id: list.id,
					text: text.trim(),
					quantity: quantity?.trim() || null,
					added_by: userId,
				},
			])

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['list-items', list?.id] })
			setNewItemText('')
			setNewItemQuantity('')
			setPendingItemText('')
			setShowQuantityDialog(false)
		},
	})

	// Toggle item mutation
	const toggleItemMutation = useMutation({
		mutationFn: async (item: ListItem) => {
			const { error } = await supabase
				.from('list_items')
				.update({ is_completed: !item.is_completed })
				.eq('id', item.id)

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['list-items', list?.id] })
		},
	})

	// Delete item mutation
	const deleteItemMutation = useMutation({
		mutationFn: async (itemId: string) => {
			const { error } = await supabase
				.from('list_items')
				.delete()
				.eq('id', itemId)

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['list-items', list?.id] })
		},
	})

	// Clear all completed items mutation
	const clearCompletedMutation = useMutation({
		mutationFn: async () => {
			if (!list?.id) return

			const completedIds = items
				.filter((item) => item.is_completed)
				.map((item) => item.id)

			const { error } = await supabase
				.from('list_items')
				.delete()
				.in('id', completedIds)

			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['list-items', list?.id] })
		},
	})

	// Start fresh for the week - move completed items to history
	const startFreshMutation = useMutation({
		mutationFn: async () => {
			if (!list?.id) return

			const completedItems = items.filter((item) => item.is_completed)
			if (completedItems.length === 0) return

			// Get start of current week (Sunday)
			const today = new Date()
			const dayOfWeek = today.getDay()
			const weekStart = new Date(today)
			weekStart.setDate(today.getDate() - dayOfWeek)
			weekStart.setHours(0, 0, 0, 0)

			// Move completed items to history
			const historyItems = completedItems.map((item) => ({
				list_id: list.id,
				text: item.text,
				quantity: item.quantity,
				week_start: weekStart.toISOString().split('T')[0],
				added_by: item.added_by,
				completed_at: new Date().toISOString(),
			}))

			const { error: historyError } = await supabase
				.from('list_history')
				.insert(historyItems)

			if (historyError) throw historyError

			// Delete completed items
			const completedIds = completedItems.map((item) => item.id)
			const { error: deleteError } = await supabase
				.from('list_items')
				.delete()
				.in('id', completedIds)

			if (deleteError) throw deleteError
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['list-items', list?.id] })
			queryClient.invalidateQueries({ queryKey: ['previous-week-items', list?.id] })
			queryClient.invalidateQueries({ queryKey: ['frequent-items', list?.id] })
		},
	})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()

		// If no quantity provided, show dialog
		if (!newItemQuantity.trim()) {
			setPendingItemText(newItemText)
			setShowQuantityDialog(true)
			return
		}

		// Otherwise add directly
		addItemMutation.mutate({ text: newItemText, quantity: newItemQuantity })
	}

	const handleQuantityDialogSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		addItemMutation.mutate({
			text: pendingItemText,
			quantity: newItemQuantity.trim() || undefined
		})
	}

	const handleSkipQuantity = () => {
		addItemMutation.mutate({ text: pendingItemText })
	}

	if (listLoading || itemsLoading) {
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

	const activeItems = items.filter((item) => !item.is_completed)
	const completedItems = items.filter((item) => item.is_completed)

	return (
		<>
			<div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-2xl mx-auto border border-teal-100">
				{/* Header */}
				<div className="mb-6">
					<h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent flex items-center gap-2">
						🛒 Grocery List
					</h2>
				</div>

				{/* Add item form */}
				<form onSubmit={handleSubmit} className="mb-6">
					<div className="flex gap-2">
						<input
							type="text"
							value={newItemText}
							onChange={(e) => setNewItemText(e.target.value)}
							placeholder="Add item..."
							className="flex-1 px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition-all"
							autoFocus
						/>
						<button
							type="submit"
							disabled={!newItemText.trim() || addItemMutation.isPending}
							className="px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium rounded-lg hover:from-teal-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
						>
							{addItemMutation.isPending ? 'Adding...' : 'Add'}
						</button>
					</div>
				</form>

				{/* Previously Ordered - Last Week's Items (Collapsible) */}
				{previousWeekItems.length > 0 && (
					<div className="mb-6">
						<button
							onClick={() => setShowPreviousWeek(!showPreviousWeek)}
							className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border-2 border-teal-200 hover:border-teal-300 transition-all"
						>
							<div className="flex items-center gap-3">
								<span className="text-2xl">📋</span>
								<div className="text-left">
									<h3 className="text-sm font-bold text-teal-700 uppercase tracking-wider">
										Previously Ordered
									</h3>
									<p className="text-xs text-teal-600">Last week&apos;s items ({previousWeekItems.length})</p>
								</div>
							</div>
							<svg
								className={`w-5 h-5 text-teal-600 transition-transform ${showPreviousWeek ? 'rotate-180' : ''}`}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{showPreviousWeek && (
							<div className="mt-3 p-4 bg-teal-50/50 rounded-lg border-2 border-teal-100">
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
									{previousWeekItems.map((prevItem, index) => (
										<button
											key={`prev-${index}`}
											onClick={() => {
												setNewItemText(prevItem.text)
												setNewItemQuantity(prevItem.quantity || '')
												setPendingItemText(prevItem.text)
												setShowQuantityDialog(true)
											}}
											className="px-3 py-2 bg-white border-2 border-teal-200 text-gray-900 font-medium rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all text-sm text-left flex items-center gap-2 disabled:opacity-50"
										>
											<span className="text-teal-600 font-bold">+</span>
											<span className="truncate">
												{prevItem.quantity && <span className="text-teal-600 mr-1">{prevItem.quantity}×</span>}
												{prevItem.text}
											</span>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{/* Frequently Bought - All-Time Popular (Collapsible) */}
				{frequentItems.length > 0 && (
					<div className="mb-6">
						<button
							onClick={() => setShowFrequent(!showFrequent)}
							className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-emerald-50 rounded-lg border-2 border-cyan-200 hover:border-cyan-300 transition-all"
						>
							<div className="flex items-center gap-3">
								<span className="text-2xl">⚡</span>
								<div className="text-left">
									<h3 className="text-sm font-bold text-cyan-700 uppercase tracking-wider">
										Frequently Bought
									</h3>
									<p className="text-xs text-cyan-600">Your go-to items ({frequentItems.length})</p>
								</div>
							</div>
							<svg
								className={`w-5 h-5 text-cyan-600 transition-transform ${showFrequent ? 'rotate-180' : ''}`}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{showFrequent && (
							<div className="mt-3 p-4 bg-cyan-50/50 rounded-lg border-2 border-cyan-100">
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
									{frequentItems.map((itemText) => (
										<button
											key={itemText}
											onClick={() => {
												// Capitalize first letter for display
												const capitalizedText = itemText.charAt(0).toUpperCase() + itemText.slice(1)
												setNewItemText(capitalizedText)
												setNewItemQuantity('')
												setPendingItemText(capitalizedText)
												setShowQuantityDialog(true)
											}}
											className="px-3 py-2 bg-white border-2 border-cyan-200 text-gray-900 font-medium rounded-lg hover:border-cyan-300 hover:bg-cyan-50 transition-all text-sm capitalize flex items-center gap-2 disabled:opacity-50"
										>
											<span className="text-cyan-600 font-bold">+</span>
											<span className="truncate">{itemText}</span>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{/* Active items */}
				{activeItems.length > 0 && (
					<div className="mb-6">
						<h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
							To Buy ({activeItems.length})
						</h3>
						<div className="space-y-1">
							{activeItems.map((item) => (
								<div
									key={item.id}
									className="group flex items-center gap-3 p-3 hover:bg-teal-50 rounded-lg transition-colors"
								>
									<input
										type="checkbox"
										checked={false}
										onChange={() => toggleItemMutation.mutate(item)}
										className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 focus:ring-2 cursor-pointer"
									/>
									<span className="flex-1 text-gray-900 font-medium">
										{item.quantity && (
											<span className="text-teal-600 font-bold mr-2">
												{item.quantity}×
											</span>
										)}
										{item.text}
									</span>
									<button
										onClick={() => setConfirmDialog({
											isOpen: true,
											title: 'Delete Item',
											message: `Are you sure you want to delete "${item.text}"?`,
											onConfirm: () => {
												deleteItemMutation.mutate(item.id)
												setConfirmDialog(null)
											}
										})}
										className="sm:opacity-0 sm:group-hover:opacity-100 text-red-600 hover:text-red-800 transition-all hover:scale-110 flex-shrink-0"
										title="Delete item"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Completed items */}
				{completedItems.length > 0 && (
					<div className="border-t border-teal-100 pt-6">
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
								Completed ({completedItems.length})
							</h3>
							<div className="flex gap-2">
								<button
									onClick={() => {
										if (confirm('Move all completed items to history and start fresh for this week?')) {
											startFreshMutation.mutate()
										}
									}}
									disabled={startFreshMutation.isPending}
									className="text-xs bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-3 py-1 rounded-full font-medium hover:from-teal-700 hover:to-cyan-700 transition-all disabled:opacity-50"
								>
									{startFreshMutation.isPending ? 'Starting Fresh...' : '🔄 Start Fresh'}
								</button>
								<button
									onClick={() => clearCompletedMutation.mutate()}
									disabled={clearCompletedMutation.isPending}
									className="text-xs text-red-600 hover:text-red-800 font-medium underline disabled:opacity-50"
								>
									Clear All
								</button>
							</div>
						</div>
						<div className="space-y-1">
							{completedItems.map((item) => (
								<div
									key={item.id}
									className="group flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
								>
									<input
										type="checkbox"
										checked={true}
										onChange={() => toggleItemMutation.mutate(item)}
										className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 focus:ring-2 cursor-pointer"
									/>
									<span className="flex-1 text-gray-500 line-through">
										{item.quantity && (
											<span className="mr-2">{item.quantity}×</span>
										)}
										{item.text}
									</span>
									<button
										onClick={() => setConfirmDialog({
											isOpen: true,
											title: 'Delete Item',
											message: `Are you sure you want to delete "${item.text}"?`,
											onConfirm: () => {
												deleteItemMutation.mutate(item.id)
												setConfirmDialog(null)
											}
										})}
										className="sm:opacity-0 sm:group-hover:opacity-100 text-red-600 hover:text-red-800 transition-all hover:scale-110 flex-shrink-0"
										title="Delete item"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Empty state */}
				{items.length === 0 && (
					<div className="text-center py-12">
						<div className="text-6xl mb-4">🛒</div>
						<p className="text-gray-600 text-lg mb-2 font-semibold">Your grocery list is empty</p>
						<p className="text-gray-400 text-sm">
							Add your first item above to get started!
						</p>
					</div>
				)}

				{/* Stats footer */}
				{items.length > 0 && (
					<div className="mt-6 pt-4 border-t border-teal-100 text-center">
						<p className="text-sm text-gray-500">
							{activeItems.length === 0 ? (
								<span className="text-emerald-600 font-semibold flex items-center justify-center gap-2">
									🎉 All items checked off!
								</span>
							) : (
								<>
									<span className="font-semibold text-teal-700">{activeItems.length}</span>{' '}
									{activeItems.length === 1 ? 'item' : 'items'} left to buy
								</>
							)}
						</p>
					</div>
				)}
			</div>

			{/* Quantity Dialog */}
			{showQuantityDialog && (
				<div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative border-2 border-teal-200">
						{/* Close X button */}
						<button
							onClick={() => {
								setShowQuantityDialog(false)
								setNewItemQuantity('')
								setPendingItemText('')
							}}
							className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
						>
							<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>

						<h3 className="text-xl font-bold mb-4 text-gray-900">Add Quantity?</h3>
						<p className="text-gray-600 mb-4">
							How many <span className="font-semibold text-teal-600">{pendingItemText}</span> do you need?
						</p>

						<form onSubmit={handleQuantityDialogSubmit} className="space-y-4">
							<input
								type="text"
								value={newItemQuantity}
								onChange={(e) => setNewItemQuantity(e.target.value)}
								placeholder="e.g., 2, 1 lb, 3 cans"
								className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
								autoFocus
							/>

							<div className="flex gap-2">
								<button
									type="button"
									onClick={handleSkipQuantity}
									className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
								>
									Skip
								</button>
								<button
									type="submit"
									className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg hover:from-teal-700 hover:to-cyan-700 font-medium shadow-md hover:shadow-lg transition-all"
								>
									Add Item
								</button>
							</div>
						</form>
					</div>
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
					isLoading={deleteItemMutation.isPending}
				/>
			)}
		</>
	)
}