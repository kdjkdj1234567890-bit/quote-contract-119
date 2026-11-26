/* ─────────────────────────────────────────────────────────────
   견적·계약서 1분 — 데이터 계층
   · 직종 프리셋 5종
   · 특약 카탈로그
   · 문구에서 항목을 추정하는 키워드 사전
   외부 요청 없음. 모든 계산은 브라우저 안에서만.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  var INDUSTRIES = [
    {
      id: 'dev',
      label: '웹/앱 개발',
      short: '개발',
      emoji: '⌨️',
      rate: 450000,
      rateLabel: '일 45만 원',
      keywords: ['랜딩', '홈페이지', '웹', '앱', '쇼핑몰', '관리자', 'api', '서버', '리뉴얼', '예약', '결제', '프론트', '백엔드', 'react', 'next', '스프링', 'flutter', 'php', '워드프레스', '구축', '개발'],
      note: '범위가 가장 쉽게 불어나는 직종입니다. 관리자 페이지와 배포를 항목으로 분리해 두면 "이것도 해주세요"를 막을 수 있습니다.',
      items: [
        { id: 'dev-plan', name: '요구사항 정의·화면 설계', qty: 3, unit: '일', price: 450000, on: true, desc: '기획서·와이어프레임 정리' },
        { id: 'dev-fe', name: '프론트엔드 퍼블리싱·개발', qty: 8, unit: '일', price: 450000, on: true, desc: '반응형, 크로스브라우징 포함' },
        { id: 'dev-be', name: '백엔드 API·DB 설계', qty: 6, unit: '일', price: 450000, on: true, desc: '테이블 설계, API 문서 포함' },
        { id: 'dev-admin', name: '관리자 페이지', qty: 3, unit: '일', price: 450000, on: false, desc: '목록·등록·수정 화면' },
        { id: 'dev-deploy', name: '서버 세팅·배포·도메인 연결', qty: 2, unit: '일', price: 450000, on: true, desc: '클라우드 1식, SSL 포함' },
        { id: 'dev-qa', name: 'QA·버그 수정 (오픈 후 2주)', qty: 2, unit: '일', price: 450000, on: true, desc: '명백한 오류에 한함' }
      ]
    },
    {
      id: 'ai',
      label: 'AI 자동화·바이브코딩',
      short: 'AI 자동화',
      emoji: '🤖',
      rate: 500000,
      rateLabel: '일 50만 원',
      keywords: ['ai', '자동화', '챗봇', 'gpt', 'llm', '프롬프트', '에이전트', '워크플로', 'n8n', 'make', '자비스', '노션', '시트', '크롤링', 'gpt', '클로드', '커서', '바이브'],
      note: '"알아서 잘"이 가장 위험한 직종입니다. 자동화 범위를 업무 단위로 쪼개고, 운영 중 발생하는 API 비용은 별도로 적어 두세요.',
      items: [
        { id: 'ai-plan', name: '업무 분석·자동화 설계', qty: 2, unit: '일', price: 500000, on: true, desc: '현행 업무 정리, 자동화 범위 확정' },
        { id: 'ai-prompt', name: '프롬프트·워크플로 설계', qty: 2, unit: '일', price: 500000, on: true, desc: '시나리오별 프롬프트 세트' },
        { id: 'ai-api', name: 'API 연동 (LLM·메신저·시트)', qty: 4, unit: '일', price: 500000, on: true, desc: '연동 대상 1~3종' },
        { id: 'ai-app', name: '웹앱·대시보드 구현', qty: 5, unit: '일', price: 500000, on: false, desc: '결과 확인용 화면' },
        { id: 'ai-tune', name: '테스트·프롬프트 튜닝', qty: 2, unit: '일', price: 500000, on: true, desc: '실데이터 20건 기준' },
        { id: 'ai-hand', name: '운영 매뉴얼·인수인계', qty: 1, unit: '일', price: 500000, on: true, desc: '문서 1부 + 화상 1회' }
      ]
    },
    {
      id: 'design',
      label: '디자인·상세페이지',
      short: '디자인',
      emoji: '🎨',
      rate: 350000,
      rateLabel: '일 35만 원',
      keywords: ['디자인', '상세페이지', '로고', '브랜딩', '배너', '썸네일', 'figma', '피그마', '시안', '랜딩', '카드뉴스', 'sns', '인스타', '명함', '패키지'],
      note: '"시안 2안"까지가 계약입니다. 3안째부터는 추가 비용이라는 문장이 없으면 기본적으로 무료로 요구받습니다.',
      items: [
        { id: 'de-mood', name: '무드보드·레퍼런스 정리', qty: 1, unit: '일', price: 350000, on: true, desc: '방향 확정용' },
        { id: 'de-main', name: '메인 페이지 시안 (2안)', qty: 3, unit: '일', price: 350000, on: true, desc: '시안 2안, 수정 2회 포함' },
        { id: 'de-story', name: '상세페이지 스토리보드·카피 정리', qty: 1, unit: '일', price: 350000, on: true, desc: '섹션 구성안' },
        { id: 'de-detail', name: '상세페이지 디자인 (1건)', qty: 1, unit: '건', price: 450000, on: true, desc: 'PC·모바일 2종' },
        { id: 'de-banner', name: '배너·썸네일 세트 (5종)', qty: 1, unit: '건', price: 250000, on: false, desc: '사이즈별 5종' },
        { id: 'de-source', name: '원본 소스 정리 (Figma)', qty: 1, unit: '식', price: 150000, on: true, desc: '레이어 정리·인수' }
      ]
    },
    {
      id: 'video',
      label: '영상·숏폼 편집',
      short: '영상',
      emoji: '🎬',
      rate: 300000,
      rateLabel: '일 30만 원',
      keywords: ['영상', '편집', '숏폼', '릴스', '쇼츠', '유튜브', '프리미어', '에펙', '모션', '자막', '컷편집', '홍보영상', '브이로그', '틱톡'],
      note: '영상은 "수정 1회"의 정의가 사람마다 다릅니다. 컷·자막·음악 변경을 1회로 보고, 새로 촬영된 소재가 들어오면 추가 작업으로 적습니다.',
      items: [
        { id: 'vi-conti', name: '콘티·레퍼런스 정리', qty: 1, unit: '일', price: 300000, on: true, desc: '구성안 1부' },
        { id: 'vi-main', name: '본편 편집 (3~5분)', qty: 1, unit: '편', price: 600000, on: true, desc: '컷·자막·배경음 포함' },
        { id: 'vi-short', name: '숏폼 편집 (30~60초)', qty: 3, unit: '편', price: 180000, on: true, desc: '세로형 3편' },
        { id: 'vi-motion', name: '자막·모션그래픽', qty: 1, unit: '식', price: 350000, on: false, desc: '인트로·로고 모션' },
        { id: 'vi-sound', name: '색보정·사운드 믹싱', qty: 1, unit: '식', price: 250000, on: true, desc: '전체 구간' },
        { id: 'vi-thumb', name: '썸네일 3종', qty: 1, unit: '건', price: 90000, on: true, desc: '클릭률 테스트용' }
      ]
    },
    {
      id: 'consult',
      label: '3D·기술 컨설팅',
      short: '3D·컨설팅',
      emoji: '🧊',
      rate: 550000,
      rateLabel: '일 55만 원',
      keywords: ['3d', '모델링', '렌더링', '블렌더', '키샷', '제품', '컨설팅', '자문', '기술검토', '리서치', '강의', '특강', '보고서', '평가'],
      note: '자문·컨설팅은 시간이 곧 단가입니다. 회의 1회, 리포트 1부를 항목으로 나누고 초과 회의는 별도로 청구하세요.',
      items: [
        { id: 'co-model', name: '3D 모델링 (제품 1종)', qty: 1, unit: '건', price: 700000, on: true, desc: '도면·실물 사진 기준' },
        { id: 'co-render', name: '렌더링·라이팅 (컷 5종)', qty: 1, unit: '식', price: 500000, on: true, desc: '4K, 배경 2종' },
        { id: 'co-anim', name: '애니메이션 (10초)', qty: 1, unit: '편', price: 800000, on: false, desc: '카메라 무빙 포함' },
        { id: 'co-meet', name: '기술 검토 회의 (회당 2시간)', qty: 2, unit: '회', price: 300000, on: true, desc: '화상, 회의록 포함' },
        { id: 'co-report', name: '검토 리포트 작성', qty: 1, unit: '식', price: 400000, on: true, desc: 'A4 5장 내외' }
      ]
    }
  ];

  /* 특약 카탈로그 — 계약서 본문에 조건부로 삽입된다. */
  var CLAUSES = [
    { key: 'revisionCap', group: '수정', label: '무상 수정 횟수 제한', desc: '무상 수정 N회, 초과 시 회당 단가 청구' },
    { key: 'inspection', group: '검수', label: '검수 기한·의제 검수', desc: 'N영업일 내 서면 이의 없으면 검수 완료로 간주' },
    { key: 'payment', group: '대금', label: '분할 지급·지급 기한', desc: '선금·중도금·잔금과 각 지급 기일 명시' },
    { key: 'lateInterest', group: '대금', label: '지연이자·미지급 조치', desc: '지급일 다음 날부터 연 N% 지연이자, 사용·배포 금지' },
    { key: 'termination', group: '해지', label: '중도 해지 정산', desc: '진행 공수 기준 정산 + 취소 수수료' },
    { key: 'copyright', group: '권리', label: '저작권 귀속 시점', desc: '잔금 완납 시 양도(2차적저작물작성권 포함 여부 명시)' },
    { key: 'portfolio', group: '권리', label: '포트폴리오 사용', desc: '완성 후 작업물 게시 가능, 요청 시 비공개' },
    { key: 'scopeChange', group: '범위', label: '범위 변경은 서면으로', desc: '추가 요청은 변경 합의서 후 진행' },
    { key: 'delayPenalty', group: '일정', label: '지체상금(상한)', desc: '내 귀책 지연 시 1일 0.1%, 총액 10% 한도' },
    { key: 'confidential', group: '보안', label: '비밀유지', desc: '자료·내부 정보 비밀 유지, 계약 종료 후 2년' },
    { key: 'warranty', group: '하자', label: '하자 보수 기간', desc: '납품 후 30일 내 명백한 오류 무상 보수' },
    { key: 'liability', group: '책임', label: '손해배상 한도', desc: '배상액은 계약금액을 초과하지 않음' }
  ];

  /* 문구 → 항목 추정용 키워드 (가중치) */
  var ITEM_KEYWORDS = {
    'dev-admin': ['관리자', '어드민', '백오피스', 'admin'],
    'dev-be': ['api', '서버', 'db', '데이터베이스', '로그인', '회원', '결제', '주문'],
    'dev-fe': ['화면', '페이지', '반응형', 'ui', '프론트'],
    'dev-deploy': ['배포', '도메인', '호스팅', '서버'],
    'dev-qa': ['테스트', 'qa', '버그', '오류'],
    'ai-api': ['연동', 'api', '메신저', '카톡', '슬랙', '시트', '노션'],
    'ai-app': ['대시보드', '웹앱', '화면', '관리'],
    'ai-tune': ['정확', '품질', '튜닝', '테스트'],
    'ai-hand': ['매뉴얼', '교육', '인수인계', '가이드'],
    'de-main': ['랜딩', '메인', '홈페이지', '페이지'],
    'de-detail': ['상세', '상세페이지', '제품'],
    'de-banner': ['배너', '썸네일', '광고', 'sns', '인스타'],
    'de-source': ['소스', '피그마', ' figma', '원본'],
    'vi-main': ['영상', '편집', '본편', '홍보'],
    'vi-short': ['숏폼', '릴스', '쇼츠', '틱톡', '세로'],
    'vi-motion': ['모션', '자막', '인트로', '그래픽'],
    'vi-sound': ['색보정', '사운드', '믹싱', '음악'],
    'co-model': ['모델링', '3d', '제품'],
    'co-render': ['렌더', '이미지', '컷'],
    'co-anim': ['애니메이션', '영상', '모션'],
    'co-meet': ['회의', '자문', '미팅', '컨설팅'],
    'co-report': ['리포트', '보고서', '문서', '검토']
  };

  /* 샘플 데이터 — 전부 가상. 실제 인물·회사와 무관. */
  var SAMPLE = {
    brief: '한결커머스 브랜드 랜딩페이지 리뉴얼 — 기존 사이트 반응형 개편, 관리자 페이지 신규, 1월 초 오픈 목표',
    industry: 'dev',
    client: '한결커머스',
    contact: '김서연 팀장',
    title: '브랜드 랜딩페이지 리뉴얼',
    freelancer: '이도현',
    freelancerBiz: '이도현 디자인스튜디오',
    start: '2026-12-01',
    vat: 'exclude',
    withholding: true,
    split: [20, 30, 50],
    revisions: 3,
    inspectionDays: 10,
    extraFee: 250000,
    lateRate: 6,
    copyright: 'on_delivery',
    autoAccept: false,
    portfolio: true,
    delayPenalty: true,
    termination: true
  };

  var API = {
    INDUSTRIES: INDUSTRIES,
    CLAUSES: CLAUSES,
    ITEM_KEYWORDS: ITEM_KEYWORDS,
    SAMPLE: SAMPLE
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.QCM_DATA = API;
})(typeof window !== 'undefined' ? window : globalThis);
