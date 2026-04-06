'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload, LegendItem } from '@/types'

interface MemberItem {
  id: string
  name: string
  position: string
  department: string
  role: 'leader' | 'member'
}

interface Props {
  session: JwtPayload
}

export default function SettingsClient({ session }: Props) {
  const [activeTab, setActiveTab] = useState<'members' | 'legends' | 'notion'>('members')

  // 팀원
  const [members, setMembers] = useState<MemberItem[]>([])
  const [newMember, setNewMember] = useState({ name: '', position: '', department: '', role: 'member' as 'leader' | 'member', pin: '' })
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberMsg, setMemberMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 범례
  const [legends, setLegends] = useState<LegendItem[]>([])
  const [newLegend, setNewLegend] = useState('')
  const [legendLoading, setLegendLoading] = useState(false)
  const [legendMsg, setLegendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 설정
  const [settings, setSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchMembers()
    fetchLegends()
    fetchSettings()
  }, [])

  const fetchMembers = async () => {
    const res = await fetch('/api/settings/members')
    if (res.ok) setMembers(await res.json())
  }

  const fetchLegends = async () => {
    const res = await fetch('/api/settings/legends')
    if (res.ok) setLegends(await res.json())
  }

  const fetchSettings = async () => {
    const res = await fetch('/api/settings')
    if (res.ok) setSettings(await res.json())
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setMemberLoading(true)
    setMemberMsg(null)
    try {
      const res = await fetch('/api/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      })
      if (res.ok) {
        setMemberMsg({ type: 'success', text: '팀원이 추가되었습니다.' })
        setNewMember({ name: '', position: '', department: '', role: 'member', pin: '' })
        await fetchMembers()
      } else {
        const data = await res.json()
        setMemberMsg({ type: 'error', text: data.error })
      }
    } catch {
      setMemberMsg({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setMemberLoading(false)
    }
  }

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`"${name}" 팀원을 삭제하시겠습니까?`)) return
    await fetch('/api/settings/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await fetchMembers()
  }

  const handleAddLegend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLegend.trim()) return
    setLegendLoading(true)
    setLegendMsg(null)
    try {
      const res = await fetch('/api/settings/legends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLegend }),
      })
      if (res.ok) {
        setLegendMsg({ type: 'success', text: '범례가 추가되었습니다.' })
        setNewLegend('')
        await fetchLegends()
      } else {
        setLegendMsg({ type: 'error', text: '추가에 실패했습니다.' })
      }
    } catch {
      setLegendMsg({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setLegendLoading(false)
    }
  }

  const handleDeleteLegend = async (id: string, label: string) => {
    if (!confirm(`"${label}" 범례를 삭제하시겠습니까?`)) return
    await fetch('/api/settings/legends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await fetchLegends()
  }

  const tabs = [
    { id: 'members', label: '팀원 관리' },
    { id: 'legends', label: '지원 범례' },
    { id: 'notion', label: 'Notion 연동' },
  ] as const

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-notion-text mb-6">환경설정</h1>

        {/* 탭 */}
        <div className="flex border-b border-notion-border mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-notion-blue text-notion-blue'
                  : 'border-transparent text-notion-gray hover:text-notion-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 팀원 관리 */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* 현재 팀원 목록 */}
            <div className="card">
              <h2 className="text-sm font-semibold text-notion-text mb-3">등록된 팀원 ({members.length}명)</h2>
              {members.length === 0 ? (
                <p className="text-sm text-notion-gray">등록된 팀원이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between py-2 border-b border-notion-border last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-notion-text">{member.name}</span>
                          <span className="text-xs text-notion-gray">{member.position}</span>
                          {member.role === 'leader' && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">팀장</span>
                          )}
                        </div>
                        <p className="text-xs text-notion-gray mt-0.5">{member.department}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMember(member.id, member.name)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 팀원 추가 */}
            <div className="card">
              <h2 className="text-sm font-semibold text-notion-text mb-3">팀원 추가</h2>
              <form onSubmit={handleAddMember} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-notion-gray mb-1">이름 *</label>
                    <input value={newMember.name} onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))} className="input-field" placeholder="홍길동" required />
                  </div>
                  <div>
                    <label className="block text-xs text-notion-gray mb-1">직책</label>
                    <input value={newMember.position} onChange={e => setNewMember(p => ({ ...p, position: e.target.value }))} className="input-field" placeholder="과장" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-notion-gray mb-1">소속</label>
                  <input value={newMember.department} onChange={e => setNewMember(p => ({ ...p, department: e.target.value }))} className="input-field" placeholder="통합기술본부 > 통합기술연구3팀" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-notion-gray mb-1">역할</label>
                    <select value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value as 'leader' | 'member' }))} className="input-field">
                      <option value="member">팀원</option>
                      <option value="leader">팀장</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-notion-gray mb-1">PIN *</label>
                    <input type="password" value={newMember.pin} onChange={e => setNewMember(p => ({ ...p, pin: e.target.value }))} className="input-field" placeholder="로그인 PIN" required />
                  </div>
                </div>

                {memberMsg && (
                  <p className={`text-sm ${memberMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{memberMsg.text}</p>
                )}

                <button type="submit" disabled={memberLoading} className="btn-primary">
                  {memberLoading ? '추가 중...' : '팀원 추가'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 지원 범례 */}
        {activeTab === 'legends' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-sm font-semibold text-notion-text mb-1">고객사 지원 범례</h2>
              <p className="text-xs text-notion-gray mb-3">일일보고 작성 시 "고객사 지원 주요 내역"의 지원 종류 드롭다운에 표시됩니다.</p>
              {legends.length === 0 ? (
                <p className="text-sm text-notion-gray">등록된 범례가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-3">
                  {legends.map(l => (
                    <div key={l.id} className="flex items-center gap-1.5 bg-notion-gray-bg rounded-md px-2.5 py-1">
                      <span className="text-sm text-notion-text">{l.label}</span>
                      <button onClick={() => handleDeleteLegend(l.id, l.label)} className="text-notion-gray hover:text-red-500 transition-colors">×</button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddLegend} className="flex gap-2">
                <input value={newLegend} onChange={e => setNewLegend(e.target.value)} className="input-field flex-1" placeholder="새 범례 입력 (예: DB 점검)" />
                <button type="submit" disabled={legendLoading} className="btn-primary flex-shrink-0">
                  {legendLoading ? '추가 중...' : '추가'}
                </button>
              </form>

              {legendMsg && (
                <p className={`text-sm mt-2 ${legendMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{legendMsg.text}</p>
              )}
            </div>
          </div>
        )}

        {/* Notion 연동 */}
        {activeTab === 'notion' && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="text-sm font-semibold text-notion-text mb-3">Notion 연동 정보</h2>
              <div className="space-y-3">
                {[
                  { label: '팀 이름', key: 'teamName' },
                  { label: '본부 이름', key: 'divisionName' },
                  { label: '일일보고 DB ID', key: 'dailyDbId' },
                  { label: '팀원 설정 DB ID', key: 'membersDbId' },
                  { label: '범례 설정 DB ID', key: 'legendsDbId' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-xs text-notion-gray mb-1">{label}</label>
                    <input
                      type="text"
                      value={settings[key] || ''}
                      readOnly
                      className="input-field bg-notion-gray-bg font-mono text-xs cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card bg-notion-yellow-bg border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>참고:</strong> DB ID 및 Notion 토큰은 Vercel 환경 변수 또는 <code className="bg-yellow-100 px-1 rounded">.env.local</code>에서 설정합니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
