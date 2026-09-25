export default function ManualPage() {
  return (
    <div className="page manual-page">
      <h1 className="section-title large">운영 매뉴얼</h1>

      {/* ══ 공통 운영 규정 ══ */}
      <section className="manual-section manual-section--role">
        <h2 className="manual-role-badge">공통 운영 규정</h2>

        <div className="manual-subsection">
          <h3 className="manual-heading">자리 이용 규칙</h3>
          <ul className="manual-list">
            <li>자리 이용료(자릿세) 1인당 <strong>5,000원</strong> — <strong>2시간</strong> 기준</li>
            <li>늦게 합류한 사람도 동일하게 <strong>별도로 5,000원</strong> 징수</li>
            <li>
              이용시간은 <strong>처음 입장한 팀(팀 내 최초 입장자)</strong> 기준 — 합류 시점과 무관하게 동일한 종료 시각 적용
            </li>
            <li>예외를 두면 분쟁이 생기므로 모든 테이블에 <strong>동일한 기준을 일관되게</strong> 안내</li>
            <li>2시간 이후 연장 가능 여부: <strong>미정</strong></li>
            <li>
              별도 결제 없음 — 서버가 첫 주문 시 주문서에 <strong>자릿세를 인원수만큼</strong> 함께 담아 총액을 산정하고, 손님이 <strong>메뉴 금액 + 자릿세가 포함된 총액을 한 번에 입금</strong>하는 방식
            </li>
          </ul>
          <div className="manual-warn">
            <p className="manual-warn-title">📌 안내문 문구 — 입장 전 반드시 표시</p>
            <p className="manual-desc">
              자리 이용료는 1인 5,000원이며, 합류 시점과 관계없이 동일하게 적용됩니다.
              <br />
              이용시간은 최초 입장 시각을 기준으로 합니다.
            </p>
          </div>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">인원당 최소 주문</h3>
          <p className="manual-desc">테이블 방문 인원 × <strong>8,000원</strong> 이상 주문</p>
          <div className="manual-table-wrap">
            <table className="manual-table">
              <thead>
                <tr>
                  <th>인원</th>
                  <th>최소 금액</th>
                  <th>구성 예시</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>2명</td>
                  <td>16,000원 이상</td>
                  <td>메인 1개 (19,000원) 또는 사이드 2개</td>
                </tr>
                <tr>
                  <td>3명</td>
                  <td>24,000원 이상</td>
                  <td>메인 1개 + 사이드 1개 (30,000원)</td>
                </tr>
                <tr>
                  <td>4명</td>
                  <td>32,000원 이상</td>
                  <td>메인 2개 (38,000원)</td>
                </tr>
                <tr>
                  <td>5명</td>
                  <td>40,000원 이상</td>
                  <td>메인 2개 + 사이드 1개 (49,000원)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">부스 공간 운영</h3>
          <ul className="manual-list">
            <li>중앙 통로는 전자레인지 이용자 대기 동선 — <strong>테이블 설치 불가</strong></li>
            <li>테이블을 통로에 대놓고 설치하지 않고, 기존 구역에서 일부만 바깥쪽으로 배치</li>
            <li>한 테이블 전체가 아니라 테이블 일부가 살짝 나오는 정도로만 공간 확보</li>
          </ul>
          <div className="manual-warn">
            <p className="manual-warn-title">📌 안내문 문구 — 단체 손님</p>
            <p className="manual-desc">단체 손님 예약은 8인 이상부터 가능하며, 현장 상황에 따라 제한될 수 있습니다.</p>
          </div>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">현장 대기 운영</h3>
          <p className="manual-desc">
            <strong>전화 · 메시지 예약은 받지 않고</strong>, 현장에 실제로 있는 손님만 순서대로 받습니다.
            (지난 수기 예약 때 노쇼 · 연락 두절로 좌석을 비워두는 손해가 컸음)
          </p>
          <ol className="manual-list manual-list--ol">
            <li>자리가 없으면 <strong>번호표</strong>를 주고 대기명단에 등록 — 줄만 세우면 공간이 막히므로 번호표 + 현장 대기 방식</li>
            <li>이용 종료 <strong>20분 전</strong>인 테이블 확인</li>
            <li>해당 테이블에 연장 여부 질문</li>
            <li>연장하지 않으면 대기 손님에게 <strong>예상 입장시간</strong> 안내</li>
            <li>자리가 나면 순서대로 입장</li>
            <li>호출 시 자리에 없는 손님은 일정 시간 후 <strong>다음 순번으로 넘김</strong></li>
          </ol>
        </div>
      </section>

      {/* ══ 서버 전용 ══ */}
      <section className="manual-section manual-section--role">
        <h2 className="manual-role-badge manual-role-badge--server">서버 담당</h2>
        <p className="manual-role-desc">주로 사용하는 탭: <strong>주문서</strong> · <strong>예약</strong></p>

        <div className="manual-subsection">
          <h3 className="manual-heading">주문서 탭 — 기본 흐름</h3>
          <ol className="manual-list manual-list--ol">
            <li>
              <strong>테이블 번호</strong> 입력 (1~40)
              <ul className="manual-list manual-list--sub">
                <li>입력 전 반드시 실제 테이블 번호 확인 — 잘못 입력하면 타이머가 엉뚱한 테이블에 시작됨</li>
              </ul>
            </li>
            <li>
              <strong>인원수</strong> 입력 — 기존 테이블 인원에 <strong>누적 합산</strong>됨
              <ul className="manual-list manual-list--sub">
                <li>첫 주문 시: 현재 테이블 전체 인원수 입력</li>
                <li>중간 합류 주문 시: 새로 합류한 인원수만 입력 — 기존 인원에 자동 가산</li>
                <li>테이블 현황 카드에 반영되므로 반드시 입력 (미입력 시 주문 완료 버튼 비활성)</li>
              </ul>
            </li>
            <li>
              <strong>입금자</strong> 이름 입력 — 테이블 카드에 표시됨 (선택이지만 권장)
            </li>
            <li>
              메뉴 <strong>+/−</strong> 버튼으로 수량 선택
              <ul className="manual-list manual-list--sub">
                <li><strong>첫 주문 시 자릿세를 인원수만큼 반드시 담을 것</strong> — 별도 결제 없이 이 금액에 포함됨</li>
                <li>「주문 불가」 표시 메뉴는 품절 처리된 항목 — 선택 불가</li>
                <li>하단 선택 내역에서 담긴 항목과 합계 실시간 확인</li>
              </ul>
            </li>
            <li>
              하단 <strong>주문 완료</strong> 버튼 클릭
              <ul className="manual-list manual-list--sub">
                <li>테이블 번호 · 인원수 · 메뉴 중 하나라도 미입력이면 버튼 비활성</li>
              </ul>
            </li>
            <li>
              <strong>입금 확인 모달</strong>에서 메뉴 · 수량 · 합계 재검토 후 <strong>주문 완료</strong> 클릭
              <ul className="manual-list manual-list--sub">
                <li>주문 완료 후 취소 · 수정 불가 — 모달에서 반드시 마지막 확인</li>
              </ul>
            </li>
          </ol>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">주문서 탭 — 연결 상태 · 오류 대응</h3>
          <ul className="manual-list">
            <li>우상단 <strong>연결됨 / 연결 끊김</strong> 표시 항상 확인</li>
            <li>연결 끊김 상태에서는 주문 완료 버튼 비활성 — 재연결될 때까지 대기</li>
            <li>
              주문 전송 후 <strong>8초</strong> 안에 응답이 없으면 화면 상단에 안내 메시지 표시
              <ul className="manual-list manual-list--sub">
                <li>주방 탭으로 이동해 해당 테이블 카드가 생겼는지 확인</li>
                <li>카드 있음 → 접수된 것 — 중복 주문 금지</li>
                <li>카드 없음 → 누락된 것 — 다시 입력 후 재전송</li>
              </ul>
            </li>
            <li>폼이 초기화되면 정상 접수 / 오류 메시지가 뜨면 내용 확인 후 재시도</li>
          </ul>
          <div className="manual-warn">
            <p className="manual-warn-title">주의</p>
            <ul className="manual-list">
              <li>처리 중 버튼을 반복 클릭하지 않아도 됨 — 같은 내용을 빠르게 두 번 전송해도 서버에서 중복 차단</li>
            </ul>
          </div>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">예약 탭 — 현장 대기 손님 관리</h3>
          <ol className="manual-list manual-list--ol">
            <li><strong>현장에 있는 손님만</strong> 등록 — 전화 · 메시지 예약은 받지 않음</li>
            <li>상단 등록 폼에 <strong>이름 · 전화번호 · 인원</strong> 입력 후 <strong>등록</strong></li>
            <li>목록은 접수 순서대로 표시 — 이름 · 인원 · 전화번호 · 접수 시각 확인 가능</li>
            <li><strong>전화하기</strong> 버튼으로 해당 번호로 바로 전화 연결</li>
            <li>테이블 안내 완료 후 <strong>삭제</strong> 클릭 → 확인 모달 → <strong>삭제</strong> 클릭</li>
            <li>삭제 확인 후 <strong>4초 유예</strong> — 화면 하단 <strong>취소</strong> 버튼으로 되돌릴 수 있음</li>
          </ol>
          <div className="manual-warn">
            <p className="manual-warn-title">주의</p>
            <ul className="manual-list">
              <li>4초 유예가 지나면 완전히 삭제됨 — 실수한 경우 즉시 취소 버튼 클릭</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ══ 주방 총괄 전용 ══ */}
      <section className="manual-section manual-section--role">
        <h2 className="manual-role-badge manual-role-badge--kitchen">주방 총괄 담당</h2>
        <p className="manual-role-desc">주로 사용하는 탭: <strong>주방</strong> · <strong>테이블 현황</strong></p>

        <div className="manual-subsection">
          <h3 className="manual-heading">주방 탭 — 조리 관리</h3>
          <ul className="manual-list">
            <li>상단 <strong>대기 N건</strong> — 현재 처리해야 할 주문 수</li>
            <li>주문 카드 구성: <strong>테이블 번호</strong> + <strong>접수 시각</strong> + 메뉴 항목별 목록</li>
            <li>
              각 메뉴마다 <strong>완료 → 서빙 → 취소</strong> 순서로 버튼 변경
              <ul className="manual-list manual-list--sub">
                <li><strong>완료</strong> — 조리 완료 (주황색 표시)</li>
                <li><strong>서빙</strong> — 손님 테이블에 전달 완료 (흐림 처리)</li>
                <li><strong>취소</strong> — 실수 시 초기 상태로 되돌리기</li>
              </ul>
            </li>
            <li>카드는 <strong>✕ 버튼으로만 삭제</strong> — 전체 서빙 확인 후 제거</li>
          </ul>
          <div className="manual-warn">
            <p className="manual-warn-title">주의</p>
            <ul className="manual-list">
              <li>완료·서빙 후에도 카드 유지 — 전체 확인 후 <strong>✕</strong> 버튼으로 삭제</li>
              <li>주문이 많을 때 아래 카드를 놓치지 않도록 <strong>주기적으로 스크롤 확인</strong></li>
              <li>연결 끊김 시 우상단 표시 변경됨 — 재연결 전까지 신규 주문 수신 안됨</li>
            </ul>
          </div>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">테이블 현황 탭 — 전체 모니터링</h3>
          <ul className="manual-list">
            <li>1~40번 테이블 전체 한눈에 확인 — 상단에 <strong>이용 중 N / 40</strong> 표시</li>
            <li>
              카드 색상으로 상태 구분
              <ul className="manual-list manual-list--sub">
                <li><strong>파란 테두리</strong> — 이용 중 (제한 시간 내)</li>
                <li><strong>빨간 테두리 + 시간초과</strong> — 제한 시간 초과</li>
                <li><strong>회색</strong> — 빈 테이블</li>
              </ul>
            </li>
            <li>
              이용 중 카드 표시 항목
              <ul className="manual-list manual-list--sub">
                <li><strong>남은 시간</strong> — 실시간 카운트다운 (HH:MM:SS)</li>
                <li><strong>인원</strong> / <strong>제한 시간(분)</strong> / <strong>입금자</strong> / <strong>누적 금액</strong></li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">테이블 현황 탭 — 주요 버튼</h3>
          <ul className="manual-list">
            <li>
              <strong>내역</strong> 버튼 — 주문 내역 모달
              <ul className="manual-list manual-list--sub">
                <li>회차별 주문 시각 · 메뉴 · 금액 확인</li>
                <li>하단에 누적 합계 표시 — 퇴석 시 정산에 활용</li>
              </ul>
            </li>
            <li>
              <strong>✕</strong> 버튼 — 테이블 해제
              <ul className="manual-list manual-list--sub">
                <li>확인 모달 후 처리 — 타이머 + 주방 주문 모두 초기화</li>
                <li>손님이 완전히 자리를 떠난 뒤 클릭</li>
              </ul>
            </li>
          </ul>
          <div className="manual-warn">
            <p className="manual-warn-title">주의</p>
            <ul className="manual-list">
              <li>시간 초과 테이블에 추가 주문이 들어오면 타이머 자동 재시작 — 연장 의사 확인 후 주문 접수</li>
              <li>✕ 클릭 시 주방 조리 대기 중인 주문도 함께 삭제됨 — 조리 완료 후 사용</li>
              <li>해제 후 되돌릴 수 없음</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ══ 관리 (영업 준비·마감) ══ */}
      <section className="manual-section manual-section--role">
        <h2 className="manual-role-badge manual-role-badge--admin">관리 — 영업 준비 · 마감</h2>

        <div className="manual-subsection">
          <h3 className="manual-heading">설정 탭 — 영업 전 준비</h3>
          <ul className="manual-list">
            <li>
              <strong>품절 설정</strong> — 메뉴 버튼 클릭으로 판매중 ↔ 품절 즉시 전환
              <ul className="manual-list manual-list--sub">
                <li>품절 처리 즉시 주문서에 반영 — 영업 전 미리 설정 권장</li>
              </ul>
            </li>
            <li>
              <strong>기본 제한 시간</strong> — 첫 주문 후 이 시간을 넘기면 시간 초과 표시 (기본 120분)
              <ul className="manual-list manual-list--sub">
                <li>변경 후 <strong>적용</strong> 버튼 클릭 필수</li>
                <li>변경은 이후 신규 주문부터 적용 — 진행 중인 타이머에는 소급 미적용</li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="manual-subsection">
          <h3 className="manual-heading">전체 초기화 — 영업 종료 후</h3>
          <ul className="manual-list">
            <li>주방 큐 · 테이블 타이머 · 매출 · 품절 · 예약을 전부 초기화</li>
            <li>다음 행사 준비 전 실행</li>
          </ul>
          <div className="manual-warn manual-warn--danger">
            <p className="manual-warn-title">경고</p>
            <ul className="manual-list">
              <li><strong>되돌릴 수 없음</strong> — 영업 중 절대 사용 금지</li>
              <li>초기화 전 매출 탭 스크린샷 보관 권장</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
