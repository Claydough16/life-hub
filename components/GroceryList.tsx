'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface ListItem {
	id: string
	text: string
	is_completed: boolean
	quantity?: string
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
	const queryClient = useQueryClient()

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
										onClick={() => deleteItemMutation.mutate(item.id)}
										className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-sm font-medium transition-opacity"
									>
										Delete
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
							<button
								onClick={() => clearCompletedMutation.mutate()}
								disabled={clearCompletedMutation.isPending}
								className="text-xs text-red-600 hover:text-red-800 font-medium underline disabled:opacity-50"
							>
								Clear All
							</button>
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
										onClick={() => deleteItemMutation.mutate(item.id)}
										className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-sm font-medium transition-opacity"
									>
										Delete
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
		</>
	)
}