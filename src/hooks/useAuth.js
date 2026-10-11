import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from 'Lib/supabase'

// `redirectTo`: where to send signed-out users (default '/login', used by the dashboard).
export function useAuth({ redirectTo = '/login' } = {}) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (!session?.user) {
        router.replace(redirectTo)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        router.replace(redirectTo)
      }
    })

    return () => subscription.unsubscribe()
  }, [router, redirectTo])

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace(redirectTo)
  }

  return { user, loading, logout }
}
