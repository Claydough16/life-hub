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
			<div className="bg-white shadow-2xl rounded-2xl p-8 border-2 border-teal-100">
				{/* Logo/Header */}
				<div className="text-center mb-8">
					<div className="text-5xl mb-3">🌊</div>
					<h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent mb-2">
						Life Hub
					</h1>
					<p className="text-gray-600 text-sm">
						{isSignUp ? 'Create your account' : 'Welcome back!'}
					</p>
				</div>

				<form onSubmit={handleAuth} className="space-y-4">
					{isSignUp && (
						<div>
							<label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
								Name
							</label>
							<input
								id="name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 transition-all"
								placeholder="Your name"
							/>
						</div>
					)}

					<div>
						<label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 transition-all"
							placeholder="you@example.com"
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							minLength={6}
							className="w-full px-4 py-3 border-2 border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 transition-all"
							placeholder="••••••••"
						/>
						{isSignUp && (
							<p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
						)}
					</div>

					{message && (
						<div
							className={`p-4 rounded-lg text-sm font-medium ${message.type === 'error'
								? 'bg-red-50 text-red-700 border border-red-200'
								: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
								}`}
						>
							{message.text}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white py-3 rounded-lg hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
					>
						{loading ? (
							<span className="flex items-center justify-center gap-2">
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
								{isSignUp ? 'Creating account...' : 'Signing in...'}
							</span>
						) : (
							isSignUp ? 'Create Account' : 'Sign In'
						)}
					</button>
				</form>

				<div className="mt-6 text-center">
					<button
						onClick={() => {
							setIsSignUp(!isSignUp)
							setMessage(null)
						}}
						className="text-sm text-teal-600 hover:text-teal-700 font-medium hover:underline transition-colors"
					>
						{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
					</button>
				</div>
			</div>

			{/* Footer tagline */}
			<p className="text-center text-gray-500 text-sm mt-6">
				Organize your life together 🏠
			</p>
		</div>
	)
}