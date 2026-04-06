'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload, LegendItem } from '@/types'

interface MemberItem {
  id: string
  loginId: string
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
  const [newMember, setNewMember] = useState({ loginId: '', name: '', position: '', department: '', role: 'member' as 'leader' | 'member' })
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberMsg, setMemberMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 인라인 편집
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ loginId: '', position: '', department: '', role: 'member' as 'leader' | 'member', pin: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 범례
  const [legends, setLegends] = useState<LegendItem[]>([])
  const [newLegend, setNewLegend] = useState('')
  const [legendLoading, setLegendLoading] = useState(false)
  const [legendMsg, setLegendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 설정
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [teamName, setTeamName] = useState('')
  const [divisionName, setDivisionName] = useState('')
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgMsg, setOrgMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    if (res.ok) {
      const data = await res.json()
      setSettings(data)
      setTeamName(data.teamName || '')
      setDivisionName(data.divisionName || '')
    }
  }

  const handleSaveOrgNames = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrgSaving(true)
    setOrgMsg(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, divisionName }),
      })
      if (res.ok) {
        setOrgMsg({ type: 'success', text: '저장되었습니다.' })
        await fetchSettings()
      } else {
        setOrgMsg({ type: 'error', text: '저장에 실패했습니다.' })
      }
    } catch {
      setOrgMsg({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setOrgSaving(false)
    }
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
        setMemberMsg({ type: 'success', text: '팀원이 추가되었습니다. 초기 패스워드는 1234입니다.' })
        setNewMember({ loginId: '', name: '', position: '', department: '', role: 'member' })
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

  const handleStartEdit = (member: MemberItem) => {
    setEditingId(member.id)
    setEditForm({ loginId: member.loginId, position: member.position, department: member.department, role: member.role, pin: '' })
    setEditMsg(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditMsg(null)
  }

  const handleSaveEdit = async (id: string) => {
    setEditLoading(true)
    setEditMsg(null)

    // 팀장으로 변경 시 기존 팀장 있는지 확인
    if (editForm.role === 'leader') {
      const currentMember = members.find(m => m.id === id)
      const hasOtherLeader = members.some(m => m.role === 'leader' && m.id !== id)
      if (hasOtherLeader && currentMember?.role !== 'leader') {
        setEditMsg({ type: 'error', text: '팀장은 1명만 설정할 수 있습니다.' })
        setEditLoading(false)
        return
      }
    }

    try {
      const body: Record<string, string> = {
        id,
        loginId: editForm.loginId,
        position: editForm.position,
        department: editForm.department,
        role: editForm.role,
      }
      if (editForm.pin.trim()) body.pin = editForm.pin

      const res = await fetch('/api/settings/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEditMsg({ type: 'success', text: '수정되었습니다.' })
        setEditingId(null)
        await fetchMembers()
      } else {
        const data = await res.json()
        setEditMsg({ type: 'error', text: data.error || '수정에 실패했습니다.' })
      }
    } catch {
      setEditMsg({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setEditLoading(false)
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

  const leaderCount = members.filter(m => m.role === 'leader').length

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
                <div className="space-y-3">
                  {members.map(member => (
                    <div key={member.id}>
                      {editingId === member.id ? (
                        /* 인라인 편집 폼 */
                        <div className="border border-notion-blue rounded-lg p-3 bg-notion-blue-bg space-y-3">
                          <p className="text-sm font-medium text-notion-text">{member.name} 수정</p>
                          <div>
                            <label className="block text-xs text-notion-gray mb-1">아이디 <span className="text-red-400">*</span></label>
                            <input
                              value={editForm.loginId}
                              onChange={e => setEditForm(f => ({ ...f, loginId: e.target.value }))}
                              className="input-field text-sm"
                              placeholder="로그인 시 사용할 아이디"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-notion-gray mb-1">직책</label>
                              <input
                                value={editForm.position}
                                onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                                className="input-field text-sm"
                                placeholder="예: 과장"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-notion-gray mb-1">역할</label>
                              <select
                                value={editForm.role}
                                onChange={e => setEditForm(f => ({ ...f, role: e.target.value as 'leader' | 'member' }))}
                                className="input-field text-sm"
                              >
                                <option value="member">팀원</option>
                                <option value="leader" disabled={leaderCount >= 1 && member.role !== 'leader'}>
                                  팀장{leaderCount >= 1 && member.role !== 'leader' ? ' (이미 지정됨)' : ''}
                                </option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-notion-gray mb-1">소속</label>
                            <input
                              value={editForm.department}
                              onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                              className="input-field text-sm"
                              placeholder="예: 통합기술본부 > 통합기술연구3팀"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-notion-gray mb-1">새 패스워드 <span className="text-notion-gray font-normal">(변경 시에만 입력)</span></label>
                            <input
                              type="password"
                              value={editForm.pin}
                              onChange={e => setEditForm(f => ({ ...f, pin: e.target.value }))}
                              className="input-field text-sm"
                              placeholder="변경하지 않으면 비워두세요"
                            />
                          </div>
                          {editMsg && (
                            <p className={`text-xs ${editMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{editMsg.text}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(member.id)}
                              disabled={editLoading}
                              className="btn-primary text-sm py-1.5"
                            >
                              {editLoading ? '저장 중...' : '저장'}
                            </button>
                            <button onClick={handleCancelEdit} className="btn-secondary text-sm py-1.5">취소</button>
                          </div>
                        </div>
                      ) : (
                        /* 일반 표시 행 */
                        <div className="flex items-center justify-between py-2 border-b border-notion-border last:border-0">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-notion-text">{member.name}</span>
                              {member.position && <span className="text-xs text-notion-gray">{member.position}</span>}
                              {member.role === 'leader' && (
                                <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">팀장</span>
                              )}
                            </div>
                            <p className="text-xs text-notion-gray mt-0.5">
                              아이디: {member.loginId || <span className="text-red-400">미설정</span>}
                              {member.department && ` · ${member.department}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStartEdit(member)}
                              disabled={!!editingId}
                              className="text-xs text-notion-blue hover:underline disabled:opacity-40"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteMember(member.id, member.name)}
                              disabled={!!editingId}
                              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 팀원 추가 */}
            <div className="card">
              <h2 className="text-sm font-semibold text-notion-text mb-1">팀원 추가</h2>
              <p className="text-xs text-notion-gray mb-3">초기 패스워드는 <strong>1234</strong>로 설정됩니다. 첫 로그인 시 변경이 강제됩니다.</p>
              <form onSubmit={handleAddMember} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-notion-gray mb-1">아이디 *</label>
                    <input
                      value={newMember.loginId}
                      onChange={e => setNewMember(p => ({ ...p, loginId: e.target.value }))}
                      className="input-field"
                      placeholder="로그인용 아이디"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-notion-gray mb-1">이름 *</label>
                    <input
                      value={newMember.name}
                      onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                      className="input-field"
                      placeholder="홍길동"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-notion-gray mb-1">직책</label>
                    <input
                      value={newMember.position}
                      onChange={e => setNewMember(p => ({ ...p, position: e.target.value }))}
                      className="input-field"
                      placeholder="과장"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-notion-gray mb-1">소속</label>
                  <input
                    value={newMember.department}
                    onChange={e => setNewMember(p => ({ ...p, department: e.target.value }))}
                    className="input-field"
                    placeholder="통합기술본부 > 통합기술연구3팀"
                  />
                </div>
                <div>
                  <label className="block text-xs text-notion-gray mb-1">역할</label>
                  <select
                    value={newMember.role}
                    onChange={e => setNewMember(p => ({ ...p, role: e.target.value as 'leader' | 'member' }))}
                    className="input-field"
                  >
                    <option value="member">팀원</option>
                    <option value="leader" disabled={leaderCount >= 1}>
                      팀장{leaderCount >= 1 ? ' (이미 지정됨)' : ''}
                    </option>
                  </select>
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
              <p className="text-xs text-notion-gray mb-3">일일보고 작성 시 지원 종류 드롭다운에 표시됩니다.</p>
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
              <h2 className="text-sm font-semibold text-notion-text mb-3">조직 이름 설정</h2>
              <form onSubmit={handleSaveOrgNames} className="space-y-3">
                <div>
                  <label className="block text-xs text-notion-gray mb-1">팀 이름</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    className="input-field"
                    placeholder="예: 통합기술연구3팀"
                  />
                </div>
                <div>
                  <label className="block text-xs text-notion-gray mb-1">본부 이름</label>
                  <input
                    type="text"
                    value={divisionName}
                    onChange={e => setDivisionName(e.target.value)}
                    className="input-field"
                    placeholder="예: 통합기술본부"
                  />
                </div>
                {orgMsg && (
                  <p className={`text-sm ${orgMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{orgMsg.text}</p>
                )}
                <button type="submit" disabled={orgSaving} className="btn-primary">
                  {orgSaving ? '저장 중...' : '저장'}
                </button>
              </form>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-notion-text mb-3">Notion DB 정보</h2>
              <div className="space-y-3">
                {[
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
