'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type AppState = 'loading' | 'not_initialized' | 'no_members' | 'ready'

export default function LoginPage() {
  const router = useRouter()
  const [appState, setAppState] = useState<AppState>('loading')
  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)

  // PIN 변경 화면
  const [changingPin, setChangingPin] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [pinChangeLoading, setPinChangeLoading] = useState(false)

  useEffect(() => { checkStatus() }, [])

  const checkStatus = async () => {
    setAppState('loading')
    try {
      const res = await fetch('/api/auth/members')
      if (res.ok) {
        const data = await res.json()
        if (!data.initialized) setAppState('not_initialized')
        else if (!data.hasMembers) setAppState('no_members')
        else setAppState('ready')
      } else {
        setAppState('not_initialized')
      }
    } catch {
      setAppState('not_initialized')
    }
  }

  const handleSetup = async () => {
    setInitializing(true)
    setError('')
    try {
      const res = await fetch('/api/setup', { method: 'POST' })
      if (res.ok) {
        await checkStatus()
      } else {
        const data = await res.json()
        setError(data.error || '초기화에 실패했습니다.')
      }
    } catch {
      setError('초기화 중 오류가 발생했습니다.')
    } finally {
      setInitializing(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginId.trim() || !pin) {
      setError('아이디와 PIN을 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: loginId.trim(), pin }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.mustChangePin) {
          setCurrentPin(pin)
          setChangingPin(true)
          setPin('')
        } else {
          router.push('/daily')
        }
      } else {
        setError(data.error || '로그인에 실패했습니다.')
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPin !== newPinConfirm) { setError('새 PIN이 일치하지 않습니다.'); return }
    if (newPin.length < 4) { setError('PIN은 4자리 이상이어야 합니다.'); return }
    if (newPin === '1234') { setError('1234는 사용할 수 없습니다.'); return }

    setPinChangeLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      })
      if (res.ok) {
        router.push('/daily')
      } else {
        const data = await res.json()
        setError(data.error || 'PIN 변경에 실패했습니다.')
      }
    } catch {
      setError('PIN 변경 중 오류가 발생했습니다.')
    } finally {
      setPinChangeLoading(false)
    }
  }

  // PIN 변경 화면
  if (changingPin) {
    return (
      <div className="min-h-screen bg-notion-sidebar flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-2xl font-semibold text-notion-text">PIN 변경 필요</h1>
            <p className="text-sm text-notion-gray mt-1">초기 PIN(1234)을 새로운 PIN으로 변경해주세요.</p>
          </div>
          <form onSubmit={handleChangePin} className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">새 PIN</label>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
                placeholder="새 PIN 입력 (4자리 이상)" className="input-field" maxLength={20} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">새 PIN 확인</label>
              <input type="password" value={newPinConfirm} onChange={e => setNewPinConfirm(e.target.value)}
                placeholder="새 PIN 다시 입력" className="input-field" maxLength={20} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={pinChangeLoading} className="btn-primary w-full">
              {pinChangeLoading ? '변경 중...' : 'PIN 변경 완료'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-notion-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-2xl font-semibold text-notion-text">업무 보고 시스템</h1>
          <p className="text-sm text-notion-gray mt-1">팀 일일보고 &amp; 주간보고</p>
        </div>

        {/* 로딩 */}
        {appState === 'loading' && (
          <div className="card text-center">
            <p className="text-sm text-notion-gray">확인 중...</p>
          </div>
        )}

        {/* 앱 초기화 필요 */}
        {appState === 'not_initialized' && (
          <div className="card text-center space-y-3">
            <p className="text-sm font-medium text-notion-text">앱 초기 설정이 필요합니다</p>
            <p className="text-xs text-notion-gray">Notion에 데이터베이스를 생성합니다.</p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={handleSetup} disabled={initializing} className="btn-primary w-full">
              {initializing ? '초기화 중...' : '앱 초기화'}
            </button>
          </div>
        )}

        {/* 초기화됐지만 계정 없음 */}
        {appState === 'no_members' && (
          <div className="card text-center space-y-3">
            <div className="text-3xl">🔒</div>
            <p className="text-sm font-medium text-notion-text">등록된 계정이 없습니다</p>
            <p className="text-sm text-notion-gray">
              팀장이 환경설정에서 계정을 생성해야 로그인할 수 있습니다.<br />
              팀장에게 계정 생성을 요청하세요.
            </p>
            <button onClick={checkStatus} className="btn-secondary w-full text-sm">새로고침</button>
          </div>
        )}

        {/* 로그인 폼 */}
        {appState === 'ready' && (
          <form onSubmit={handleLogin} className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">아이디</label>
              <input
                type="text"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="input-field"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="PIN을 입력하세요"
                className="input-field"
                maxLength={20}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
