/* ─────────────────────────────────────────────────────────────
   견적·계약서 1분 — 화면 배선
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var E = window.QCM;
  var D = window.QCM_DATA;
  var PAY = window.QCM_PAY;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var STORE_KEY = 'qcm.state.v1';

  var state = E.blankState('dev');
  var last = null;          // 마지막 계산 결과
  var currentDoc = 'quote';
  var built = false;

  /* ── 공통 ─────────────────────────────── */
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function toneColor(score) {
    if (score >= 85) return '#2C6B55';
    if (score >= 70) return '#4E7A63';
    if (score >= 55) return '#A9761B';
    return '#B3372B';
  }

  /* ── 직종 ─────────────────────────────── */
  function renderChips() {
    var box = $('#industryChips');
    box.innerHTML = D.INDUSTRIES.map(function (ind) {
      return '<button type="button" class="chip-btn" data-ind="' + ind.id + '" aria-pressed="' + (state.industry === ind.id) + '">' +
        '<span class="em">' + ind.emoji + '</span>' + E.esc(ind.label) + '</button>';
    }).join('');
    var ind = E.getIndustry(state.industry);
    $('#industryNote').textContent = ind.note;
  }

  function switchIndustry(id) {
    var ind = E.getIndustry(id);
    state.industry = ind.id;
    state.items = {};
    ind.items.forEach(function (it) { state.items[it.id] = { on: !!it.on, qty: it.qty, price: it.price }; });
    renderChips();
    renderItems();
    update(true);
  }

  /* ── 항목 ─────────────────────────────── */
  function itemRow(it, s, isCustom) {
    var amt = Math.round((s.qty || 0) * (s.price || 0));
    return '<div class="item-row' + (s.on ? '' : ' off') + '" data-id="' + it.id + '"' + (isCustom ? ' data-custom="1"' : '') + '>' +
      '<input type="checkbox" data-f="on" ' + (s.on ? 'checked' : '') + ' aria-label="' + E.esc(it.name) + ' 포함">' +
      '<span class="item-name"><b>' + E.esc(it.name) + (isCustom ? '<button type="button" class="item-del" data-del="' + it.id + '" aria-label="삭제">×</button>' : '') + '</b><span>' + E.esc(it.desc || '') + '</span></span>' +
      '<div class="qty-wrap"><input type="number" data-f="qty" min="0" step="0.5" value="' + (s.qty == null ? '' : s.qty) + '" aria-label="수량"><span>' + E.esc(it.unit || '식') + '</span></div>' +
      '<input type="number" data-f="price" min="0" step="10000" value="' + (s.price == null ? '' : s.price) + '" aria-label="단가">' +
      '<span class="item-amt">' + E.won(amt) + '</span>' +
    '</div>';
  }

  function renderItems() {
    var ind = E.getIndustry(state.industry);
    var html = '<div class="item-row head"><span></span><span>항목</span><span>수량</span><span>단가</span><span class="item-amt">금액</span></div>';
    ind.items.forEach(function (it) {
      var s = state.items[it.id] || { on: false, qty: it.qty, price: it.price };
      html += itemRow(it, s, false);
    });
    state.custom.forEach(function (c) {
      html += itemRow({ id: c.id, name: c.name, desc: c.desc, unit: c.unit }, c, true);
    });
    $('#itemList').innerHTML = html;
  }

  function recalcRow(id) {
    var s = (state.items[id] || state.custom.filter(function (c) { return c.id === id; })[0]);
    var row = $('.item-row[data-id="' + id + '"]');
    if (!s || !row) return;
    row.classList.toggle('off', !s.on);
    var amt = row.querySelector('.item-amt');
    if (amt && !amt.classList.contains('head')) amt.textContent = E.won(Math.round((s.qty || 0) * (s.price || 0)));
  }

  /* ── 폼 → 상태 ────────────────────────── */
  var TEXT_FIELDS = ['brief', 'title', 'client', 'contact', 'start', 'freelancer', 'freelancerBiz', 'email', 'phone', 'account'];
  var NUM_FIELDS = { revisions: 'revisions', inspectionDays: 'inspectionDays', extraFee: 'extraFee', cancelFee: 'cancelFee' };
  var BOOL_FIELDS = { autoAccept: 'autoAccept', termination: 'termination', nonPaymentBan: 'nonPaymentBan', delayPenalty: 'delayPenalty', scopeChange: 'scopeChange', portfolio: 'portfolio', confidential: 'confidential', liability: 'liability', withholding: 'withholding' };

  function readForm() {
    TEXT_FIELDS.forEach(function (k) { var el = $('#' + k); if (el) state[k] = el.value; });
    Object.keys(NUM_FIELDS).forEach(function (id) { var el = $('#' + id); if (el) state[NUM_FIELDS[id]] = el.value === '' ? '' : Number(el.value); });
    Object.keys(BOOL_FIELDS).forEach(function (id) { var el = $('#' + id); if (el) state[BOOL_FIELDS[id]] = el.checked; });
    var vat = $('#vat'), cp = $('#copyright'), lr = $('#lateRate');
    if (vat) state.vat = vat.value;
    if (cp) state.copyright = cp.value;
    if (lr) state.lateRate = Number(lr.value);
    var a = Number($('#splitA').value || 0), b = Number($('#splitB').value || 0);
    a = Math.max(0, Math.min(100, a)); b = Math.max(0, Math.min(100 - a, b));
    state.split = [a, b, Math.max(0, 100 - a - b)];
    $('#splitA').value = a; $('#splitB').value = b; $('#splitC').value = state.split[2];
    $('#splitSum').textContent = (a + b + state.split[2]) + '%';
    state.mask = $('#maskToggle').checked;
  }

  function writeForm() {
    TEXT_FIELDS.forEach(function (k) { var el = $('#' + k); if (el) el.value = state[k] == null ? '' : state[k]; });
    Object.keys(NUM_FIELDS).forEach(function (id) { var el = $('#' + id); if (el) el.value = state[NUM_FIELDS[id]] == null ? '' : state[NUM_FIELDS[id]]; });
    Object.keys(BOOL_FIELDS).forEach(function (id) { var el = $('#' + id); if (el) el.checked = !!state[BOOL_FIELDS[id]]; });
    $('#vat').value = state.vat;
    $('#copyright').value = state.copyright;
    $('#lateRate').value = String(state.lateRate);
    $('#splitA').value = state.split[0];
    $('#splitB').value = state.split[1];
    $('#splitC').value = state.split[2];
    $('#splitSum').textContent = state.split.reduce(function (x, y) { return x + y; }, 0) + '%';
    $('#maskToggle').checked = !!state.mask;
  }

  /* ── 라이브 패널 ──────────────────────── */
  function update(skipDocs) {
    readForm();
    var c = E.calc(state);
    var sc = E.score(state);
    last = { c: c, sc: sc };

    // 점수 링
    var pct = sc.total;
    var ring = $('#scoreRing');
    ring.style.setProperty('--p', pct);
    ring.style.setProperty('--ring-c', toneColor(pct));
    $('#scoreNum').innerHTML = pct + '<small>점</small>';
    $('#scoreBand').textContent = c.empty ? '항목 없음' : sc.band.label;
    $('#scoreBand').style.color = c.empty ? 'var(--muted)' : toneColor(pct);
    $('#scoreSub').textContent = c.empty ? '체크한 항목이 없습니다' : sc.band.text;

    $('#mSupply').textContent = E.won(c.supply) + '원';
    $('#mVat').textContent = state.vat === 'none' ? '없음' : E.won(c.vat) + '원';
    $('#mTotal').textContent = E.won(c.total) + '원';
    var bal = c.splits[c.splits.length - 1];
    $('#mBalance').textContent = E.won(bal ? bal.amount : 0) + '원';
    $('#mLate').textContent = E.won(c.lateDaily) + '원';
    $('#footSupply').textContent = E.won(c.supply) + '원';

    $('#liveDims').innerHTML = sc.dims.map(function (d) {
      var w = d.max ? Math.round(d.got / d.max * 100) : 0;
      return '<div class="dim"><span>' + d.label + '</span><i><b style="width:' + w + '%"></b></i><em>' + d.got + '/' + d.max + '</em></div>';
    }).join('');

    var risks = sc.risks;
    $('#riskCount').textContent = risks.length;
    if (!risks.length) {
      $('#riskList').innerHTML = '<p class="risk-empty">' + (c.empty ? '항목을 체크하면 점검이 시작됩니다.' : '지금 조건에서 크게 비어 있는 조항은 없습니다.') + '</p>';
    } else {
      $('#riskList').innerHTML = risks.map(function (r) {
        return '<div class="risk-item" data-lvl="' + r.level + '">' +
          '<span class="lvl">' + r.level + '</span><span class="t">' + E.esc(r.title) + '</span>' +
          '<p class="d">' + E.esc(r.detail) + '</p>' +
          (r.fixLabel ? '<button type="button" class="risk-fix" data-fix="' + r.riskId + '">' + E.esc(r.fixLabel) + (r.gain ? ' <b>+' + r.gain + '점</b>' : '') + '</button>' : '') +
        '</div>';
      }).join('');
    }

    // 자동 저장
    if ($('#autosave').checked) save();
    if (built && !skipDocs) renderDoc();
  }

  /* ── 문서 ─────────────────────────────── */
  function docHTML() {
    var c = last.c;
    return currentDoc === 'quote' ? E.renderQuote(state, c) : E.renderContract(state, c);
  }
  function docText() {
    var c = last.c;
    return currentDoc === 'quote' ? E.buildQuoteText(state, c) : E.buildContractText(state, c);
  }

  function renderDoc() {
    var view = $('#docView');
    if (last.c.empty && currentDoc === 'quote') {
      view.innerHTML = '<div class="doc-empty"><p style="font-family:var(--serif);font-size:20px;color:var(--ink)">항목을 먼저 체크해 주세요</p><p>2번 단계에서 산출물을 고르면 견적서가 만들어집니다.</p></div>';
      return;
    }
    view.innerHTML = docHTML();
    $('#docMeta').textContent =
      (currentDoc === 'quote' ? '견적서' : '용역계약서') + ' · ' + E.docNo(state) + ' · ' +
      E.fmtDate(state.start, 'dot') + ' · 방어 점수 ' + last.sc.total + '점' +
      (state.mask ? ' · 공유용 마스킹 켜짐' : '');
  }

  function build(scroll) {
    readForm();
    last = { c: E.calc(state), sc: E.score(state) };
    if (last.c.empty) { toast('2번 단계에서 항목을 하나 이상 체크해 주세요'); return; }
    if (!state.title && state.brief) state.title = state.brief.split(/\s+[—\-–]\s+|,\s*/)[0].slice(0, 40);
    if (!$('#title').value && state.title) $('#title').value = state.title;
    built = true;
    renderDoc();
    if (scroll) $('#output').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('견적서와 계약서를 만들었습니다');
  }

  /* ── 저장 ─────────────────────────────── */
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가(사생활 보호 모드 등) */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || !s.industry) return false;
      var base = E.blankState(s.industry);
      Object.keys(base).forEach(function (k) { if (s[k] !== undefined) base[k] = s[k]; });
      state = base;
      return true;
    } catch (e) { return false; }
  }

  /* ── 이벤트 ───────────────────────────── */
  function bind() {
    // 직종
    $('#industryChips').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ind]');
      if (b) switchIndustry(b.getAttribute('data-ind'));
    });

    // 폼 전체: 입력 즉시 반영
    var form = $('.maker-form');
    form.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.closest('.item-row')) return; // 항목은 따로
      update();
    });
    form.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.closest('.item-row')) return;
      update();
    });

    // 항목 표
    $('#itemList').addEventListener('input', function (ev) {
      var row = ev.target.closest('.item-row');
      if (!row) return;
      var id = row.getAttribute('data-id');
      var f = ev.target.getAttribute('data-f');
      if (!f) return;
      var store = row.hasAttribute('data-custom')
        ? state.custom.filter(function (c) { return c.id === id; })[0]
        : state.items[id];
      if (!store) return;
      if (f === 'on') store.on = ev.target.checked;
      else store[f] = ev.target.value === '' ? '' : Number(ev.target.value);
      recalcRow(id);
      update();
    });
    $('#itemList').addEventListener('change', function (ev) {
      if (ev.target.getAttribute('data-f') === 'on') {
        var row = ev.target.closest('.item-row');
        var id = row.getAttribute('data-id');
        var store = row.hasAttribute('data-custom') ? state.custom.filter(function (c) { return c.id === id; })[0] : state.items[id];
        if (store) { store.on = ev.target.checked; row.classList.toggle('off', !store.on); update(); }
      }
    });
    $('#itemList').addEventListener('click', function (ev) {
      var del = ev.target.closest('[data-del]');
      if (!del) return;
      var id = del.getAttribute('data-del');
      state.custom = state.custom.filter(function (c) { return c.id !== id; });
      renderItems(); update();
    });

    // 항목 추가
    function addItem() {
      var inp = $('#customName');
      var name = inp.value.trim();
      if (!name) { inp.focus(); return; }
      var id = 'c' + Date.now().toString(36);
      state.custom.push({ id: id, name: name, desc: '직접 추가한 항목', qty: 1, unit: '식', price: 0, on: true });
      inp.value = '';
      renderItems(); update();
      var row = $('.item-row[data-id="' + id + '"] [data-f="price"]');
      if (row) row.focus();
    }
    $('#btnAddItem').addEventListener('click', addItem);
    $('#customName').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });

    // 분할 프리셋
    $('#splitPresets').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-split]');
      if (!b) return;
      var v = b.getAttribute('data-split').split(',').map(Number);
      $('#splitA').value = v[0]; $('#splitB').value = v[1];
      update();
    });

    // 위험 고치기
    $('#riskList').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-fix]');
      if (!b) return;
      state = E.applyFix(state, b.getAttribute('data-fix'));
      writeForm(); renderChips(); renderItems();
      update();
      if (built) renderDoc();
      toast('조건을 바꿨습니다. 점수를 확인하세요.');
    });

    // 만들기
    $('#btnBuild').addEventListener('click', function () { build(true); });
    $('#emptyBuild').addEventListener('click', function () { $('#maker').scrollIntoView({ behavior: 'smooth' }); });
    $('#emptySample').addEventListener('click', loadSampleAndBuild);
    $('#heroSample').addEventListener('click', loadSampleAndBuild);
    $('#btnSample').addEventListener('click', function () { loadSampleAndBuild(false); });

    // 탭
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        currentDoc = t.getAttribute('data-doc');
        $$('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
        if (built) renderDoc();
        else { build(false); }
      });
    });

    // 도구
    $('#btnPrint').addEventListener('click', function () {
      if (!built) build(false);
      if (!built) return;
      $('#printArea').innerHTML = '<div class="paper">' + docHTML() + '</div>';
      setTimeout(function () { window.print(); }, 60);
    });
    $('#btnCopy').addEventListener('click', function () {
      if (!built) { build(false); if (!built) return; }
      var text = docText();
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { toast('문서를 복사했습니다'); }, fallbackCopy);
      } else fallbackCopy();
      function fallbackCopy() {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('문서를 복사했습니다'); } catch (e) { toast('복사가 막혀 있습니다. 텍스트 저장을 이용하세요'); }
        document.body.removeChild(ta);
      }
    });
    $('#btnTxt').addEventListener('click', function () {
      if (!built) { build(false); if (!built) return; }
      var name = (currentDoc === 'quote' ? '견적서' : '용역계약서') + '_' + (state.title || '문서').replace(/[\\/:*?"<>|]/g, '').slice(0, 30) + '_' + E.fmtDate(state.start, 'compact') + '.txt';
      var blob = new Blob(['\ufeff' + docText()], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('텍스트 파일로 저장했습니다');
    });
    $('#maskToggle').addEventListener('change', function () { update(); if (built) renderDoc(); });

    // 설명에서 채우기
    $('#btnParse').addEventListener('click', function () {
      var txt = $('#brief').value.trim();
      if (!txt) { $('#brief').focus(); toast('프로젝트 설명을 먼저 적어 주세요'); return; }
      var r = E.parseBrief(txt);
      if (r.industry !== state.industry) {
        state.industry = r.industry;
        state.items = {};
        E.getIndustry(r.industry).items.forEach(function (it) { state.items[it.id] = { on: false, qty: it.qty, price: it.price }; });
      }
      r.items.forEach(function (id) { if (state.items[id]) state.items[id].on = true; });
      if (r.title && !$('#title').value) { $('#title').value = r.title; state.title = r.title; }
      if (r.client && !$('#client').value) { $('#client').value = r.client; state.client = r.client; }
      renderChips(); renderItems(); update();
      $('#parseHint').textContent = '직종을 "' + E.getIndustry(r.industry).label + '"(으)로 잡고 항목 ' + r.items.length + '개를 켰습니다. 필요 없는 항목은 끄세요.';
      toast('설명에서 항목을 채웠습니다');
    });

    // 자동 저장
    $('#autosave').addEventListener('change', function () {
      if (this.checked) { save(); toast('이 브라우저에 저장합니다'); }
      else { try { localStorage.removeItem(STORE_KEY); } catch (e) {} toast('저장을 껐습니다'); }
    });
    $('#btnClearSave').addEventListener('click', function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      toast('저장된 내용을 지웠습니다');
    });

    // 예시/초기화
    $('#btnReset').addEventListener('click', function () {
      state = E.blankState(state.industry);
      writeForm(); renderChips(); renderItems(); update();
      toast('입력 내용을 비웠습니다');
    });

    // 유료 상품
    $$('[data-pay]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-pay');
        var url = PAY.urlFor(key);
        if (url) { window.open(url, '_blank', 'noopener'); return; }
        var ctx = { title: state.title, industry: E.getIndustry(state.industry).label, total: last ? E.won(last.c.total) : '', score: last ? last.sc.total : null };
        window.location.href = PAY.mailto(key, ctx);
      });
    });

    // 문의
    $('#btnInquiry').addEventListener('click', function () {
      var name = $('#inqName').value.trim();
      var contact = $('#inqContact').value.trim();
      var body = $('#inqBody').value.trim();
      if (!body) { $('#inqBody').focus(); toast('문의 내용을 적어 주세요'); return; }
      if (!contact) { $('#inqContact').focus(); toast('회신 받을 이메일을 적어 주세요'); return; }
      window.location.href = PAY.inquiryMailto({ name: name, contact: contact, body: body, topic: '질문' });
    });

    // 키보드: 문서 영역에서 Ctrl/Cmd+P 안내 등은 기본 동작 유지
  }

  function loadSampleAndBuild(scroll) {
    state = E.loadSample();
    writeForm(); renderChips(); renderItems();
    built = true;
    last = { c: E.calc(state), sc: E.score(state) };
    renderDoc(); update(true);
    if (scroll !== false) $('#output').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('예시 문서를 불러왔습니다. 조건을 바꿔 보세요');
  }

  /* ── 시작 ─────────────────────────────── */
  function init() {
    if (restore() && $('#autosave')) $('#autosave').checked = true;
    writeForm();
    renderChips();
    renderItems();
    bind();
    update(true);
    // 첫 화면에서 점수 링이 0부터 차오르는 효과
    setTimeout(function () { update(true); }, 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
