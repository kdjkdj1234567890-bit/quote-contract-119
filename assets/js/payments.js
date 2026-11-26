/* ─────────────────────────────────────────────────────────────
   결제 연결 설정
   ─────────────────────────────────────────────────────────────
   아래 url 에 상품 주소를 넣으면 그 순간부터 버튼이
   실제 결제 페이지로 연결됩니다. 비어 있으면 주문 문의 메일로
   넘어갑니다(메일 본문에 프로젝트 요약이 자동으로 들어갑니다).

   크몽: 상품 등록 후 주소가 https://kmong.com/gig/숫자 형태로 나옵니다.
   스마트스토어: https://smartstore.naver.com/스토어명/products/숫자

   ※ 값을 바꾼 뒤에는 index.html의 캐시 버전만 올려 주면 됩니다.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  var CONFIG = {
    email: 'ralehdwlsdj1234567890@gmail.com',
    products: {
      pro: {
        name: 'Pro 템플릿팩',
        price: 19000,
        kmong: '',        // 예: 'https://kmong.com/gig/000000'
        smartstore: '',   // 예: 'https://smartstore.naver.com/xxx/products/000000'
        desc: '업종별 특약 문구 42선 · 계약서 변형 5종 · 견적서 엑셀 양식 · 확인 메일 문구 12개'
      },
      custom: {
        name: '맞춤 계약서 작성',
        price: 39000,
        kmong: '',
        smartstore: '',
        desc: '상황 확인 후 계약서 1:1 작성·검토, 영업일 2일 내 전달'
      }
    }
  };

  function urlFor(key) {
    var p = CONFIG.products[key];
    if (!p) return '';
    return p.kmong || p.smartstore || '';
  }

  function summary(ctx) {
    if (!ctx) return '';
    var lines = [];
    if (ctx.title) lines.push('건명: ' + ctx.title);
    if (ctx.industry) lines.push('직종: ' + ctx.industry);
    if (ctx.total) lines.push('견적금액: ' + ctx.total + '원');
    if (ctx.score != null) lines.push('방어 점수: ' + ctx.score + '점');
    return lines.join('\n');
  }

  function mailto(key, ctx) {
    var p = CONFIG.products[key] || { name: '문의', price: 0 };
    var subject = '[견적·계약서 1분] ' + p.name + ' 주문 문의';
    var body = [
      '안녕하세요, ' + p.name + ' 주문 문의드립니다.',
      '',
      summary(ctx),
      '',
      '필요한 내용:',
      '- ',
      '',
      '이름/활동명:',
      '회신 받을 이메일:',
      '',
      '(이 메일은 견적·계약서 1분 사이트의 주문 문의 양식입니다.)'
    ].join('\n');
    return 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function inquiryMailto(data) {
    var subject = '[견적·계약서 1분] ' + (data.topic || '질문');
    var body = [
      (data.body || ''),
      '',
      '---',
      '이름/활동명: ' + (data.name || ''),
      '회신 이메일: ' + (data.contact || '')
    ].join('\n');
    return 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  var API = { CONFIG: CONFIG, urlFor: urlFor, mailto: mailto, inquiryMailto: inquiryMailto, summary: summary };
  root.QCM_PAY = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
