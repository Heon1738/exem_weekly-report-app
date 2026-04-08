'use client'

import { useRouter } from 'next/navigation'

export default function NotionSetupPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-notion-sidebar py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-2xl font-semibold text-notion-text">개인 Notion 연동 가이드</h1>
          <p className="text-sm text-notion-gray mt-1">
            각자의 Notion 워크스페이스에 주간보고를 내보내기 위한 설정 방법입니다.
          </p>
        </div>

        {/* 개요 */}
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-xs font-semibold text-blue-800 mb-2">📌 연동 개요</p>
          <p className="text-xs text-blue-800 leading-relaxed">
            이 앱에서 <strong>Notion 내보내기</strong>를 누르면, 각자의 개인 Notion 데이터베이스에 주간보고가 자동으로 생성됩니다.
            설정은 팀원 개인이 각자 진행하며, 연동 후 설정 → 내 정보 탭에서 토큰과 DB ID를 입력하면 완료됩니다.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 font-medium">
            <span className="bg-blue-200 rounded-full px-2 py-0.5">STEP 1</span>
            <span>Integration 생성</span>
            <span className="text-blue-400">→</span>
            <span className="bg-blue-200 rounded-full px-2 py-0.5">STEP 2</span>
            <span>DB 준비</span>
            <span className="text-blue-400">→</span>
            <span className="bg-blue-200 rounded-full px-2 py-0.5">STEP 3</span>
            <span>연결 후 ID 복사</span>
            <span className="text-blue-400">→</span>
            <span className="bg-blue-200 rounded-full px-2 py-0.5">STEP 4</span>
            <span>앱에 입력</span>
          </div>
        </div>

        {/* STEP 1 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-notion-blue text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">1</span>
            <h2 className="text-sm font-semibold text-notion-text">Notion Integration 생성 및 토큰 복사</h2>
          </div>

          <ol className="space-y-4 text-xs text-notion-text">
            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">1-1</span>
              <div className="space-y-2 w-full">
                <p>브라우저에서 아래 주소로 이동합니다.</p>
                <div className="bg-notion-gray-bg border border-notion-border rounded px-3 py-2 font-mono text-notion-blue select-all">
                  notion.so/profile/integrations
                </div>
                <p className="text-notion-gray">※ 구버전 UI라면 <span className="font-mono">notion.so/my-integrations</span> 로 접속하세요.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">1-2</span>
              <div className="space-y-2 w-full">
                <p><strong>New integration</strong> 버튼을 클릭합니다.</p>
                {/* 버튼 모형 */}
                <div className="border border-notion-border rounded-lg p-3 bg-white space-y-2">
                  <p className="text-notion-gray text-xs">My integrations 화면</p>
                  <div className="flex justify-between items-center">
                    <span className="text-notion-text text-xs font-medium">My integrations</span>
                    <span className="bg-notion-blue text-white text-xs px-3 py-1 rounded font-medium">+ New integration</span>
                  </div>
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">1-3</span>
              <div className="space-y-2 w-full">
                <p>아래와 같이 설정 후 <strong>Save</strong> 또는 <strong>Submit</strong>을 클릭합니다.</p>
                <div className="border border-notion-border rounded-lg p-3 bg-white space-y-2 text-xs">
                  <div className="flex justify-between border-b border-notion-border pb-2 mb-2">
                    <span className="text-notion-gray">Name</span>
                    <span className="text-notion-text font-medium">주간보고 (예시 이름)</span>
                  </div>
                  <div className="flex justify-between border-b border-notion-border pb-2 mb-2">
                    <span className="text-notion-gray">Associated workspace</span>
                    <span className="text-notion-text font-medium">내 워크스페이스 선택</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-notion-gray">Type</span>
                    <span className="text-notion-text font-medium">Internal ✓</span>
                  </div>
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">1-4</span>
              <div className="space-y-2 w-full">
                <p>생성된 Integration 페이지에서 <strong>Internal Integration Secret</strong>을 복사합니다.</p>
                <div className="border border-notion-border rounded-lg p-3 bg-white space-y-2 text-xs">
                  <p className="text-notion-gray">Secrets 섹션</p>
                  <div className="flex items-center justify-between bg-notion-gray-bg rounded px-2 py-1.5">
                    <span className="font-mono text-notion-text">secret_xxxxxxxxxxxxxxxxxxx...</span>
                    <span className="bg-notion-blue text-white text-xs px-2 py-0.5 rounded cursor-pointer">Copy</span>
                  </div>
                </div>
                <p className="text-notion-gray">복사한 값 = <strong>Integration 토큰</strong> (STEP 4에서 입력)</p>
              </div>
            </li>
          </ol>
        </div>

        {/* STEP 2 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-notion-blue text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">2</span>
            <h2 className="text-sm font-semibold text-notion-text">Notion에 주간보고 데이터베이스 준비</h2>
          </div>

          <p className="text-xs text-notion-gray mb-4">이미 주간보고 DB가 있다면 STEP 3으로 넘어가세요. DB가 없다면 아래처럼 새로 만듭니다.</p>

          <ol className="space-y-4 text-xs text-notion-text">
            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">2-1</span>
              <div className="space-y-1">
                <p>Notion에서 새 페이지를 만든 후, <strong>/database</strong> 를 입력하여 <strong>Full page database</strong> 또는 <strong>Table</strong>을 생성합니다.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">2-2</span>
              <div className="space-y-2 w-full">
                <p>DB에 아래 <strong>4가지 속성(컬럼)</strong>을 반드시 추가합니다.</p>
                <div className="border border-notion-border rounded-lg overflow-hidden text-xs">
                  <div className="bg-notion-gray-bg px-3 py-2 grid grid-cols-2 gap-2 font-semibold text-notion-gray border-b border-notion-border">
                    <span>속성 이름 (정확히 입력)</span>
                    <span>타입</span>
                  </div>
                  {[
                    ['주간보고서 (클릭)', 'Title (기본값)'],
                    ['보고 기간', 'Date'],
                    ['작성 일자', 'Date'],
                    ['작성자', 'Text'],
                  ].map(([name, type]) => (
                    <div key={name} className="px-3 py-2 grid grid-cols-2 gap-2 border-b border-notion-border last:border-0 bg-white">
                      <span className="font-mono font-medium text-notion-text">{name}</span>
                      <span className="text-notion-gray">{type}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5 text-xs text-yellow-800">
                  ⚠️ 속성 이름이 정확히 일치해야 내보내기가 정상 동작합니다. 띄어쓰기·괄호 포함 그대로 복사하세요.
                </div>
              </div>
            </li>
          </ol>
        </div>

        {/* STEP 3 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-notion-blue text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">3</span>
            <h2 className="text-sm font-semibold text-notion-text">DB에 Integration 연결 후 DB ID 복사</h2>
          </div>

          <ol className="space-y-4 text-xs text-notion-text">
            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">3-1</span>
              <div className="space-y-2 w-full">
                <p>주간보고 DB 페이지 우측 상단 <strong>···</strong> (더보기) 버튼을 클릭합니다.</p>
                <div className="border border-notion-border rounded-lg p-3 bg-white text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-notion-text">주간보고 DB</span>
                    <div className="flex items-center gap-2">
                      <span className="text-notion-gray">Filter</span>
                      <span className="text-notion-gray">Sort</span>
                      <span className="bg-notion-gray-bg rounded px-1.5 py-0.5 font-bold text-notion-text cursor-pointer">···</span>
                    </div>
                  </div>
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">3-2</span>
              <div className="space-y-2 w-full">
                <p>메뉴에서 <strong>Connections</strong> (또는 <strong>Connect to</strong>)를 선택합니다.</p>
                <div className="border border-notion-border rounded-lg p-2 bg-white text-xs space-y-1 w-40">
                  {['Filter', 'Sort', 'Group by', '—', 'Connections ▶', 'Copy link'].map((item, i) => (
                    <div key={i} className={`px-2 py-1 rounded text-xs ${item === 'Connections ▶' ? 'bg-blue-50 text-notion-blue font-semibold' : item === '—' ? 'border-t border-notion-border my-0.5' : 'text-notion-gray'}`}>
                      {item !== '—' && item}
                    </div>
                  ))}
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">3-3</span>
              <div>
                <p>STEP 1에서 만든 Integration을 검색하여 선택합니다. <strong>Confirm</strong>을 눌러 연결을 완료합니다.</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">3-4</span>
              <div className="space-y-2 w-full">
                <p>DB가 열린 상태에서 브라우저 주소창 URL을 확인합니다. <strong>?v= 앞의 32자리</strong>가 DB ID입니다.</p>
                <div className="border border-notion-border rounded-lg px-3 py-2 bg-white text-xs font-mono break-all">
                  notion.so/<span className="bg-yellow-200 text-yellow-900 font-bold px-0.5 rounded">1f33d7eebe4181eaa60ad290ab162b40</span>?v=abc123...
                </div>
                <p className="text-notion-gray">노란색으로 표시된 32자리 = <strong>DB ID</strong> (STEP 4에서 입력)</p>
                <div className="bg-notion-gray-bg border border-notion-border rounded px-2 py-1.5 text-xs text-notion-gray">
                  💡 URL에 <span className="font-mono">?v=</span> 가 없다면 일반 페이지입니다. DB를 full page로 열거나, DB 제목을 클릭해 별도 탭으로 열면 URL에서 ID를 확인할 수 있습니다.
                </div>
              </div>
            </li>
          </ol>
        </div>

        {/* STEP 4 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-notion-blue text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">4</span>
            <h2 className="text-sm font-semibold text-notion-text">앱 환경설정에서 토큰 및 DB ID 입력</h2>
          </div>

          <ol className="space-y-3 text-xs text-notion-text">
            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">4-1</span>
              <p>상단 네비게이션 바에서 <strong>환경설정</strong>을 클릭합니다.</p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">4-2</span>
              <p><strong>내 정보</strong> 탭을 선택합니다.</p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 text-notion-gray font-medium">4-3</span>
              <div className="space-y-2 w-full">
                <p>아래 두 항목을 입력 후 <strong>저장</strong>을 클릭합니다.</p>
                <div className="border border-notion-border rounded-lg p-3 bg-white space-y-3 text-xs">
                  <div>
                    <p className="text-notion-gray mb-1">개인 Notion Integration 토큰</p>
                    <div className="bg-notion-gray-bg rounded px-2 py-1.5 font-mono text-notion-gray">
                      secret_xxxxxxxxxxxxxxxxxxx... (STEP 1-4에서 복사한 값)
                    </div>
                  </div>
                  <div>
                    <p className="text-notion-gray mb-1">개인 Notion 주간보고 DB ID</p>
                    <div className="bg-notion-gray-bg rounded px-2 py-1.5 font-mono text-notion-gray">
                      1f33d7eebe4181eaa60ad290ab162b40 (STEP 3-4에서 복사한 값)
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ol>

          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-800">
            <p className="font-semibold mb-1">✅ 설정 완료 후 확인 방법</p>
            <p>주간보고 화면 → <strong>Notion 내보내기</strong> 버튼 클릭 → 내 Notion DB에 새 항목이 생성되면 성공입니다.</p>
          </div>
        </div>

        {/* 자주 묻는 질문 */}
        <div className="card bg-gray-50 border-gray-200">
          <p className="text-xs font-semibold text-notion-text mb-3">❓ 자주 묻는 질문</p>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-medium text-notion-text">Q. Notion 내보내기를 눌렀는데 오류가 납니다.</p>
              <p className="text-notion-gray mt-0.5">→ Integration 토큰과 DB ID가 올바른지 확인하고, DB에 Integration이 연결(Connections)되어 있는지 확인하세요.</p>
            </div>
            <div>
              <p className="font-medium text-notion-text">Q. DB ID를 어디서 찾아야 하나요?</p>
              <p className="text-notion-gray mt-0.5">→ Notion에서 DB를 전체 화면으로 열면 URL이 <span className="font-mono">notion.so/[32자리ID]?v=...</span> 형태로 보입니다. ?v= 앞의 32자리가 DB ID입니다.</p>
            </div>
            <div>
              <p className="font-medium text-notion-text">Q. Integration은 어떤 권한이 필요한가요?</p>
              <p className="text-notion-gray mt-0.5">→ Internal Integration으로 생성하면 기본 Read/Write 권한이 부여됩니다. 별도 권한 설정은 불필요합니다.</p>
            </div>
            <div>
              <p className="font-medium text-notion-text">Q. 속성 이름을 잘못 입력했어요.</p>
              <p className="text-notion-gray mt-0.5">→ Notion DB에서 해당 속성 이름을 클릭해 STEP 2의 표와 동일하게 수정하면 됩니다.</p>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/settings')}
            className="btn-primary flex-1"
          >
            환경설정으로 이동 (토큰·DB ID 입력)
          </button>
          <button
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 text-sm border border-notion-border rounded-lg text-notion-gray hover:bg-notion-gray-bg transition-colors"
          >
            돌아가기
          </button>
        </div>

      </div>
    </div>
  )
}
