'use client'

interface NavigationProps {
	activeTab: string
	onTabChange: (tab: string) => void
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
	const tabs = [
		{ id: 'grocery', label: 'Grocery', icon: '🛒' },
		{ id: 'notes', label: 'Notes', icon: '📝' },
		{ id: 'calendar', label: 'Calendar', icon: '📅' },
		{ id: 'tasks', label: 'Tasks', icon: '✓' },
	]

	return (
		<nav className="bg-white border-b border-gray-200">
			<div className="max-w-7xl mx-auto px-4">
				<div className="flex items-center justify-between h-16">
					{/* Logo/Brand */}
					<h1 className="text-xl font-bold text-gray-900">Life Hub</h1>

					{/* Tab Navigation */}
					<div className="flex gap-1">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => onTabChange(tab.id)}
								className={`
                    px-4 py-2 rounded-lg font-medium text-sm transition-colors
                    ${activeTab === tab.id
										? 'bg-blue-100 text-blue-700'
										: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
									}
                `}
							>
								<span className="hidden sm:inline mr-2">{tab.icon}</span>
								{tab.label}
							</button>
						))}
					</div>
				</div>
			</div>
		</nav>
	)
}