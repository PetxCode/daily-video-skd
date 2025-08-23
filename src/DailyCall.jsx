import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Simple hook to create a room via our backend
async function createRoom() {
  const resp = await fetch('/api/create-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expMinutes: 120, privacy: 'public' }),
  })
  if (!resp.ok) throw new Error('Failed to create room')
  const { room } = await resp.json()
  return room
}

export default function DailyCall({ domain }) {
  const [roomUrl, setRoomUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const iframeRef = useRef(null)

  const prebuiltUrl = useMemo(() => {
    if (!domain || !roomUrl) return ''
    // Daily Prebuilt embedding URL
    return `https://${domain}/${roomUrl.name}`
  }, [domain, roomUrl])

  const startCall = useCallback(async () => {
    try {
      setLoading(true)
      const room = await createRoom()
      setRoomUrl(room)
    } catch (e) {
      console.error(e)
      alert('Error creating room. Check backend logs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Resize iframe to fill container
    const onResize = () => {
      if (!iframeRef.current) return
      iframeRef.current.style.height = `${window.innerHeight - 120}px`
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <h2>Daily Video Call</h2>
      {!roomUrl ? (
        <button onClick={startCall} disabled={loading}>
          {loading ? 'Creating room...' : 'Start a call'}
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
            Room: {prebuiltUrl}
          </div>
          <iframe
            ref={iframeRef}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            src={prebuiltUrl}
            style={{ width: '100%', height: '70vh', border: 0, borderRadius: 8 }}
            title="Daily Prebuilt"
          />
        </div>
      )}
    </div>
  )
}