import { useEffect, useState } from 'react'

const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const POLL_INTERVAL_MS = 15_000

export function useBackendHealth(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
        if (!cancelled) setOnline(res.ok)
      } catch {
        if (!cancelled) setOnline(false)
      }
    }

    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return online
}
