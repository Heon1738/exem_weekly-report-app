'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NotionSetupPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [parentPageId, setParentPageId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasEnvConfig, setHasEnvConfig] = useState(false)
  const [hasCustomConfig, setHasCustomConfig] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)

  useEffect(() => {
    fetch('/api/notion-setup').then(r => r.json()).then(d => {
      setHasEnvConfig(d.hasEnvConfig)
      setHasCustomConfig(d.hasCustomConfig)
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/notion-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, parentPageId }),
      })
      const data = await res.json()
      if (res.ok) {
        const setupRes = await fetch('/api/setup', { method: 'POST' })
        if (setupRes.ok) {
          router.push('/login')
        } else {
          const setupData = await setupRes.json()
          setError(setupData.error || 'DB 초기화에 실패했습니다.')
        }
      } else {
        setError(data.error || '설정 저장에 실패했습니다.')
      }
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('현재 Notion 설정을 초기화하시겠습니까?')) return
    setClearLoading(true)
    await fetch('/api/notion-setup', { method: 'DELETE' })
    setHasCustomConfig(false)
    setClearLoading(false)
  }

  return (
    <div className="min-h-screen bg-notion-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-2xl font-semibold text-notion-text">Notion 연동 설정</h1>
          <p className="text-sm text-notion-gray mt-1">팀 주간보고 데이터베이스와 연결합니다</p>
        </div>

        {hasEnvConfig && !hasCustomConfig && (
          <div className="card mb-4 bg-green-50 border-green-200">
            <p className="text-sm text-green-700">
              <strong>현재 상태:</strong> 서버 환경 변수로 Notion이 연결되어 있습니다.
            </p>
            <button onClick={() => router.push('/login')} className="mt-2 text-sm text-green-700 underline">
              기본 설정 사용하고 로그인 →
            </button>
          </div>
        )}

        {hasCustomConfig && (
          <div className="card mb-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>현재 상태:</strong> Notion 설정이 적용되어 있습니다.
            </p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => router.push('/login')} className="text-sm text-blue-700 underline">
                그대로 사용 →
              </button>
              <span className="text-blue-300">|</span>
              <button onClick={handleClear} disabled={clearLoading} className="text-sm text-red-500 underline">
                {clearLoading ? '초기화 중...' : '설정 초기화'}
              </button>
            </div>
          </div>
        )}

        {/* ── 팀 공용 설정 (팀장 1회) ── */}
        <div className="card mb-4">
          <p className="text-xs font-semibold text-notion-blue mb-3">👑 팀장 설정 (1회만)</p>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-notion-text mb-1">
                Notion Integration Token <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="secret_xxxxxxxxxxxxxxxxxxxx"
                className="input-field font-mono text-xs"
                required
              />
              <p className="text-xs text-notion-gray mt-1">
                <span className="font-mono">notion.so/my-integrations</span> → Internal Integration 생성 → Secret 복사
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-notion-text mb-1">
                팀 공용 주간보고 DB ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={parentPageId}
                onChange={e => setParentPageId(e.target.value)}
                placeholder="1f33d7eebe4181eaa60ad290ab162b40"
                className="input-field font-mono text-xs"
                required
              />
              <p className="text-xs text-notion-gray mt-1">
                팀 공용 주간보고 데이터베이스 ID. 개인 DB ID를 설정하지 않은 팀원은 여기로 내보내집니다.
              </p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '연결 확인 중...' : '저장 및 초기화'}
            </button>
          </form>
        </div>

        {/* ── Integration 설정 방법 ── */}
        <div className="card mb-3 bg-notion-yellow-bg border-yellow-200">
          <p className="text-xs font-semibold text-yellow-800 mb-2">📋 1단계: Integration 생성 및 DB 연결</p>
          <ol className="text-xs text-yellow-800 space-y-1.5 list-decimal list-inside">
            <li><span className="font-mono">notion.so/my-integrations</span> → <strong>New integration</strong> → Internal → 이름 입력 후 Submit</li>
            <li>생성된 <strong>Internal Integration Secret</strong> 복사 → 위 토큰 입력란에 붙여넣기</li>
            <li>Notion에서 주간보고 DB 열기 → 우상단 <strong>···</strong> → <strong>Connections</strong> → 생성한 Integration 연결</li>
            <li>DB URL에서 ID 복사 → 위 DB ID 입력란에 붙여넣기</li>
          </ol>
        </div>

        {/* ── DB ID 찾는 방법 ── */}
        <div className="card mb-3 bg-blue-50 border-blue-200">
          <p className="text-xs font-semibold text-blue-800 mb-2">🔍 DB ID 찾는 방법</p>
          <p className="text-xs text-blue-800 mb-2">Notion에서 주간보고 데이터베이스를 열면 URL이 아래처럼 보입니다:</p>
          <p className="text-xs font-mono bg-blue-100 px-2 py-1.5 rounded mb-2 break-all">
            notion.so/<span className="font-bold text-blue-900">1f33d7eebe4181eaa60ad290ab162b40</span>?v=...
          </p>
          <p className="text-xs text-blue-800"><span className="font-mono">?v=</span> 앞의 굵은 부분 32자리가 DB ID입니다.</p>
          <p className="text-xs text-blue-700 mt-2">※ DB가 아닌 일반 페이지 URL이라면: <span className="font-mono">notion.so/제목-<strong>32자리</strong></span> 형태의 마지막 32자리</p>
        </div>

        {/* ── Notion 내보내기 연동 흐름 ── */}
        <div className="card mb-3 bg-gray-50 border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">🔄 Notion 내보내기 동작 방식</p>
          <p className="text-xs text-gray-700 mb-2">
            주간보고 화면에서 <strong>Notion 내보내기</strong>를 누르면 아래 우선순위로 DB를 결정합니다:
          </p>
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside mb-2">
            <li><strong>개인 DB ID</strong>가 설정되어 있으면 → 개인 DB에 내보내기</li>
            <li>개인 DB ID가 없으면 → <strong>팀 공용 DB ID</strong> (위에서 팀장이 설정한 값)에 내보내기</li>
          </ol>
          <p className="text-xs text-gray-600">
            ※ 토큰도 마찬가지: 개인 토큰이 있으면 개인 토큰 사용, 없으면 팀 공용 토큰 사용
          </p>
        </div>

        {/* ── 팀원 개인 설정 안내 ── */}
        <div className="card bg-purple-50 border-purple-200">
          <p className="text-xs font-semibold text-purple-800 mb-2">👤 팀원 개인 설정 (각자 진행)</p>
          <p className="text-xs text-purple-800 mb-2">
            별도 워크스페이스를 사용하거나 개인 주간보고 DB가 있는 팀원은 아래 방법으로 개인 설정을 추가합니다.
          </p>
          <ol className="text-xs text-purple-800 space-y-1.5 list-decimal list-inside">
            <li>내 Notion에서 주간보고 DB 열기 (없으면 새로 생성)</li>
            <li>DB에 필수 속성 추가:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                <li><span className="font-mono font-bold">주간보고서 (클릭)</span> — 제목(Title) 형식</li>
                <li><span className="font-mono font-bold">보고 기간</span> — 날짜(Date) 형식</li>
                <li><span className="font-mono font-bold">작성 일자</span> — 날짜(Date) 형식</li>
                <li><span className="font-mono font-bold">작성자</span> — 텍스트(Text) 형식</li>
              </ul>
            </li>
            <li>DB에 팀 Integration 연결 (···→ Connections)</li>
            <li>DB ID 복사 (위의 <strong>DB ID 찾는 방법</strong> 참고)</li>
            <li>앱 <strong>환경설정 → 내 정보 탭</strong> → <strong>개인 Notion 주간보고 DB ID</strong> 입력 후 저장</li>
            <li>별도 워크스페이스라면: 직접 Integration 생성 후 <strong>개인 Notion Integration 토큰</strong>도 함께 입력</li>
          </ol>
          <div className="mt-3 p-2 bg-purple-100 rounded text-xs text-purple-900">
            <strong>저장 후 확인:</strong> 주간보고 화면 → Notion 내보내기 → 내 개인 DB에 항목이 생성되면 성공
          </div>
        </div>
      </div>
    </div>
  )
}
