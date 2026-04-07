'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type AppState = 'loading' | 'not_initialized' | 'no_members' | 'ready'

export default function LoginPage() {
  const router = useRouter()
  const [appState, setAppState] = useState<AppState>('loading')
  const [memberNames, setMemberNames] = useState<string[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [loginRole, setLoginRole] = useState('')

  // 첫 번째 팀장 계정 생성
  const [firstName, setFirstName] = useState('')
  const [firstPosition, setFirstPosition] = useState('')
  const [firstDepartment, setFirstDepartment] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

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
      const res = await fetch(`/api/auth/members?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (!data.initialized) setAppState('not_initialized')
        else if (!data.hasMembers) setAppState('no_members')
        else {
          setMemberNames(data.names || [])
          if (data.names?.length > 0) setSelectedName(data.names[0])
          setAppState('ready')
        }
      } else {
        setAppState('not_initialized')
      }
    } catch {
      setAppState('not_initialized')
    }
  }

  const handleRegisterFirst = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register-first', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: firstName, position: firstPosition, department: firstDepartment }),
      })
      if (res.ok) {
        await checkStatus()
      } else {
        const data = await res.json()
        setError(data.error || '계정 생성에 실패했습니다.')
      }
    } catch {
      setError('계정 생성 중 오류가 발생했습니다.')
    } finally {
      setRegisterLoading(false)
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
    if (!selectedName || !pin) {
      setError('이름과 패스워드를 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedName, pin }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.mustChangePin) {
          setLoginRole(data.role || '')
          setCurrentPin(pin)
          setChangingPin(true)
          setPin('')
        } else {
          window.location.href = (data.role === 'leader' || data.role === 'admin') ? '/reports' : '/daily'
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
    if (newPin !== newPinConfirm) { setError('패스워드가 일치하지 않습니다.'); return }
    if (newPin.length < 4) { setError('패스워드는 4자리 이상이어야 합니다.'); return }
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
        window.location.href = (loginRole === 'leader' || loginRole === 'admin') ? '/reports' : '/daily'
      } else {
        const data = await res.json()
        setError(data.error || '패스워드 변경에 실패했습니다.')
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
            <h1 className="text-2xl font-semibold text-notion-text">패스워드 변경 필요</h1>
            <p className="text-sm text-notion-gray mt-1">초기 패스워드(1234)를 새로운 패스워드로 변경해주세요.</p>
          </div>
          <form onSubmit={handleChangePin} className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">새 패스워드</label>
              <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)}
                placeholder="새 패스워드 입력 (4자리 이상)" className="input-field" maxLength={20} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">새 패스워드 확인</label>
              <input type="password" value={newPinConfirm} onChange={e => setNewPinConfirm(e.target.value)}
                placeholder="새 패스워드 다시 입력" className="input-field" maxLength={20} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={pinChangeLoading} className="btn-primary w-full">
              {pinChangeLoading ? '변경 중...' : '패스워드 변경 완료'}
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
            <p className="text-xs text-notion-gray">데이터베이스를 초기화합니다.</p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={handleSetup} disabled={initializing} className="btn-primary w-full">
              {initializing ? '초기화 중...' : '앱 초기화'}
            </button>
          </div>
        )}

        {/* 초기화됐지만 계정 없음 — 첫 번째 팀장 계정 생성 */}
        {appState === 'no_members' && (
          <div className="card space-y-4">
            <div className="text-center">
              <div className="text-3xl mb-2">👤</div>
              <p className="text-sm font-medium text-notion-text">첫 번째 팀장 계정을 생성하세요</p>
              <p className="text-xs text-notion-gray mt-1">초기 패스워드는 1234이며, 로그인 후 변경할 수 있습니다.</p>
            </div>
            <form onSubmit={handleRegisterFirst} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-notion-text mb-1.5">이름</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="이름 입력" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-notion-text mb-1.5">직책</label>
                <input type="text" value={firstPosition} onChange={e => setFirstPosition(e.target.value)}
                  placeholder="예: 팀장, 수석 컨설턴트" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-notion-text mb-1.5">부서</label>
                <input type="text" value={firstDepartment} onChange={e => setFirstDepartment(e.target.value)}
                  placeholder="예: 기술지원팀" className="input-field" required />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={registerLoading} className="btn-primary w-full">
                {registerLoading ? '생성 중...' : '팀장 계정 생성'}
              </button>
            </form>
          </div>
        )}

        {/* 로그인 폼 */}
        {appState === 'ready' && (
          <form onSubmit={handleLogin} className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">이름</label>
              <select
                value={selectedName}
                onChange={e => setSelectedName(e.target.value)}
                className="input-field"
                required
              >
                {memberNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">패스워드</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="패스워드를 입력하세요"
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
