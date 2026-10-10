/* ===================================================================
   COLOR.M 마음색 그림책 메이커 — 공통 스크립트
   프로젝트 데이터 모델, localStorage 저장/불러오기, 공통 헤더/네비 렌더,
   복사/토스트, PDF·TXT 저장을 각 메이커(01-plan ~ 05-scene)가 공유합니다.

   사용법 (각 메이커 index.html):
     <div id="cmHeader"></div>
     ...
     <script src="../shared/colorm.js"></script>
     <script>
       ColorM.renderHeader('cmHeader', 'plan');           // 헤더+5단계 네비+프로젝트명
       ColorM.renderStepNav('cmStepNav', 'plan');          // 이전/다음 단계 버튼
     </script>
   =================================================================== */
const ColorM = (function () {
  const STORAGE_KEY = 'colorm_project_v1';
  const DEFAULT_PROJECT_NAME = '나의 AI 그림책 프로젝트';
  const GALLERY_URL = 'https://mlyoo7107-ux.github.io/PRODUCT-DESIGN-MAKER/gallery/index.html?product=PICTURE_BOOK_MAKER';

  /* ---------- 결제 · 무료 체험 (프로젝트 1개는 끝까지 무료, 2번째 프로젝트부터 결제) ---------- */
  const PAYMENT_STATUS_API_URL = 'https://colorm-pdm-payment.milan71.workers.dev/';
  const LANDING_URL = 'https://mlyoo7107-ux.github.io/PICTUREBOOK-MAKER/landing.html';
  function isPaid() { try { return localStorage.getItem('cmPbmPaid') === '1'; } catch (e) { return false; } }
  function hasUsedFreeProject() { try { return localStorage.getItem('cmPbmFreeUsed') === '1'; } catch (e) { return false; } }
  function markFreeProjectUsed() { if (isPaid()) return; try { localStorage.setItem('cmPbmFreeUsed', '1'); } catch (e) {} }
  // 다른 기기(폰 등)에서 쓰기 위한 개인 링크: ?order=<주문번호> — 결제 성공 화면에서 자동으로 만들어줘요.
  (function applyOrderUnlockParam() {
    try {
      const q = new URLSearchParams(location.search);
      const orderId = q.get('order');
      if (!orderId) return;
      fetch(PAYMENT_STATUS_API_URL + '?orderId=' + encodeURIComponent(orderId))
        .then((r) => r.json()).then((data) => {
          if (data && data.paid && data.plan === 'pbm') localStorage.setItem('cmPbmPaid', '1');
        }).catch(() => {}).finally(() => {
          const url = new URL(location.href); url.searchParams.delete('order');
          history.replaceState(null, '', url.toString());
        });
    } catch (e) {}
  })();

  // 5개 메이커 공통 순서 정의 — key는 project 객체의 필드명과 동일하게 맞춥니다.
  const STEPS = [
    { key: 'plan', label: '01 PLAN', num: '01', name: '기획', path: '01-plan' },
    { key: 'story', label: '02 STORY', num: '02', name: '스토리', path: '02-story' },
    { key: 'storyboard', label: '03 STORYBOARD', num: '03', name: '스토리보드', path: '03-storyboard' },
    { key: 'character', label: '04 CHARACTER', num: '04', name: '캐릭터', path: '04-character' },
    { key: 'scene', label: '05 SCENE', num: '05', name: '장면', path: '05-scene' },
    { key: 'cover', label: '06 COVER', num: '06', name: '표지', path: '06-cover' },
    { key: 'publish', label: '07 PUBLISH', num: '07', name: '출판정보', path: '07-publish' }
  ];

  function emptyProject() {
    return {
      projectName: DEFAULT_PROJECT_NAME,
      plan: {},
      story: {},
      storyboard: {},
      character: {},
      scenes: [],
      cover: {},
      publish: {},
      mind: {},
      cast: [],
      heroDraft: {},
      updatedAt: null
    };
  }

  // ---------- 저장소 추상화 (지금은 localStorage, 추후 Supabase 등으로 교체 가능) ----------
  const storage = {
    get() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    set(project) {
      try {
        project.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        return true;
      } catch (e) {
        return false;
      }
    },
    clear() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
  };

  function getProject() {
    const saved = storage.get();
    if (!saved) return emptyProject();
    return Object.assign(emptyProject(), saved);
  }

  function saveStep(stepKey, data) {
    const project = getProject();
    project[stepKey] = data;
    storage.set(project);
    markFreeProjectUsed();
    return project;
  }

  // manual === true: 사용자가 프로젝트명을 직접 고쳤다는 뜻 (이후 책 제목이 바뀌어도 프로젝트명은 그대로 둡니다)
  function saveProjectName(name, manual) {
    const project = getProject();
    project.projectName = (name || '').trim() || DEFAULT_PROJECT_NAME;
    if (manual === true) project.projectNameManual = project.projectName !== DEFAULT_PROJECT_NAME;
    storage.set(project);
    return project;
  }
  // 표지에서 정한(또는 고치고 있는) 책 제목. 오른쪽 카드와 프로젝트명이 이 제목을 따라갑니다.
  function setBookTitle(title) {
    const project = getProject();
    const t = (title || '').trim();
    project.bookTitle = t;
    if (t && !project.projectNameManual) project.projectName = t;
    storage.set(project);
    const inp = document.getElementById('cmProjectName');
    if (inp && t && !project.projectNameManual) inp.value = t;
    return project;
  }
  // 표지 화면에서 제목 칸을 고치는 즉시 저장
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'title' && document.getElementById('coverForm')) setBookTitle(e.target.value);
  });

  // ---------- 단계별 완료 여부 (헤더 네비 · 허브 · 종합 결과 화면에서 공용) ----------
  function stepStatus(project) {
    project = project || getProject();
    return {
      plan: !!(project.plan && project.plan.hero),
      story: !!(project.story && project.story.sceneCount),
      storyboard: !!(project.storyboard && project.storyboard.scenes && project.storyboard.scenes.length),
      character: !!(project.character && project.character.name),
      scene: !!(project.scenes && project.scenes.some(function (s) { return !!s; })),
      cover: !!(project.cover && project.cover.title),
      publish: !!(project.publish && project.publish.fields && project.publish.fields.title)
    };
  }

  // 함께 나오는 캐릭터 (04에서 입력, 05·06·ChatGPT 요청문에서 사용)
  function castLines(project) {
    project = project || getProject();
    return (Array.isArray(project.cast) ? project.cast : []).filter(function (c) { return c && (c.name || c.desc); }).map(function (c) {
      return { role: c.role || '', name: (c.name || '').trim(), desc: (c.desc || '').trim() };
    });
  }
  const ROLE_EN = { '친구': 'friend', '가족': 'family member', '반려동물': 'pet', '도와주는 존재': 'helper', '라이벌': 'rival', '낯선 존재': 'mysterious stranger' };
  // 프롬프트에 붙일 "함께 나오는 캐릭터" 목록 (lang: 'kr' | 'en'), 없으면 ''
  function castBlock(lang) {
    const rows = castLines();
    if (!rows.length) return '';
    if (lang === 'en') {
      return rows.map(function (r) {
        const role = ROLE_EN[r.role] || '';
        const desc = r.desc ? (typeof ColorMEN !== 'undefined' ? ColorMEN.translate(r.desc) : r.desc) : '';
        return '- ' + (r.name || role || 'character') + (role && r.name ? ' (' + role + ')' : '') + (desc ? ': ' + desc : '');
      }).join('\n');
    }
    return rows.map(function (r) { return '- ' + (r.name || r.role) + (r.role && r.name ? ' (' + r.role + ')' : '') + (r.desc ? ': ' + r.desc : ''); }).join('\n');
  }
  // 주인공 설명 문장에서 이름처럼 쓸 말을 뽑습니다. "…한 여성" 같은 일반 명사만 남으면 "주인공"으로 둡니다.
  const GENERIC_HERO = ['사람', '여성', '남성', '아이', '소녀', '소년', '어린이', '주인공'];
  function heroName(plan) {
    const h = String((plan && plan.hero) || '').trim();
    if (!h) return '주인공';
    const w = h.split(/\s+/).pop();
    return GENERIC_HERO.indexOf(w) >= 0 ? '주인공' : w;
  }
  // 스토리보드의 장면별 "이름: 표정·행동" 줄에서 주인공(가장 자주 나오는 인물)과 다른 인물을 뽑습니다.
  function guessCastRole(name) {
    if (/엄마|아빠|할머니|할아버지|언니|오빠|누나|형|동생|삼촌|이모|고모|가족|아들|딸/.test(name)) return '가족';
    if (/강아지|고양이|토끼|새|거북|반려|멍멍|야옹/.test(name)) return '반려동물';
    if (/선생|요정|도우미|안내/.test(name)) return '도와주는 존재';
    return '친구';
  }
  function deriveCharacters(scenes, preferredMain) {
    // "어린 하나"처럼 수식어가 붙은 이름은 마지막 단어(하나)로 묶어서 센다.
    const baseOf = function (n) { return n.split(/\s+/).pop(); };
    const count = {}, order = [];
    (scenes || []).forEach(function (s) {
      const seen = {};
      String((s && s.cast) || '').split('\n').forEach(function (l) {
        const n = l.split(/[:：]/)[0].trim();
        if (!n || n.length > 10 || n.indexOf('주인공') >= 0) return;
        const b = baseOf(n);
        if (seen[b]) return;
        seen[b] = true;
        if (!(b in count)) { count[b] = 0; order.push(b); }
        count[b]++;
      });
    });
    let main = preferredMain ? baseOf(preferredMain) : '';
    if (!main) {
      // 가장 많은 장면에 나온 인물, 동점이면 먼저 나온 인물(보통 주인공)
      main = order.slice().sort(function (a, b) { return count[b] - count[a] || order.indexOf(a) - order.indexOf(b); })[0] || '';
    }
    const extras = order.filter(function (b) { return b !== main; }).slice(0, 4)
      .map(function (b) { return { role: guessCastRole(b), name: b, desc: '' }; });
    return { main: main, extras: extras };
  }
  // ---------- 한국어 조사 자동 선택 (받침 유무 판별) ----------
  function josa(word, pair) {
    const w = String(word == null ? '' : word).trim();
    const last = w[w.length - 1];
    const code = last ? last.charCodeAt(0) : 0;
    if (code < 0xAC00 || code > 0xD7A3) return pair[0];
    const hasBatchim = (code - 0xAC00) % 28 !== 0;
    return hasBatchim ? pair[0] : pair[1];
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- 프로젝트 파일 저장 / 불러오기 / 새 프로젝트 ----------
  function clearAll() {
    storage.clear();
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('colorm_draft_') === 0 || k.indexOf('colorm_bridge_') === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  function exportProject() {
    const project = getProject();
    const drafts = {};
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('colorm_draft_') === 0) drafts[k] = localStorage.getItem(k); }); } catch (e) {}
    project._drafts = drafts;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ('COLOR.M_' + project.projectName + '.json').replace(/[\\/:*?"<>|]/g, '_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('작업파일(.json)로 저장했어요.');
  }

  function importProject(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
        clearAll();
        const drafts = data._drafts || {};
        delete data._drafts;
        try { Object.keys(drafts).forEach(function (k) { if (k.indexOf('colorm_draft_') === 0) localStorage.setItem(k, drafts[k]); }); } catch (e) {}
        storage.set(Object.assign(emptyProject(), data));
        location.reload();
      } catch (e) {
        alert('작업파일(.json)을 읽을 수 없어요. 마음색 그림책 메이커에서 저장한 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
  }

  function newProject() {
    if (hasUsedFreeProject() && !isPaid()) {
      alert('무료 체험(프로젝트 1개)을 이미 사용하셨어요. 새 프로젝트를 시작하려면 구매가 필요해요 — 1회 결제로 프로젝트 제한 없이 평생 이용할 수 있어요.');
      location.href = LANDING_URL;
      return;
    }
    if (!confirm('현재 작업 중인 프로젝트가 모두 삭제됩니다. 먼저 「저장」으로 작업파일을 받아두면 나중에 불러올 수 있어요.\n새 프로젝트를 시작할까요?')) return;
    clearAll();
    location.reload();
  }

  // ---------- 공통 헤더 (상단 고정 바 + 6단계 탭 + 프로젝트명) ----------
  function renderHeader(containerId, activeKey, opts) {
    opts = opts || {};
    const root = document.getElementById(containerId);
    if (!root) return;
    const base = opts.base != null ? opts.base : '../';
    const logoSrc = opts.logoSrc || (base + 'shared/assets/logo.png');
    const project = getProject();
    const status = stepStatus(project);

    const tabsHTML = STEPS.map(function (s) {
      const isOn = s.key === activeKey;
      const done = status[s.key];
      const cls = 'step-tab' + (isOn ? ' on' : '') + (done ? ' done' : '');
      const check = done ? ' <i class="tab-check">✓</i>' : '';
      return '<a class="' + cls + '"' + (isOn ? ' aria-current="page"' : '') + ' href="' + base + s.path + '/index.html">' +
        '<b>' + s.num + '</b><span>' + s.name + check + '</span></a>';
    }).join('');

    root.innerHTML =
      '<div class="top-bar" id="cmTopBar">' +
        '<a class="top-bar-brand" href="' + base + 'index.html">' +
          '<img class="top-logo" src="' + logoSrc + '" alt="COLOR.M">' +
          '<span class="app-name">마음색 그림책 메이커</span>' +
        '</a>' +
        '<div class="top-bar-links">' +
          '<a href="' + GALLERY_URL + '" target="_blank" rel="noopener">작품 갤러리</a>' +
          (opts.home === false ? '' : '<a href="' + base + 'index.html">홈</a>') +
          '<a href="' + base + 'summary/index.html">전체 결과</a>' +
          '<button type="button" id="cmLoadBtn">불러오기</button>' +
          '<button type="button" id="cmSaveBtn">저장</button>' +
          '<button type="button" id="cmNewBtn">새 프로젝트</button>' +
          '<input type="file" id="cmLoadFile" accept=".json,application/json" hidden>' +
          '<a class="home-badge" href="https://colorm.net" target="_blank" rel="noopener" aria-label="홈페이지"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/></svg></a>' +
        '</div>' +
      '</div>' +
      (opts.tabs === false ? '' : '<nav class="step-tabs" id="cmStepTabs">' + tabsHTML + '</nav>') +
      (!opts.projectBar ? '' :
        '<div class="projectbar">' +
          '<label>프로젝트명' +
            '<input id="cmProjectName" type="text" value="' + escapeHTML(project.projectName) + '" placeholder="' + DEFAULT_PROJECT_NAME + '">' +
          '</label>' +
        '</div>');

    const nameInput = document.getElementById('cmProjectName');
    if (nameInput) {
      nameInput.addEventListener('change', function () {
        saveProjectName(nameInput.value);
      });
    }

    const fileInput = document.getElementById('cmLoadFile');
    document.getElementById('cmLoadBtn').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { importProject(fileInput.files[0]); });
    document.getElementById('cmSaveBtn').addEventListener('click', exportProject);
    document.getElementById('cmNewBtn').addEventListener('click', newProject);

    if (opts.side !== false && STEPS.some(function (x) { return x.key === activeKey; })) renderSideCard(activeKey, base);

    const topBar = document.getElementById('cmTopBar');
    function syncTopBarHeight() {
      document.documentElement.style.setProperty('--topbar-h', topBar.offsetHeight + 'px');
    }
    syncTopBarHeight();
    window.addEventListener('resize', syncTopBarHeight);
    mountToTop();
    mountFooter(base, logoSrc);
  }

  // 모든 페이지 맨 아래: 로고 · 이용약관 · 개인정보처리방침 · 환불규정 · 사업자정보
  function mountFooter(base, logoSrc) {
    const f = document.querySelector('body > footer');
    if (!f || f.dataset.cmFooter) return;
    f.dataset.cmFooter = '1';
    f.className = 'site-footer';
    f.innerHTML =
      '<img src="' + logoSrc + '" alt="COLOR.M">' +
      '<p class="legal-links"><a href="' + base + 'terms.html">이용약관</a> · <a href="' + base + 'privacy.html">개인정보처리방침</a> · <a href="' + base + 'terms.html#refund">환불규정</a></p>' +
      '<details class="biz-info"><summary>사업자정보</summary>' +
        '<p>상호명: 컬러엠 | 대표자: 유미란<br>사업자등록번호: 126-30-29572 | 통신판매업신고번호: 제2022-경기하남-2183호<br>주소: 경기도 하남시 미사강변동로72, 904호<br>전화: 0507-1312-4595 | 이메일: mlyoo71@naver.com</p></details>' +
      '<p>© 2026 COLOR.M · <a href="https://colorm.net" target="_blank" rel="noopener">colorm.net</a></p>';
  }

  // 긴 페이지에서 한 번에 맨 위로 올라가는 떠 있는 버튼 (조금 내려가면 나타나요)
  function mountToTop() {
    if (document.getElementById('cmToTop')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'cmToTop';
    b.className = 'to-top';
    b.setAttribute('aria-label', '맨 위로');
    b.innerHTML = '<span aria-hidden="true">↑</span><b>맨 위로</b>';
    b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(b);
    let ticking = false;
    function sync() { b.classList.toggle('show', window.scrollY > 500); ticking = false; }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }, { passive: true });
    sync();
  }

  // ---------- 오른쪽 "내 그림책 카드" (넓은 화면에서만 보임) ----------
  function renderSideCard(activeKey, base) {
    const main = document.querySelector('main.wrap');
    if (!main || document.getElementById('cmSideCard')) return;
    const content = document.createElement('div');
    content.className = 'wrap-main';
    while (main.firstChild) content.appendChild(main.firstChild);
    main.appendChild(content);
    main.classList.add('with-side');
    document.body.classList.add('has-side');
    const aside = document.createElement('aside');
    aside.className = 'side-card';
    aside.id = 'cmSideCard';
    main.appendChild(aside);

    function draw() {
      if (aside.contains(document.activeElement)) return;
      const p = getProject(), st = stepStatus(p);
      const m = Object.assign({ color: '', colorName: '', colorLabel: '', emotions: [], emotionCustom: '', flowPreset: '' }, p.mind || {});
      const coverTitle = (p.cover && p.cover.title && p.cover.title !== '제목 미정') ? p.cover.title : '';
      const title = (p.bookTitle || coverTitle || (p.story && p.story.titles && p.story.titles[0]) || '').trim();
      const n = (p.story && p.story.sceneCount) || (p.storyboard && p.storyboard.scenes && p.storyboard.scenes.length) || 0;
      const castN = 1 + castLines(p).length;
      const art = ((p.character && p.character.artStyle) || '').replace(/\s*스타일$/, '');
      const meta = [n ? n + '장면' : '장면 수 미정', '캐릭터 ' + castN + '명', art ? (art.length > 14 ? art.slice(0, 14) + '…' : art) : '화풍 미정'].join(' · ');
      const emotions = m.emotions.concat([m.emotionCustom.trim()]).filter(Boolean).slice(0, 4);
      let flow = null;
      if (m.color && m.flowPreset && typeof ColorMMind !== 'undefined' && ColorMMind.flowColors) flow = ColorMMind.flowColors();
      const pal = (typeof ColorMMind !== 'undefined' && ColorMMind.paletteColors) ? ColorMMind.paletteColors() : null;
      const bars = [0, 1, 2, 3, 4].map(function (i) {
        return '<i style="background:' + (flow ? flow[i] : (m.color || '#E9E2DE')) + ';opacity:' + (flow || !m.color ? 1 : 0.35) + '"></i>';
      }).join('');
      const steps = STEPS.map(function (s) {
        const on = s.key === activeKey;
        return '<li class="' + (st[s.key] ? 'done' : '') + (on ? ' on' : '') + '"><a href="' + base + s.path + '/index.html">' + (st[s.key] ? '✓ ' : '· ') + s.name + '</a></li>';
      }).join('');
      aside.innerHTML =
        '<p class="side-eyebrow">내 그림책 카드</p>' +
        '<div class="side-color"><i style="background:' + (m.color || '#F1ECE9') + '"></i><div><b>' + escapeHTML(m.colorLabel || m.colorName || '마음색을 골라보세요') + '</b><input class="side-name" type="text" value="' + escapeHTML(p.projectName || '') + '" aria-label="프로젝트명" placeholder="프로젝트명"></div></div>' +
        '<div class="side-title"><b>' + escapeHTML(title || '제목 미정') + '</b><small>' + escapeHTML(meta) + '</small></div>' +
        (emotions.length ? '<div class="side-tags">' + emotions.map(function (e) { return '<span>' + escapeHTML(e) + '</span>'; }).join('') + '</div>' : '') +
        (pal ? '<p class="side-label">책 전체 대표 색 · 메인 / 서브 / 포인트</p><div class="pal-bar" style="margin-bottom:10px">' + pal.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</div>' : '') +
        '<p class="side-label">장면 색 흐름 · ' + escapeHTML(m.flowPreset || 'AI에게 맡기기') + '</p>' +
        '<div class="side-flow">' + bars + '</div>' +
        '<ul class="side-steps">' + steps + '</ul>';
    }
    draw();
    aside.addEventListener('change', function (e) {
      if (e.target.classList.contains('side-name')) {
        saveProjectName(e.target.value, true);
        e.target.value = getProject().projectName;
      }
    });
    let t = null;
    const later = function () { clearTimeout(t); t = setTimeout(draw, 350); };
    document.addEventListener('input', later);
    document.addEventListener('change', later);
    document.addEventListener('click', later);
    window.addEventListener('storage', later);
  }
  // ---------- 작성 중인 입력 자동 저장 / 복원 ----------
  // 단계를 옮겼다가 돌아와도 입력했던 내용이 그대로 보이게 합니다. (localStorage: colorm_draft_<key>)
  function autoSaveForm(formId, draftKey, opts) {
    const form = document.getElementById(formId);
    if (!form) return null;
    opts = opts || {};
    const storageKey = 'colorm_draft_' + draftKey;
    const SKIP = '.cm-quick,.cm-drop,.cm-other,.bridge-paste,[type=button],[type=submit],[type=file]';

    // id가 없는 필드는 장면 카드 번호 + class(03), 또는 체크박스 값(04)으로 구분합니다.
    function keyOf(el) {
      if (el.id) return el.id;
      const card = el.closest('[data-idx]');
      const cls = (el.className || '').trim().split(/\s+/)[0];
      if (card && card.dataset.idx != null && cls) return '__card' + card.dataset.idx + '_' + cls;
      if (el.type === 'checkbox' && el.value) return '__cb_' + el.value;
      return null;
    }
    function findByKey(key) {
      const byId = document.getElementById(key);
      if (byId) return byId;
      const m = /^__card(\d+)_(.+)$/.exec(key);
      if (m) {
        const card = form.querySelector('[data-idx="' + m[1] + '"]');
        return card ? card.querySelector('.' + m[2]) : null;
      }
      const m2 = /^__cb_(.+)$/.exec(key);
      if (m2) return form.querySelector('input[type="checkbox"][value="' + CSS.escape(m2[1]) + '"]');
      return null;
    }
    function fields() {
      return [].slice.call(form.querySelectorAll('input, textarea, select')).filter(function (el) {
        return keyOf(el) && !el.matches(SKIP);
      });
    }
    function collect() {
      const data = {};
      fields().forEach(function (el) { data[keyOf(el)] = (el.type === 'checkbox') ? el.checked : el.value; });
      return data;
    }
    function save() {
      try {
        const payload = { data: collect(), savedAt: Date.now() };
        if (opts.extra) payload.extra = opts.extra.collect();
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (e) {}
    }
    function restore() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (!saved || !saved.data) return false;
        if (opts.extra && saved.extra !== undefined) opts.extra.apply(saved.extra);
        let applied = false;
        Object.keys(saved.data).forEach(function (key) {
          const el = findByKey(key);
          if (!el || el.matches(SKIP)) return;
          if (el.type === 'checkbox') el.checked = !!saved.data[key];
          else el.value = saved.data[key];
          el.dispatchEvent(new Event('change', { bubbles: true }));
          applied = true;
        });
        return applied;
      } catch (e) { return false; }
    }
    function clear() { try { localStorage.removeItem(storageKey); } catch (e) {} }

    let timer = null, dirty = false;
    function schedule() { dirty = true; clearTimeout(timer); timer = setTimeout(function () { dirty = false; save(); }, 500); }
    function flush() { if (dirty) { clearTimeout(timer); dirty = false; save(); } }
    form.addEventListener('input', schedule);
    form.addEventListener('change', schedule);
    form.addEventListener('submit', function () { clearTimeout(timer); dirty = false; save(); }, true);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });

    const restored = restore();
    return { save: save, restore: restore, clear: clear, restored: restored };
  }

  // 이미 만든 결과를 되살릴 때 자동으로 화면이 아래로 스크롤되지 않게 합니다.
  function restoreSilently(fn) {
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () {};
    try { fn(); } finally { setTimeout(function () { Element.prototype.scrollIntoView = orig; }, 700); }
  }
  // ---------- 이전 / 다음 단계 버튼 ----------
  function renderStepNav(containerId, activeKey) {
    const root = document.getElementById(containerId);
    if (!root) return;
    const idx = STEPS.findIndex(function (s) { return s.key === activeKey; });
    const prev = STEPS[idx - 1];
    const next = STEPS[idx + 1];
    root.innerHTML =
      (prev ? '<a class="btn ghost" href="../' + prev.path + '/index.html">← 이전 단계 (' + prev.num + ' ' + prev.name + ')</a>' : '<span></span>') +
      (next ? '<a class="btn primary" href="../' + next.path + '/index.html">다음 단계 (' + next.num + ' ' + next.name + ') →</a>' : '<span></span>');
  }

  // ---------- 토스트 ----------
  function toast(msg) {
    let t = document.getElementById('cmToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'cmToast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg || '복사되었습니다.';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 1400);
  }

  // ---------- 텍스트 복사 (직접 문자열을 넘길 때) ----------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(); });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast();
    }
  }

  // ---------- 결과 복사 (읽기 전용 div의 textContent, 또는 수정 가능한 input/textarea의 value) ----------
  function copyBox(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = ('value' in el) ? el.value : el.textContent;
    copyText(text);
  }

  // ---------- PDF 저장 (id="results" 영역만 인쇄) ----------
  function saveAsPDF(resultsId, titlePrefix) {
    const results = document.getElementById(resultsId || 'results');
    if (!results || results.classList.contains('hidden')) {
      alert('먼저 결과를 만들어주세요.');
      return;
    }
    const oldTitle = document.title;
    const project = getProject();
    document.title = 'COLOR.M_' + (titlePrefix || '') + '_' + project.projectName;

    // 인쇄 시 textarea(수정 가능한 결과창)가 잘리지 않도록 내용 높이만큼 임시로 늘려줍니다.
    const areas = results.querySelectorAll('textarea');
    const prevHeights = [];
    areas.forEach(function (ta) { prevHeights.push(ta.style.height); ta.style.height = ta.scrollHeight + 'px'; });

    window.print();

    areas.forEach(function (ta, i) { ta.style.height = prevHeights[i]; });
    setTimeout(function () { document.title = oldTitle; }, 800);
  }

  // ---------- TXT 다운로드 ----------
  function downloadTXT(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- 드롭다운 선택 + 「기타 (직접 입력)」 ----------
  // 기존 input/textarea/select 요소의 id와 .value 동작을 그대로 유지하므로
  // 각 메이커의 읽기/쓰기 코드는 수정할 필요가 없습니다.
  const OTHER_VALUE = '__other__';

  function fireInputEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  let dropSyncWired = false;
  function watchFormReset(el, syncFn) {
    if (!dropSyncWired) {
      dropSyncWired = true;
      const fire = function () { document.dispatchEvent(new CustomEvent('cm-drop-sync')); };
      window.addEventListener('load', fire);
      window.addEventListener('pageshow', fire);
    }
    if (el.form && !el.form.dataset.cmDropReset) {
      el.form.dataset.cmDropReset = '1';
      el.form.addEventListener('reset', function () {
        setTimeout(function () { document.dispatchEvent(new CustomEvent('cm-drop-sync')); }, 0);
      });
    }
    document.addEventListener('cm-drop-sync', syncFn);
  }

  // 글자 입력칸(input/textarea) 위에 선택 목록을 붙입니다. presets 항목은 '한국어' 또는 '한국어|English'.
  function dropOther(id, presets, opts) {
    const el = document.getElementById(id);
    if (!el || el.dataset.cmDrop) return;
    opts = opts || {};
    el.dataset.cmDrop = '1';
    const items = presets.map(function (p) {
      const i = p.indexOf('|');
      return i < 0 ? { kr: p, en: null } : { kr: p.slice(0, i).trim(), en: p.slice(i + 1).trim() };
    });
    if (typeof ColorMEN !== 'undefined' && ColorMEN.addPairs) {
      ColorMEN.addPairs(items.filter(function (it) { return it.en; }).map(function (it) { return [it.kr, it.en]; }));
    }
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    const sel = document.createElement('select');
    sel.className = 'cm-drop';
    sel.innerHTML = '<option value="">' + (opts.placeholder || '목록에서 선택하세요') + '</option>' +
      items.map(function (it) { return '<option>' + escapeHTML(it.kr) + '</option>'; }).join('') +
      '<option value="' + OTHER_VALUE + '">✏️ 기타 (직접 입력)</option>';
    el.parentNode.insertBefore(sel, el);

    let otherMode = false;
    function sync() {
      const v = desc.get.call(el);
      if (v === '') {
        sel.value = otherMode ? OTHER_VALUE : '';
      } else if (!otherMode && items.some(function (it) { return it.kr === v; })) {
        sel.value = v;
      } else {
        otherMode = true;
        sel.value = OTHER_VALUE;
      }
      el.hidden = sel.value !== OTHER_VALUE;
    }
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () { return desc.get.call(el); },
      set: function (v) { desc.set.call(el, v == null ? '' : v); otherMode = false; sync(); }
    });
    sel.addEventListener('change', function () {
      if (sel.value === OTHER_VALUE) {
        otherMode = true;
        if (items.some(function (it) { return it.kr === desc.get.call(el); })) desc.set.call(el, '');
        el.hidden = false;
        el.focus();
      } else {
        otherMode = false;
        desc.set.call(el, sel.value);
        el.hidden = true;
      }
      fireInputEvents(el);
    });
    watchFormReset(el, function () { otherMode = false; sync(); });
    sync();
  }

  // 이미 선택 목록인 select에 「기타 (직접 입력)」 항목과 입력칸을 붙입니다.
  function selectOther(id, opts) {
    const sel = document.getElementById(id);
    if (!sel || sel.dataset.cmDrop) return;
    opts = opts || {};
    sel.dataset.cmDrop = '1';
    if (opts.replace) {
      [].slice.call(sel.options).forEach(function (o) { if (o.text === opts.replace) o.remove(); });
    }
    const otherOpt = document.createElement('option');
    otherOpt.value = OTHER_VALUE;
    otherOpt.textContent = '✏️ 기타 (직접 입력)';
    sel.appendChild(otherOpt);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cm-other';
    input.placeholder = opts.placeholder || '직접 입력해주세요';
    input.hidden = true;
    sel.parentNode.insertBefore(input, sel.nextSibling);
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

    function isOther() { return sel.selectedIndex >= 0 && sel.options[sel.selectedIndex].value === OTHER_VALUE; }
    function sync() { input.hidden = !isOther(); }
    Object.defineProperty(sel, 'value', {
      configurable: true,
      get: function () { return isOther() ? input.value.trim() : desc.get.call(sel); },
      set: function (v) {
        v = v == null ? '' : String(v);
        desc.set.call(sel, v);
        const matched = sel.selectedIndex >= 0 && desc.get.call(sel) === v;
        if (!matched) {
          if (v === '') {
            sel.selectedIndex = 0;
          } else {
            otherOpt.selected = true;
            input.value = v;
          }
        }
        sync();
      }
    });
    sel.addEventListener('change', function () {
      sync();
      if (isOther()) input.focus();
    });
    watchFormReset(sel, sync);
    sync();
  }

  // spec: { id: [프리셋...] } → 입력칸, { id: true | {replace:'기타'} } → 기존 선택 목록
  function applyDrops(spec) {
    Object.keys(spec || {}).forEach(function (id) {
      const s = spec[id];
      if (Array.isArray(s)) dropOther(id, s);
      else selectOther(id, s === true ? {} : s);
    });
  }

  return {
    dropOther: dropOther,
    selectOther: selectOther,
    applyDrops: applyDrops,
    STEPS: STEPS,
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_PROJECT_NAME: DEFAULT_PROJECT_NAME,
    emptyProject: emptyProject,
    getProject: getProject,
    saveStep: saveStep,
    saveProjectName: saveProjectName,
    setBookTitle: setBookTitle,
    clearAll: clearAll,
    exportProject: exportProject,
    importProject: importProject,
    newProject: newProject,
    storage: storage,
    josa: josa,
    stepStatus: stepStatus,
    heroName: heroName,
    autoSaveForm: autoSaveForm,
    restoreSilently: restoreSilently,
    deriveCharacters: deriveCharacters,
    guessCastRole: guessCastRole,
    castLines: castLines,
    castBlock: castBlock,
    renderHeader: renderHeader,
    renderStepNav: renderStepNav,
    toast: toast,
    copyText: copyText,
    copyBox: copyBox,
    saveAsPDF: saveAsPDF,
    downloadTXT: downloadTXT,
    escapeHTML: escapeHTML,
    isPaid: isPaid,
    hasUsedFreeProject: hasUsedFreeProject
  };
})();
