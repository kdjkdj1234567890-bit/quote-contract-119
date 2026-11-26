/* ─────────────────────────────────────────────────────────────
   견적·계약서 1분 — 엔진
   계산 · 방어 점수 · 문서 생성. DOM을 쓰지 않으므로 단독 테스트 가능.
   ───────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  var D = root.QCM_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  var WITHHOLD_RATE = 0.033;   // 소득세 3% + 개인지방소득세 0.3%
  var VAT_RATE = 0.10;
  var WON = new Intl.NumberFormat('ko-KR');

  /* ── 숫자·날짜 유틸 ─────────────────────────────── */
  function num(v, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));
    return isFinite(n) ? n : (fallback || 0);
  }
  function won(n) { return WON.format(Math.round(n || 0)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toDate(v) {
    if (v instanceof Date) return new Date(v.getTime());
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return new Date();
  }
  function fmtDate(v, style) {
    var d = toDate(v);
    if (style === 'dot') return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
    if (style === 'compact') return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function addDays(v, n) {
    var d = toDate(v); d.setDate(d.getDate() + n); return d;
  }
  function isWeekend(d) { var w = d.getDay(); return w === 0 || w === 6; }
  function addBusinessDays(v, n) {
    var d = toDate(v), left = Math.max(0, Math.round(n));
    while (left > 0) { d = addDays(d, 1); if (!isWeekend(d)) left--; }
    return d;
  }
  function weekdayKR(d) { return ['일', '월', '화', '수', '목', '금', '토'][toDate(d).getDay()]; }

  /* 금액을 한글로: 12,345,000 → 일금 일천이백삼십사만오천원 */
  var DIGIT = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  var SMALL = ['', '십', '백', '천'];
  function korGroup3(n) { // 0..9999
    var out = '', s = String(n), len = s.length;
    for (var i = 0; i < len; i++) {
      var d = +s.charAt(i);
      if (d) out += DIGIT[d] + SMALL[len - 1 - i];
    }
    return out;
  }
  function korAmount(n) {
    n = Math.round(Math.abs(n || 0));
    if (n === 0) return '영';
    var big = ['', '만', '억', '조'];
    var parts = [], i = 0;
    while (n > 0) {
      var g = n % 10000;
      if (g) parts.unshift(korGroup3(g) + big[i]);
      n = Math.floor(n / 10000);
      i++;
    }
    return parts.join('');
  }

  /* ── 상태 기본값 ─────────────────────────────── */
  function blankState(industryId) {
    var ind = getIndustry(industryId || 'dev');
    var items = {};
    ind.items.forEach(function (it) { items[it.id] = { on: !!it.on, qty: it.qty, price: it.price }; });
    return {
      industry: ind.id,
      brief: '', client: '', contact: '', title: '',
      freelancer: '', freelancerBiz: '', bizNo: '', email: '', phone: '', account: '',
      start: fmtDate(new Date()),
      items: items,
      custom: [],
      vat: 'exclude',
      withholding: true,
      split: [40, 30, 30],
      revisions: 2,
      extraFee: 0,          // 0이면 자동 계산
      inspectionDays: 7,
      autoAccept: true,
      lateRate: 12,
      nonPaymentBan: true,
      copyright: 'on_balance',
      termination: true,
      cancelFee: 10,
      portfolio: true,
      scopeChange: true,
      delayPenalty: true,
      confidential: false,
      warranty: true,
      liability: true,
      mask: false,
      quoteNo: ''
    };
  }

  function getIndustry(id) {
    for (var i = 0; i < D.INDUSTRIES.length; i++) if (D.INDUSTRIES[i].id === id) return D.INDUSTRIES[i];
    return D.INDUSTRIES[0];
  }

  function loadSample() {
    var st = blankState(D.SAMPLE.industry);
    var s = D.SAMPLE;
    st.brief = s.brief; st.client = s.client; st.contact = s.contact; st.title = s.title;
    st.freelancer = s.freelancer; st.freelancerBiz = s.freelancerBiz;
    st.start = s.start; st.vat = s.vat; st.withholding = s.withholding;
    st.split = s.split.slice(); st.revisions = s.revisions; st.inspectionDays = s.inspectionDays;
    st.extraFee = s.extraFee; st.lateRate = s.lateRate; st.copyright = s.copyright;
    st.portfolio = s.portfolio; st.delayPenalty = s.delayPenalty; st.termination = s.termination;
    st.mask = true;
    return st;
  }

  /* ── 문구 → 직종·항목 추정 ─────────────────────── */
  function parseBrief(text) {
    var t = String(text || '').toLowerCase();
    var best = { id: 'dev', score: 0 };
    D.INDUSTRIES.forEach(function (ind) {
      var sc = 0;
      ind.keywords.forEach(function (k) { if (t.indexOf(k) >= 0) sc += k.length > 3 ? 2 : 1; });
      if (sc > best.score) best = { id: ind.id, score: sc };
    });
    var ind = getIndustry(best.id);
    var picked = [];
    ind.items.forEach(function (it) {
      var kws = D.ITEM_KEYWORDS[it.id] || [];
      for (var i = 0; i < kws.length; i++) {
        if (t.indexOf(kws[i]) >= 0) { picked.push(it.id); break; }
      }
    });
    if (picked.length < 2) picked = ind.items.filter(function (i) { return i.on; }).map(function (i) { return i.id; });

    // 제목: 구분자 앞쪽
    var title = String(text || '').split(/\s+[—\-–]\s+|,\s*/)[0].trim();
    if (title.length > 46) title = title.slice(0, 46).trim();

    // 거래처명 추정: (주)XXX, XXX커머스/스토어/컴퍼니/브랜드
    var client = '';
    var cm = /(\(주\)\s?[가-힣A-Za-z0-9]{2,12}|[가-힣A-Za-z0-9]{2,12}\s?(커머스|스토어|컴퍼니|브랜드|스튜디오|랩|테크|소프트))/.exec(String(text || ''));
    if (cm) client = cm[0].trim();

    return { industry: ind.id, items: picked, title: title, client: client };
  }

  /* ── 계산 ─────────────────────────────────────── */
  function activeLines(st) {
    var ind = getIndustry(st.industry);
    var out = [];
    ind.items.forEach(function (it) {
      var s = st.items[it.id];
      if (s && s.on) {
        var qty = Math.max(0, num(s.qty, it.qty));
        var price = Math.max(0, num(s.price, it.price));
        out.push({ id: it.id, name: it.name, desc: it.desc, qty: qty, unit: it.unit, price: price, amount: Math.round(qty * price) });
      }
    });
    (st.custom || []).forEach(function (c) {
      if (c && c.on) {
        var q = Math.max(0, num(c.qty, 1));
        var p = Math.max(0, num(c.price, 0));
        out.push({ id: c.id, name: c.name || '추가 항목', desc: c.desc || '', qty: q, unit: c.unit || '식', price: p, amount: Math.round(q * p) });
      }
    });
    return out;
  }

  function calc(st) {
    var lines = activeLines(st);
    var supply = lines.reduce(function (a, l) { return a + l.amount; }, 0);

    var vat = 0, total = supply, supplyPart = supply;
    if (st.vat === 'exclude') { vat = Math.round(supply * VAT_RATE); total = supply + vat; supplyPart = supply; }
    else if (st.vat === 'include') { total = supply; supplyPart = Math.round(supply / (1 + VAT_RATE)); vat = total - supplyPart; }

    var withholding = st.withholding ? Math.round(supplyPart * WITHHOLD_RATE) : 0;
    var net = total - withholding;

    var workDays = lines.reduce(function (a, l) { return a + (l.unit === '일' ? l.qty : 0); }, 0);
    var start = toDate(st.start);
    var delivery = addBusinessDays(start, workDays || 5);

    var raw = (st.split && st.split.length === 3) ? st.split.slice() : [40, 30, 30];
    var pcts = raw.map(function (v) { return Math.max(0, num(v, 0)); });
    var sum = pcts.reduce(function (a, b) { return a + b; }, 0);

    var labels = ['선금', '중도금', '잔금'];
    var notes = [
      '계약 체결 후 3영업일 이내',
      '중간 산출물 전달 후 5영업일 이내',
      '최종 검수 완료 후 7일 이내'
    ];
    var dueDates = [
      addBusinessDays(start, 3),
      addBusinessDays(start, Math.max(3, Math.round(workDays * 0.6))),
      addBusinessDays(delivery, 7)
    ];

    var splits = [];
    var running = 0;
    for (var i = 0; i < 3; i++) {
      if (pcts[i] <= 0 && sum > 0) continue;
      var amount = i === 2 ? total - running : Math.round(total * pcts[i] / 100);
      if (i === 2) pcts[i] = total ? Math.round(amount / total * 1000) / 10 : pcts[i];
      running += amount;
      splits.push({
        key: 's' + i, label: labels[i], pct: pcts[i], amount: amount,
        wh: Math.round(amount * (total ? withholding / total : 0)),
        note: notes[i], due: dueDates[i], dueText: fmtDate(dueDates[i], 'dot') + ' (' + weekdayKR(dueDates[i]) + ')'
      });
    }
    if (!splits.length) {
      splits.push({ key: 's2', label: '잔금', pct: 100, amount: total, wh: withholding, note: notes[2], due: dueDates[2], dueText: fmtDate(dueDates[2], 'dot') });
    }
    // 잔금 실수령은 반올림 오차를 흡수
    var whSum = splits.reduce(function (a, s) { return a + s.wh; }, 0);
    splits[splits.length - 1].wh += (withholding - whSum);

    var extraFee = num(st.extraFee, 0) || suggestExtraFee(supply);
    var lateDaily = Math.round(total * (num(st.lateRate, 0) / 100) / 365);

    return {
      lines: lines,
      supply: supply,
      vat: vat,
      total: total,
      supplyPart: supplyPart,
      withholding: withholding,
      net: net,
      workDays: workDays,
      start: start,
      delivery: delivery,
      splits: splits,
      splitSum: pcts.reduce(function (a, b) { return a + b; }, 0),
      extraFee: extraFee,
      lateDaily: lateDaily,
      empty: lines.length === 0
    };
  }

  function suggestExtraFee(supply) {
    if (!supply) return 100000;
    var v = supply * 0.05;
    if (v < 50000) return 50000;
    return Math.round(v / 10000) * 10000;
  }

  /* ── 방어 점수 ─────────────────────────────────── */
  function band(score) {
    if (score >= 85) return { label: '튼튼함', tone: 'good', text: '이대로 보내도 됩니다' };
    if (score >= 70) return { label: '양호', tone: 'ok', text: '한두 군데만 보강하면 충분합니다' };
    if (score >= 55) return { label: '보통', tone: 'warn', text: '분쟁이 나면 해석 다툼이 생길 수 있습니다' };
    if (score >= 40) return { label: '약함', tone: 'bad', text: '지금 서명하면 위험한 조항이 남습니다' };
    return { label: '위험', tone: 'bad', text: '이 상태로는 대금을 지키기 어렵습니다' };
  }

  var RISKS = [
    { id: 'deposit0', level: '치명', when: function (st) { return num(st.split[0], 0) === 0; },
      title: '착수금이 0원입니다', detail: '작업을 시작한 뒤 상대가 마음을 바꾸면, 지금까지의 공수에 대한 대가를 받을 근거가 약해집니다.',
      fix: { label: '선금 30%로 바꾸기', apply: function (st) { st.split = [30, 30, 40]; } } },
    { id: 'depositLow', level: '주의', when: function (st) { var d = num(st.split[0], 0); return d > 0 && d < 30; },
      title: '선금 비율이 낮습니다', detail: '선금 30% 미만이면 중도에 일이 흔들릴 때 손실을 그대로 떠안게 됩니다.',
      fix: { label: '선금 30%로 올리기', apply: function (st) { st.split = [30, 30, 40]; } } },
    { id: 'balanceHigh', level: '주의', when: function (st) { return num(st.split[2], 0) > 60; },
      title: '잔금 비중이 60%를 넘습니다', detail: '일을 다 끝낸 뒤 받는 돈이 대부분이면, 검수 지연과 미지급 위험이 한꺼번에 몰립니다.',
      fix: { label: '4:3:3으로 바꾸기', apply: function (st) { st.split = [40, 30, 30]; } } },
    { id: 'oneShot', level: '제안', when: function (st) { return num(st.split[1], 0) === 0; },
      title: '중도금이 없습니다', detail: '중간에 한 번 받으면, 상대도 진행 상황을 확인하고 나도 현금 흐름이 끊기지 않습니다.',
      fix: { label: '중도금 30% 넣기', apply: function (st) { st.split = [40, 30, 30]; } } },
    { id: 'fewLines', level: '주의', when: function (st, c) { return c.lines.length < 3; },
      title: '산출물 항목이 ' + '3개 미만입니다', detail: '"알아서 잘"로 남는 여지가 가장 큰 부분입니다. 결과물을 항목으로 쪼개면 그 자체가 방어입니다.',
      fix: null },
    { id: 'vagueBrief', level: '제안', when: function (st) { return String(st.brief || '').trim().length < 10; },
      title: '프로젝트 설명이 짧습니다', detail: '한 줄이라도 목적·범위·일정이 들어가면 계약서 제2조가 훨씬 구체적으로 읽힙니다.',
      fix: null },
    { id: 'revMany', level: '주의', when: function (st) { return num(st.revisions, 0) > 3; },
      title: '무상 수정이 4회 이상입니다', detail: '숫자가 클수록 사실상 무제한 수정과 비슷해집니다. 2~3회가 현실적인 선입니다.',
      fix: { label: '무상 수정 2회로', apply: function (st) { st.revisions = 2; } } },
    { id: 'noAutoAccept', level: '주의', when: function (st) { return !st.autoAccept; },
      title: '검수 완료 간주 조항이 없습니다', detail: '검수를 미루는 것만으로 잔금 지급이 무한정 밀릴 수 있습니다. 기한 경과 시 완료로 보는 문장이 필요합니다.',
      fix: { label: '의제 검수 넣기', apply: function (st) { st.autoAccept = true; } } },
    { id: 'inspectionLong', level: '제안', when: function (st) { return num(st.inspectionDays, 0) > 10; },
      title: '검수 기한이 깁니다', detail: '10영업일을 넘기면 프로젝트 하나가 한 달씩 밀립니다. 7영업일 안팎이 일반적입니다.',
      fix: { label: '7영업일로', apply: function (st) { st.inspectionDays = 7; } } },
    { id: 'copyNone', level: '치명', when: function (st) { return st.copyright === 'none'; },
      title: '저작권 조항이 없습니다', detail: '계약에 정하지 않으면 권리는 원칙적으로 창작자에게 남지만, 대금을 다 받기 전에 결과물을 넘겨야 하는 상황이 생깁니다.',
      fix: { label: '잔금 완납 시 양도로', apply: function (st) { st.copyright = 'on_balance'; } } },
    { id: 'copyDelivery', level: '주의', when: function (st) { return st.copyright === 'on_delivery'; },
      title: '저작권을 납품과 동시에 넘깁니다', detail: '잔금을 받기 전에 권리가 넘어가면, 미지급 시 사용 중단을 요구할 근거가 약해집니다.',
      fix: { label: '잔금 완납 시로', apply: function (st) { st.copyright = 'on_balance'; } } },
    { id: 'noTermination', level: '주의', when: function (st) { return !st.termination; },
      title: '중도 해지 정산 조항이 없습니다', detail: '상대가 중간에 그만두면 이미 한 일에 대한 대가를 어떻게 받을지 정해 두어야 합니다.',
      fix: { label: '정산 조항 넣기', apply: function (st) { st.termination = true; } } },
    { id: 'noLate', level: '주의', when: function (st) { return num(st.lateRate, 0) <= 0; },
      title: '지연이자가 0%입니다', detail: '늦게 줘도 비용이 없으면 늦게 줍니다. 연 6%(상사법정이율) 이상을 적어 두세요.',
      fix: { label: '연 12%로', apply: function (st) { st.lateRate = 12; } } },
    { id: 'noBan', level: '제안', when: function (st) { return !st.nonPaymentBan; },
      title: '미지급 시 사용 중단 조항이 없습니다', detail: '돈을 안 줘도 결과물을 계속 쓸 수 있다면, 지급을 재촉할 수단이 사라집니다.',
      fix: { label: '사용 중단 조항 넣기', apply: function (st) { st.nonPaymentBan = true; } } },
    { id: 'noScope', level: '제안', when: function (st) { return !st.scopeChange; },
      title: '범위 변경 절차가 없습니다', detail: '말로 하는 추가 요청을 변경 합의서로 받는 문장 하나면, 나중에 "그것도 해줬어야지"를 줄일 수 있습니다.',
      fix: { label: '변경 절차 넣기', apply: function (st) { st.scopeChange = true; } } },
    { id: 'noPortfolio', level: '제안', when: function (st) { return !st.portfolio; },
      title: '포트폴리오 사용 조항이 없습니다', detail: '완성 후 작업물을 소개에 쓸 수 있는지 미리 정해 두면, 나중에 허락을 구하는 일이 없습니다.',
      fix: { label: '포트폴리오 조항 넣기', apply: function (st) { st.portfolio = true; } } },
    { id: 'zeroPrice', level: '치명', when: function (st, c) { return c.lines.some(function (l) { return l.amount <= 0; }); },
      title: '금액이 0원인 항목이 있습니다', detail: '0원 항목은 "공짜로 해준다"는 뜻으로 읽힐 수 있습니다. 빼거나 금액을 넣으세요.',
      fix: null }
  ];

  function score(st) {
    var c = calc(st);
    var p = [];

    // A. 대금 구조 (25)
    var dep = num(st.split[0], 0), mid = num(st.split[1], 0), bal = num(st.split[2], 0);
    var a1 = dep >= 50 ? 16 : dep >= 30 ? 14 : dep >= 20 ? 11 : dep >= 10 ? 7 : dep > 0 ? 4 : 0;
    var a2 = mid > 0 ? 3 : 0;
    var a3 = bal <= 50 ? 6 : bal <= 60 ? 3 : 0;
    p.push({ key: 'pay', label: '대금 구조', got: a1 + a2 + a3, max: 25, why: '선금 ' + dep + '% · 중도금 ' + mid + '% · 잔금 ' + bal + '%' });

    // B. 범위 명확성 (20)
    var n = c.lines.length;
    var b1 = n >= 5 ? 10 : n === 4 ? 9 : n === 3 ? 7 : n === 2 ? 4 : n === 1 ? 2 : 0;
    var badLines = c.lines.filter(function (l) { return !(l.qty > 0) || !(l.price > 0); }).length;
    var b2 = c.lines.length ? Math.max(0, 4 - badLines * 2) : 0;
    var bl = String(st.brief || '').trim();
    var b3 = bl.length >= 30 ? 6 : bl.length >= 15 ? 4 : bl.length >= 8 ? 2 : 0;
    p.push({ key: 'scope', label: '범위 명확성', got: b1 + b2 + b3, max: 20, why: '산출물 ' + n + '개 · 설명 ' + bl.length + '자' });

    // C. 수정·검수 (15)
    var rev = num(st.revisions, 0);
    var c1 = rev <= 3 ? 8 : rev <= 5 ? 5 : 2;
    var c2 = num(st.inspectionDays, 0) > 0 && num(st.inspectionDays, 0) <= 10 ? 4 : num(st.inspectionDays, 0) > 10 ? 2 : 0;
    var c3 = st.autoAccept ? 3 : 0;
    p.push({ key: 'revision', label: '수정·검수', got: c1 + c2 + c3, max: 15, why: '무상 수정 ' + rev + '회 · 검수 ' + num(st.inspectionDays, 0) + '영업일' });

    // D. 저작권 (14)
    var d1 = st.copyright === 'on_balance' ? 14 : st.copyright === 'license' ? 12 : st.copyright === 'on_delivery' ? 8 : 0;
    p.push({ key: 'copy', label: '권리 귀속', got: d1, max: 14, why: st.copyright === 'on_balance' ? '잔금 완납 시 양도' : st.copyright === 'license' ? '이용허락(권리 보유)' : st.copyright === 'on_delivery' ? '납품 시 양도' : '조항 없음' });

    // E. 해지·정산 (12)
    var e1 = (st.termination ? 8 : 0) + (num(st.cancelFee, 0) > 0 ? 4 : 0);
    p.push({ key: 'end', label: '해지·정산', got: e1, max: 12, why: st.termination ? '진행 공수 정산 · 취소 수수료 ' + num(st.cancelFee, 0) + '%' : '조항 없음' });

    // F. 미지급 대응 (9)
    var lr = num(st.lateRate, 0);
    var f1 = lr >= 12 ? 5 : lr >= 6 ? 3 : lr > 0 ? 1 : 0;
    var f2 = st.nonPaymentBan ? 4 : 0;
    p.push({ key: 'unpaid', label: '미지급 대응', got: f1 + f2, max: 9, why: '지연이자 연 ' + lr + '% · 사용중단 ' + (st.nonPaymentBan ? '있음' : '없음') });

    // G. 기록·기타 (5)
    var g1 = (st.portfolio ? 2 : 0) + (st.scopeChange ? 3 : 0);
    p.push({ key: 'misc', label: '기록·변경', got: g1, max: 5, why: '포트폴리오 ' + (st.portfolio ? 'O' : 'X') + ' · 변경절차 ' + (st.scopeChange ? 'O' : 'X') });

    var base = p.reduce(function (a, x) { return a + x.got; }, 0);
    if (c.empty) base = 0;

    // 위험 항목 + 고쳤을 때 오르는 점수
    var risks = [];
    RISKS.forEach(function (r) {
      var hit = false;
      try { hit = r.when(st, c); } catch (e) { hit = false; }
      if (!hit) return;
      var gain = 0;
      if (r.fix) {
        var clone = JSON.parse(JSON.stringify(st));
        r.fix.apply(clone);
        gain = Math.max(0, rawScore(clone) - base);
      }
      risks.push({ id: r.id, level: r.level, title: r.title, detail: r.detail, fixLabel: r.fix ? r.fix.label : '', gain: gain, riskId: r.id });
    });
    var order = { '치명': 0, '주의': 1, '제안': 2 };
    risks.sort(function (x, y) { return order[x.level] - order[y.level] || y.gain - x.gain; });

    // 치명 위험이 남아 있으면 총점을 54점 이하로 묶는다.
    var total = base;
    if (risks.some(function (r) { return r.level === '치명'; })) total = Math.min(total, 54);

    return { total: Math.max(0, Math.min(100, Math.round(total))), band: band(total), dims: p, risks: risks, calc: c };
  }

  /* 위험 항목의 '고치기' 버튼이 호출하는 함수. 상태를 복제해 적용한다. */
  function applyFix(st, id) {
    var clone = JSON.parse(JSON.stringify(st));
    for (var i = 0; i < RISKS.length; i++) {
      if (RISKS[i].id === id && RISKS[i].fix) { RISKS[i].fix.apply(clone); break; }
    }
    return clone;
  }

  function rawScore(st) {
    var c = calc(st), t = 0;
    var dep = num(st.split[0], 0), mid = num(st.split[1], 0), bal = num(st.split[2], 0);
    t += dep >= 50 ? 16 : dep >= 30 ? 14 : dep >= 20 ? 11 : dep >= 10 ? 7 : dep > 0 ? 4 : 0;
    t += mid > 0 ? 3 : 0;
    t += bal <= 50 ? 6 : bal <= 60 ? 3 : 0;
    var n = c.lines.length;
    t += n >= 5 ? 10 : n === 4 ? 9 : n === 3 ? 7 : n === 2 ? 4 : n === 1 ? 2 : 0;
    var bad = c.lines.filter(function (l) { return !(l.qty > 0) || !(l.price > 0); }).length;
    t += c.lines.length ? Math.max(0, 4 - bad * 2) : 0;
    var bl = String(st.brief || '').trim();
    t += bl.length >= 30 ? 6 : bl.length >= 15 ? 4 : bl.length >= 8 ? 2 : 0;
    var rev = num(st.revisions, 0);
    t += rev <= 3 ? 8 : rev <= 5 ? 5 : 2;
    var ins = num(st.inspectionDays, 0);
    t += ins > 0 && ins <= 10 ? 4 : ins > 10 ? 2 : 0;
    t += st.autoAccept ? 3 : 0;
    t += st.copyright === 'on_balance' ? 14 : st.copyright === 'license' ? 12 : st.copyright === 'on_delivery' ? 8 : 0;
    t += (st.termination ? 8 : 0) + (num(st.cancelFee, 0) > 0 ? 4 : 0);
    var lr = num(st.lateRate, 0);
    t += lr >= 12 ? 5 : lr >= 6 ? 3 : lr > 0 ? 1 : 0;
    t += st.nonPaymentBan ? 4 : 0;
    t += (st.portfolio ? 2 : 0) + (st.scopeChange ? 3 : 0);
    return c.empty ? 0 : Math.max(0, Math.min(100, Math.round(t)));
  }

  /* ── 문서 모델 ─────────────────────────────────── */
  function names(st) {
    var client = (st.client || '').trim() || '거래처';
    var contact = (st.contact || '').trim();
    var me = (st.freelancer || '').trim() || '프리랜서';
    var biz = (st.freelancerBiz || '').trim();
    return {
      client: client + (contact ? ' / ' + contact : ''),
      clientOnly: client,
      me: me + (biz && biz !== me ? ' (' + biz + ')' : ''),
      meOnly: me
    };
  }

  function docNo(st) {
    if (st.quoteNo) return st.quoteNo;
    return 'Q-' + fmtDate(st.start, 'compact') + '-01';
  }

  function copyrightText(st) {
    switch (st.copyright) {
      case 'on_balance':
        return '을(수급자)이 작성한 결과물의 저작재산권은 갑이 계약금액 전액을 지급한 때에 갑에게 양도된다. 양도 범위에는 2차적저작물작성권을 포함한다. 잔금 지급 전까지 결과물의 사용·배포·수정·상업적 이용은 갑의 권한에 속하지 않는다.';
      case 'license':
        return '결과물의 저작재산권은 을에게 귀속되며, 을은 갑에게 계약 목적 범위 내에서 결과물을 사용할 수 있는 비독점적 이용권을 부여한다. 2차적저작물 작성 및 재판매는 별도 서면 합의가 있어야 한다.';
      case 'on_delivery':
        return '을이 작성한 결과물의 저작재산권은 갑이 결과물을 인도받은 때에 갑에게 양도된다. 다만 대금 미지급분이 있는 경우 갑은 양도된 권리를 행사할 수 없다.';
      default:
        return '';
    }
  }

  function articles(st, c) {
    var N = names(st);
    var out = [];
    var add = function (title, body) { out.push({ title: title, body: body }); };

    add('목적', '본 계약은 갑이 을에게 위탁하는 「' + (st.title || '용역') + '」 업무의 범위, 대금, 일정 및 당사자의 권리·의무를 정함을 목적으로 한다.');

    var scopeRows = c.lines.map(function (l, i) {
      return (i + 1) + '. ' + l.name + ' — ' + (l.unit === '일' ? '공수 ' + l.qty + '일' : l.qty + l.unit) + (l.desc ? ' (' + l.desc + ')' : '');
    }).join('\n');
    add('용역의 내용 및 범위',
      '① 을이 갑에게 제공하는 용역의 산출물은 다음 각 호와 같다.\n' + (scopeRows || '1. (항목 미지정)') +
      '\n② 위 각 호에 명시되지 않은 업무는 본 계약의 범위에 포함되지 않으며, 필요한 경우 별도의 변경 합의에 따른다.' +
      (String(st.brief || '').trim() ? '\n③ 본 용역의 목적: ' + String(st.brief).trim() : ''));

    add('계약기간 및 일정',
      '① 계약기간: ' + fmtDate(c.start, 'dot') + ' ~ ' + fmtDate(c.delivery, 'dot') + '\n' +
      '② 최종 산출물 납품 예정일: ' + fmtDate(c.delivery, 'dot') + ' (' + weekdayKR(c.delivery) + ')\n' +
      '③ 갑의 자료 제공·피드백 지연으로 일정이 밀리는 경우, 납품일은 지연된 기간만큼 순연된다.');

    var payLines = c.splits.map(function (s) {
      return '· ' + s.label + ' ' + s.pct + '% — ' + won(s.amount) + '원 / ' + s.note + ' (' + s.dueText + ')';
    }).join('\n');
    var vatText = st.vat === 'exclude'
      ? '공급가액 ' + won(c.supply) + '원에 부가가치세 ' + won(c.vat) + '원을 더한 금액'
      : st.vat === 'include' ? '부가가치세가 포함된 금액' : '부가가치세 면세 또는 과세 제외 금액';
    add('계약금액 및 지급방법',
      '① 계약금액: 일금 ' + korAmount(c.total) + '원정 (₩' + won(c.total) + ', ' + vatText + ')\n' +
      '② 지급 일정\n' + payLines + '\n' +
      '③ 지급 방법: 갑은 을이 지정한 계좌로 이체하며, 이체 수수료는 갑이 부담한다.\n' +
      (st.withholding ? '④ 갑은 을의 용역대금 중 ' + won(c.withholding) + '원(3.3%: 소득세 3% 및 개인지방소득세 0.3%)을 원천징수하고, 원천징수영수증을 을에게 교부한다.\n' : '') +
      '⑤ 갑이 지급기일을 넘겨 대금을 지급하는 경우, 그 다음 날부터 실제 지급일까지 상법 제54조의 상사법정이율(연 6%) 이상의 비율로 계산한 지연이자를 가산하여 지급한다.');

    var revClause = '① 을은 최종 산출물에 대하여 무상으로 ' + num(st.revisions, 0) + '회의 수정을 제공한다. 무상 수정은 이미 합의된 기획·디자인 범위 내의 오류 정정 및 문구·이미지 교체를 말한다.\n' +
      '② 제1항의 횟수를 초과하는 수정, 또는 기획 자체의 변경·신규 기능 추가는 추가 작업으로 보며, 1회당 ' + won(c.extraFee) + '원(부가가치세 별도)을 갑이 을에게 지급한다.\n' +
      '③ 갑은 수정 요청 시 요청 사항과 근거를 서면(이메일·메신저 포함)으로 전달한다.';
    add('수정 및 추가 작업', revClause);

    add('검수',
      '① 갑은 산출물을 인도받은 날부터 ' + num(st.inspectionDays, 0) + '영업일 이내에 서면으로 검수 결과 또는 구체적인 하자 내용을 을에게 통지한다.\n' +
      (st.autoAccept ? '② 제1항의 기간 내에 통지가 없는 경우, 산출물은 검수를 완료한 것으로 본다. 이 경우 잔금 지급기일은 검수 완료일을 기준으로 기산한다.\n' : '') +
      '③ 검수 기준은 본 계약 제2조의 산출물 범위이며, 계약에 없는 사항을 이유로 검수를 거절할 수 없다.');

    if (st.copyright !== 'none') {
      add('지식재산권의 귀속', '① ' + copyrightText(st) + '\n② 을은 결과물에 사용된 제3자 라이선스(폰트·이미지·오픈소스) 목록을 갑에게 고지한다. 해당 라이선스 비용은 별도 협의한다.');
    }

    add('계약의 해지 및 정산',
      (st.termination
        ? '① 갑은 작업 착수 후 본 계약을 해지하려는 경우 7일 전 서면으로 통지하며, 해지 시점까지의 진행 공수를 기준으로 산정한 대금과 계약금액의 ' + num(st.cancelFee, 0) + '%에 해당하는 취소 수수료를 을에게 지급한다.\n'
        : '① 어느 일방이 본 계약을 해지하려는 경우 상대방에게 서면으로 통지한다.\n') +
      '② 을의 귀책사유로 납품이 ' + '14일 이상 지연되거나 연락이 두절된 경우, 갑은 계약을 해지할 수 있다. 이 경우 을은 기지급받은 대금 중 미이행 부분을 반환한다.\n' +
      '③ 해지에도 불구하고 이미 인도된 산출물에 대한 대금 지급 의무와 제6조의 권리 귀속은 영향을 받지 않는다.');

    var unpaid = '① 갑이 대금 지급기일을 넘긴 경우, 을은 서면으로 지급을 최고하고 상당한 기간을 정하여 이행을 요구할 수 있다.\n' +
      (st.nonPaymentBan ? '② 갑이 정당한 사유 없이 대금 지급을 ' + '14일 이상 지연하는 경우, 을은 결과물의 사용·배포·수정 및 상업적 이용의 중단을 요구할 수 있으며, 갑은 즉시 이에 응한다.\n' : '') +
      '③ 미지급 대금에 대하여는 제4조 제5항의 지연이자를 적용한다.';
    add('대금 미지급에 대한 조치', unpaid);

    if (st.delayPenalty) {
      add('지체상금',
        '① 을의 귀책사유로 납품이 지연되는 경우, 을은 갑에게 지연 1일당 계약금액의 0.1%에 해당하는 금액을 지체상금으로 지급한다. 다만 총 지체상금은 계약금액의 10%를 초과하지 않는다.\n' +
        '② 갑의 자료 제공·검수·피드백 지연으로 발생한 기간은 지체상금 산정에서 제외한다.');
    }

    if (st.liability) {
      add('손해배상',
        '① 어느 일방이 본 계약을 위반하여 상대방에게 손해를 입힌 경우 그 손해를 배상한다.\n' +
        '② 을의 배상책임은 특별한 고의 또는 중대한 과실이 없는 한 본 계약금액을 한도로 한다.');
    }

    if (st.confidential) {
      add('비밀유지',
        '① 양 당사자는 본 계약 수행 중 알게 된 상대방의 영업비밀·개인정보를 제3자에게 누설하거나 본 계약 목적 외로 사용하지 않는다.\n② 본 조의 의무는 계약 종료 후 2년간 존속한다.');
    }

    if (st.portfolio) {
      add('포트폴리오 사용',
        '① 을은 완성된 결과물을 을의 포트폴리오 및 작업 소개 목적으로 게시할 수 있다.\n② 갑이 게시를 원하지 않는 경우 서면으로 요청하며, 이 경우 을은 해당 결과물을 비공개로 한다.');
    }

    if (st.scopeChange) {
      add('계약 내용의 변경',
        '본 계약의 내용을 변경하거나 추가 업무를 진행하는 경우, 양 당사자는 변경 사항·추가 금액·일정을 기재한 변경 합의서를 작성하고 서명 또는 전자우편으로 확인한다. 서면 합의가 없는 추가 요청은 본 계약의 범위에 포함되지 않는다.');
    }

    add('불가항력',
      '천재지변, 정부 조치, 통신 장애 등 당사자의 통제를 벗어난 사유로 의무를 이행하지 못한 경우 그 책임을 지지 않는다. 다만 해당 사유가 종료된 후에는 가능한 범위에서 의무를 이행한다.');

    add('분쟁의 해결',
      '본 계약과 관련한 분쟁은 양 당사자가 성실히 협의하여 해결하며, 협의가 이루어지지 않는 경우 「민사소송법」에 따른 관할 법원에 제소한다.');

    add('기타',
      '① 본 계약에 정하지 않은 사항은 관련 법령 및 일반 상관례에 따른다.\n② 본 계약의 내용을 증명하기 위하여 계약서 2부를 작성하고, 갑과 을이 각 1부씩 보관한다.');
    return out;
  }

  function buildQuoteText(st, c) {
    var N = names(st);
    var L = [];
    var line = function (s) { L.push(s == null ? '' : s); };
    line('견 적 서');
    line('────────────────────────────────────────────');
    line('견적번호: ' + docNo(st));
    line('견적일: ' + fmtDate(st.start, 'dot') + '    유효기간: ' + fmtDate(addDays(st.start, 14), 'dot'));
    line('');
    line('수신: ' + N.client);
    line('발신: ' + N.me);
    line('건명: ' + (st.title || '용역'));
    line('');
    if (String(st.brief || '').trim()) { line('■ 프로젝트 개요'); line(String(st.brief).trim()); line(''); }
    line('■ 견적 내역');
    line('No | 항목 | 수량 | 단가 | 금액');
    c.lines.forEach(function (l, i) {
      line((i + 1) + ' | ' + l.name + ' | ' + l.qty + l.unit + ' | ' + won(l.price) + ' | ' + won(l.amount));
    });
    line('');
    line('공급가액: ' + won(c.supply) + '원');
    if (st.vat !== 'none') line((st.vat === 'include' ? '부가세(포함): ' : '부가세(10%): ') + won(c.vat) + '원');
    line('총 견적금액: ' + won(c.total) + '원 (일금 ' + korAmount(c.total) + '원정)');
    if (st.withholding) line('원천징수 3.3%: ' + won(c.withholding) + '원 → 실수령 ' + won(c.net) + '원');
    line('');
    line('■ 대금 지급 조건');
    c.splits.forEach(function (s) {
      line('· ' + s.label + ' ' + s.pct + '% — ' + won(s.amount) + '원 / ' + s.note + ' (' + s.dueText + ')');
    });
    line('');
    line('■ 포함 사항');
    line('· 무상 수정 ' + num(st.revisions, 0) + '회 (합의된 범위 내)');
    line('· 검수 ' + num(st.inspectionDays, 0) + '영업일' + (st.autoAccept ? ', 기간 내 이의 없으면 검수 완료' : ''));
    if (st.portfolio) line('· 완성 후 포트폴리오 게시 가능(요청 시 비공개)');
    line('■ 별도 협의');
    line('· 무상 수정 초과분 1회당 ' + won(c.extraFee) + '원');
    line('· 계약 범위 외 신규 기능·기획 변경');
    line('· 서버·도메인·유료 폰트·이미지 등 외부 비용');
    line('');
    line('■ 일정');
    line('작업 기간: ' + fmtDate(c.start, 'dot') + ' ~ ' + fmtDate(c.delivery, 'dot') + ' (총 공수 ' + c.workDays + '일 기준)');
    line('최종 납품: ' + fmtDate(c.delivery, 'dot') + ' (' + weekdayKR(c.delivery) + ')');
    line('');
    line('■ 참고');
    line('· 본 견적서의 유효기간은 발행일로부터 14일입니다.');
    line('· 본 견적서는 계약서가 아니며, 상호 서명한 용역계약서가 체결되면 그 내용이 우선합니다.');
    line('· 상기 금액은 부가가치세 ' + (st.vat === 'exclude' ? '별도' : st.vat === 'include' ? '포함' : '제외') + ' 기준입니다.');
    line('');
    line('발신: ' + N.me + (st.email ? ' / ' + st.email : '') + (st.phone ? ' / ' + maskPhone(st.phone, st.mask) : ''));
    if (st.account) line('입금 계좌: ' + maskAccount(st.account, st.mask));
    return L.join('\n');
  }

  function buildContractText(st, c) {
    var N = names(st);
    var L = [];
    var line = function (s) { L.push(s == null ? '' : s); };
    line('용 역 계 약 서');
    line('');
    line('갑(발주자): ' + N.clientOnly + (st.contact ? ' (' + st.contact + ')' : ''));
    line('을(수급자): ' + N.meOnly);
    line('');
    line('갑과 을은 아래와 같이 용역계약을 체결하고, 이를 증명하기 위하여 계약서 2부를 작성하여 각 1부씩 보관한다.');
    line('');
    articles(st, c).forEach(function (a, i) {
      line('제' + (i + 1) + '조 (' + a.title + ')');
      a.body.split('\n').forEach(function (row) { line(row); });
      line('');
    });
    line('계약일: ' + fmtDate(st.start, 'dot'));
    line('');
    line('갑(발주자): ______________________  (서명 또는 인)');
    line('을(수급자): ______________________  (서명 또는 인)');
    return L.join('\n');
  }

  function maskAccount(v, on) {
    if (!on) return v;
    var s = String(v);
    if (s.length <= 6) return '***';
    return s.slice(0, Math.max(3, s.length - 6)).replace(/[0-9]/g, '*') + '***' + s.slice(-2);
  }
  function maskPhone(v, on) {
    if (!on) return v;
    return String(v).replace(/(\d{2,3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3');
  }

  /* ── 문서 렌더 (HTML) ──────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  function renderQuote(st, c) {
    var N = names(st);
    var rows = c.lines.map(function (l, i) {
      return '<tr><td class="c col-no">' + (i + 1) + '</td><td class="col-name"><b>' + esc(l.name) + '</b>' + (l.desc ? '<span class="p-desc">' + esc(l.desc) + '</span>' : '') + '</td>' +
        '<td class="c col-qty">' + esc(l.qty) + esc(l.unit) + '</td><td class="r col-price">' + won(l.price) + '</td><td class="r col-amt">' + won(l.amount) + '</td></tr>';
    }).join('');
    var splitRows = c.splits.map(function (s) {
      return '<tr><td><b>' + esc(s.label) + '</b> <span class="p-muted">' + s.pct + '%</span></td><td class="r">' + won(s.amount) + '</td><td class="p-small">' + esc(s.note) + '<br><span class="p-muted">' + esc(s.dueText) + '</span></td></tr>';
    }).join('');

    return '' +
      '<div class="paper-head">' +
        '<div class="paper-title">견 적 서<span>QUOTATION</span></div>' +
        '<div class="paper-meta">' +
          '<div><span>견적번호</span>' + esc(docNo(st)) + '</div>' +
          '<div><span>견적일</span>' + fmtDate(st.start, 'dot') + '</div>' +
          '<div><span>유효기간</span>' + fmtDate(addDays(st.start, 14), 'dot') + '</div>' +
        '</div>' +
      '</div>' +
      '<table class="p-parties"><tr><th>수신</th><td>' + esc(N.client) + '</td><th>발신</th><td>' + esc(N.me) + '</td></tr></table>' +
      '<h2 class="p-subject">' + esc(st.title || '용역 견적') + '</h2>' +
      (String(st.brief || '').trim() ? '<p class="p-lead">' + esc(String(st.brief).trim()) + '</p>' : '') +
      '<table class="p-table"><thead><tr><th class="c col-no">No</th><th class="col-name">항목</th><th class="c col-qty">수량</th><th class="r col-price">단가</th><th class="r col-amt">금액</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="c p-muted">항목을 선택하세요</td></tr>') +
      '</tbody></table>' +
      '<div class="p-sum">' +
        '<div><span>공급가액</span><b>' + won(c.supply) + '</b></div>' +
        (st.vat !== 'none' ? '<div><span>부가가치세 ' + (st.vat === 'include' ? '(포함)' : '10%') + '</span><b>' + won(c.vat) + '</b></div>' : '') +
        '<div class="p-total"><span>총 견적금액</span><b>' + won(c.total) + '원</b></div>' +
        '<div class="p-kor">일금 ' + korAmount(c.total) + '원정 (₩' + won(c.total) + ')</div>' +
        (st.withholding ? '<div class="p-wh">원천징수 3.3% ' + won(c.withholding) + '원 공제 시 실수령 ' + won(c.net) + '원</div>' : '') +
      '</div>' +
      '<h3 class="p-h">대금 지급 조건</h3>' +
      '<table class="p-table p-split"><tbody>' + splitRows + '</tbody></table>' +
      '<div class="p-cols">' +
        '<div><h3 class="p-h">포함 사항</h3><ul class="p-list">' +
          '<li>무상 수정 ' + num(st.revisions, 0) + '회 (합의된 범위 내)</li>' +
          '<li>검수 ' + num(st.inspectionDays, 0) + '영업일' + (st.autoAccept ? ' · 기간 내 이의 없으면 검수 완료' : '') + '</li>' +
          (st.portfolio ? '<li>완성 후 포트폴리오 게시 가능 (요청 시 비공개)</li>' : '') +
        '</ul></div>' +
        '<div><h3 class="p-h">별도 협의</h3><ul class="p-list">' +
          '<li>무상 수정 초과 1회당 ' + won(c.extraFee) + '원</li>' +
          '<li>계약 범위 외 신규 기능·기획 변경</li>' +
          '<li>서버·도메인·유료 폰트·이미지 등 외부 비용</li>' +
        '</ul></div>' +
      '</div>' +
      '<h3 class="p-h">일정</h3>' +
      '<p class="p-body">작업 기간 ' + fmtDate(c.start, 'dot') + ' ~ ' + fmtDate(c.delivery, 'dot') + ' · 총 공수 ' + c.workDays + '일 · 최종 납품 ' + fmtDate(c.delivery, 'dot') + ' (' + weekdayKR(c.delivery) + ')</p>' +
      '<div class="p-foot">' +
        '<p>· 본 견적서의 유효기간은 발행일로부터 14일입니다.</p>' +
        '<p>· 본 견적서는 계약서가 아니며, 상호 서명한 용역계약서가 체결되면 그 내용이 우선합니다.</p>' +
        '<p>· 상기 금액은 부가가치세 ' + (st.vat === 'exclude' ? '별도' : st.vat === 'include' ? '포함' : '제외') + ' 기준입니다.</p>' +
        '<p class="p-issuer">' + esc(N.me) + (st.email ? ' · ' + esc(st.email) : '') + (st.phone ? ' · ' + esc(maskPhone(st.phone, st.mask)) : '') + '</p>' +
        (st.account ? '<p class="p-issuer">입금 계좌 ' + esc(maskAccount(st.account, st.mask)) + '</p>' : '') +
      '</div>';
  }

  function renderContract(st, c) {
    var N = names(st);
    var body = articles(st, c).map(function (a, i) {
      return '<section class="p-article"><h3>제' + (i + 1) + '조 (' + esc(a.title) + ')</h3>' +
        a.body.split('\n').map(function (row) { return '<p>' + esc(row) + '</p>'; }).join('') + '</section>';
    }).join('');
    return '' +
      '<div class="paper-head p-head-center">' +
        '<div class="paper-title">용 역 계 약 서<span>SERVICE AGREEMENT</span></div>' +
      '</div>' +
      '<table class="p-parties p-parties-2"><tr><th>갑 (발주자)</th><td>' + esc(N.clientOnly) + (st.contact ? ' <span class="p-muted">' + esc(st.contact) + '</span>' : '') + '</td></tr>' +
      '<tr><th>을 (수급자)</th><td>' + esc(N.meOnly) + (st.freelancerBiz ? ' <span class="p-muted">' + esc(st.freelancerBiz) + '</span>' : '') + '</td></tr></table>' +
      '<p class="p-body p-lead-line">갑과 을은 아래와 같이 용역계약을 체결하고, 이를 증명하기 위하여 계약서 2부를 작성하여 각 1부씩 보관한다.</p>' +
      body +
      '<div class="p-sign">' +
        '<p class="p-date">' + fmtDate(st.start, 'dot') + '</p>' +
        '<table class="p-sign-table"><tr><th>갑 (발주자)</th><td class="p-sign-line">' + esc(N.clientOnly) + '</td><td class="p-stamp">(서명 또는 인)</td></tr>' +
        '<tr><th>을 (수급자)</th><td class="p-sign-line">' + esc(N.meOnly) + '</td><td class="p-stamp">(서명 또는 인)</td></tr></table>' +
      '</div>';
  }

  var API = {
    blankState: blankState, loadSample: loadSample, getIndustry: getIndustry,
    parseBrief: parseBrief, calc: calc, score: score, applyFix: applyFix,
    buildQuoteText: buildQuoteText, buildContractText: buildContractText,
    renderQuote: renderQuote, renderContract: renderContract,
    docNo: docNo, won: won, fmtDate: fmtDate, korAmount: korAmount, addDays: addDays,
    addBusinessDays: addBusinessDays, weekdayKR: weekdayKR, maskAccount: maskAccount, maskPhone: maskPhone,
    suggestExtraFee: suggestExtraFee, judgeBand: band, esc: esc,
    WITHHOLD_RATE: WITHHOLD_RATE, VAT_RATE: VAT_RATE
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.QCM = API;
})(typeof window !== 'undefined' ? window : globalThis);
