'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export function AuthForm() {
	const [loading, setLoading] = useState(false)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [name, setName] = useState('')
	const [isSignUp, setIsSignUp] = useState(false)
	const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

	const handleAuth = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setMessage(null)

		try {
			if (isSignUp) {
				// Sign up
				const { error } = await supabase.auth.signUp({
					email,
					password,
					options: {
						data: {
							name,
						},
					},
				})

				if (error) throw error

				setMessage({
					type: 'success',
					text: 'Account created! Check your email to confirm, then sign in.'
				})
			} else {
				// Sign in
				const { error } = await supabase.auth.signInWithPassword({
					email,
					password,
				})

				if (error) throw error

				setMessage({ type: 'success', text: 'Signed in successfully!' })
			}
		} catch (error) {
			setMessage({ type: 'error', text: (error as Error).message })
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="w-full max-w-md">
			<div className="bg-white shadow-md rounded-lg p-8">
				<h2 className="text-2xl font-bold text-center mb-6 text-gray-700">
					{isSignUp ? 'Create Account' : 'Sign In'}
				</h2>

				<form onSubmit={handleAuth} className="space-y-4">
					{isSignUp && (
						<div>
							<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
								Name
							</label>
							<input
								id="name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
							/>
						</div>
					)}

					<div>
						<label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							minLength={6}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
						/>
					</div>

					{message && (
						<div
							className={`p-3 rounded-md text-sm ${message.type === 'error'
									? 'bg-red-50 text-red-700'
									: 'bg-green-50 text-green-700'
								}`}
						>
							{message.text}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
					>
						{loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
					</button>
				</form>

				<button
					onClick={() => {
						setIsSignUp(!isSignUp)
						setMessage(null)
					}}
					className="w-full mt-4 text-sm text-blue-600 hover:underline"
				>
					{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
				</button>
			</div>
		</div>
	)
}