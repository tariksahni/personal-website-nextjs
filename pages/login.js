import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from 'Lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace('/dashboard')
      }
    })
  }, [router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="tw-min-h-screen tw-bg-grey-50 tw-flex tw-items-center tw-justify-center tw-p-4" style={{ fontSize: '15px' }}>
      <div className="tw-w-full tw-max-w-sm">
        <div className="tw-text-center tw-mb-10">
          <div className="tw-inline-flex tw-items-center tw-justify-center tw-w-12 tw-h-12 tw-bg-purps-20 tw-border tw-border-purps-50 tw-rounded-xl tw-mb-4">
            <span className="tw-text-purps-500 tw-text-lg tw-font-bold">CC</span>
          </div>
          <h1 className="tw-text-xl tw-font-semibold tw-text-grey-900">Command Center</h1>
          <p className="tw-text-sm tw-text-grey-500 tw-mt-1">Sign in to your dashboard</p>
        </div>

        <div className="tw-bg-white tw-border tw-border-grey-200 tw-rounded-xl tw-p-6 tw-shadow-sm">
          <form onSubmit={handleLogin} className="tw-space-y-5">
            <div>
              <label className="tw-block tw-text-xs tw-font-medium tw-text-grey-600 tw-mb-1.5 tw-uppercase tw-tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="tw-w-full tw-px-3.5 tw-py-2.5 tw-bg-grey-50 tw-border tw-border-grey-200 tw-rounded-lg tw-text-grey-900 tw-text-sm focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all tw-placeholder-grey-400"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="tw-block tw-text-xs tw-font-medium tw-text-grey-600 tw-mb-1.5 tw-uppercase tw-tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="tw-w-full tw-px-3.5 tw-py-2.5 tw-bg-grey-50 tw-border tw-border-grey-200 tw-rounded-lg tw-text-grey-900 tw-text-sm focus:tw-outline-none focus:tw-border-purps-400 focus:tw-ring-1 focus:tw-ring-purps-100 tw-transition-all tw-placeholder-grey-400"
                placeholder="Your password"
                required
              />
            </div>
            {error && (
              <div className="tw-bg-warningred-100 tw-border tw-border-red-200 tw-rounded-lg tw-px-3.5 tw-py-2.5">
                <p className="tw-text-warningred-500 tw-text-sm">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="tw-w-full tw-py-2.5 tw-bg-purps-500 tw-text-white tw-font-semibold tw-rounded-lg tw-text-sm hover:tw-bg-purps-600 disabled:tw-opacity-50 tw-transition-all tw-shadow-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
