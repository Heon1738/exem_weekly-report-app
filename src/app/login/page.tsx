'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [members, setMembers] = useState<string[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [setupDone, setSetupDone] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      // 공개 엔드포인트 - 인증 없이 이름 목록만 반환
      const res = await fetch('/api/auth/members')
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      }
    } catch {}
  }

  const handleSetup = async () => {
    setInitializing(true)
    setError('')
    try {
      const res = await fetch('/api/setup', { method: 'POST' })
      if (res.ok) {
        setSetupDone(true)
        await fetchMembers()
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
      setError('이름과 PIN을 입력해주세요.')
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
        router.push('/daily')
      } else {
        setError(data.error || '로그인에 실패했습니다.')
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 초기화 완료됐지만 members가 아직 로딩 중인 상태
  const showLoginForm = members.length > 0

  return (
    <div className="min-h-screen bg-notion-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-2xl font-semibold text-notion-text">업무 보고 시스템</h1>
          <p className="text-sm text-notion-gray mt-1">팀 일일보고 &amp; 주간보고</p>
        </div>

        {!showLoginForm && !setupDone && (
          <div className="card text-center space-y-3">
            <p className="text-sm text-notion-gray">
              앱 초기 설정이 필요합니다.<br />
              Notion에 데이터베이스를 생성하고 기본 팀원을 등록합니다.
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleSetup}
              disabled={initializing}
              className="btn-primary w-full"
            >
              {initializing ? '초기화 중...' : '앱 초기화'}
            </button>
          </div>
        )}

        {!showLoginForm && setupDone && (
          <div className="card text-center space-y-3">
            <p className="text-sm text-green-600 font-medium">✓ 초기화 완료!</p>
            <p className="text-sm text-notion-gray">팀원 목록을 불러오는 중...</p>
            <button onClick={fetchMembers} className="btn-secondary w-full text-sm">
              새로고침
            </button>
          </div>
        )}

        {showLoginForm && (
          <form onSubmit={handleLogin} className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">이름 선택</label>
              <select
                value={selectedName}
                onChange={e => setSelectedName(e.target.value)}
                className="input-field"
                required
              >
                <option value="">-- 이름을 선택하세요 --</option>
                {members.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-notion-text mb-1.5">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="PIN을 입력하세요"
                className="input-field"
                maxLength={10}
                required
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
