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
        // 설정 완료 후 앱 초기화 → 로그인
        const setupRes = await fetch('/api/setup', { method: 'POST' })
        if (setupRes.ok) {
          router.push('/login')
        } else {
          const setupData = await setupRes.json()
          setError(setupData.error || 'Notion DB 초기화에 실패했습니다.')
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
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-2xl font-semibold text-notion-text">Notion 연동 설정</h1>
          <p className="text-sm text-notion-gray mt-1">본인의 Notion 워크스페이스와 연결합니다</p>
        </div>

        {hasEnvConfig && !hasCustomConfig && (
          <div className="card mb-4 bg-green-50 border-green-200">
            <p className="text-sm text-green-700">
              <strong>현재 상태:</strong> 서버 환경 변수로 Notion이 연결되어 있습니다.
              아래 설정을 통해 본인의 Notion으로 전환할 수 있습니다.
            </p>
            <button onClick={() => router.push('/login')} className="mt-2 text-sm text-green-700 underline">
              기본 설정 사용하고 로그인 →
            </button>
          </div>
        )}

        {hasCustomConfig && (
          <div className="card mb-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>현재 상태:</strong> 개인 Notion 설정이 적용되어 있습니다.
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

        <div className="card">
          <h2 className="text-sm font-semibold text-notion-text mb-1">Notion 연동 정보 입력</h2>
          <p className="text-xs text-notion-gray mb-4">
            설정값은 본인의 브라우저 쿠키에 암호화되어 저장되며, 다른 사람과 공유되지 않습니다.
          </p>

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
                <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-notion-blue hover:underline">
                  notion.so/my-integrations
                </a>에서 내부 통합 토큰을 생성하세요.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-notion-text mb-1">
                Notion 부모 페이지 ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={parentPageId}
                onChange={e => setParentPageId(e.target.value)}
                placeholder="1f33d7eebe418013ac30dee162d0d7f2"
                className="input-field font-mono text-xs"
                required
              />
              <p className="text-xs text-notion-gray mt-1">
                앱 데이터를 저장할 Notion 페이지 URL 끝의 32자리 ID.
                해당 페이지에 위 통합을 연결(Connect)해야 합니다.
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '연결 확인 중...' : '저장 및 Notion 초기화'}
            </button>
          </form>
        </div>

        <div className="card mt-4 bg-notion-yellow-bg border-yellow-200">
          <p className="text-xs text-yellow-800 font-semibold mb-2">📋 Notion Integration 연동 방법 (팀장 1회 설정)</p>
          <ol className="text-xs text-yellow-800 space-y-1.5 list-decimal list-inside">
            <li><span className="font-medium">notion.so/my-integrations</span> → 새 Integration 생성 → Internal로 설정</li>
            <li>생성된 <span className="font-medium">Internal Integration Secret</span> 복사 → 위 토큰 입력란에 붙여넣기</li>
            <li>Notion에서 팀 공용 주간보고 페이지 생성</li>
            <li>해당 페이지 우상단 <span className="font-medium">···</span> → <span className="font-medium">Connections</span> → 생성한 Integration 연결</li>
            <li>페이지 URL 끝 32자리 ID 복사 → 위 부모 페이지 ID 입력란에 입력</li>
          </ol>
        </div>

        <div className="card mt-3 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-800 font-semibold mb-2">👤 개인 Notion 페이지 설정 방법 (팀원 각자)</p>
          <p className="text-xs text-blue-800 mb-1.5">주간보고를 개인 Notion 페이지로 내보내려면 추가 설정이 필요합니다.</p>
          <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
            <li>내 Notion에서 주간보고를 저장할 개인 페이지 생성</li>
            <li>해당 페이지 우상단 <span className="font-medium">···</span> → <span className="font-medium">Connections</span> → 팀 Integration 연결</li>
            <li>페이지 URL 끝 32자리 ID 복사<br/>
              <span className="font-mono bg-blue-100 px-1 rounded">예: notion.so/제목-1f33d7eebe418013ac30d → 1f33d7eebe418013ac30d...</span>
            </li>
            <li>앱 <span className="font-medium">환경설정 → 내 정보</span> 탭 → 개인 Notion 페이지 ID에 입력 후 저장</li>
          </ol>
          <p className="text-xs text-blue-700 mt-2">※ 개인 페이지 ID를 입력하지 않으면 팀 공용 페이지로 내보내집니다.</p>
        </div>
      </div>
    </div>
  )
}
