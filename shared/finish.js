/* ===================================================================
   COLOR.M 마음색 그림책 메이커 — 마무리 카드
   · 프로젝트 저장 · 불러오기 (PDF / TXT / 작업파일 .json / 전체 내용 복사 / 처음부터 다시)
   · 갤러리에 자랑하기 — 제목 · 한 줄 소개 · 태그를 갤러리 등록 화면에 자동으로 넘겨요.
   (캐릭터 메이커와 같은 방식)
   =================================================================== */
const ColorMFinish = (function () {
  const GALLERY_UPLOAD = 'https://mlyoo7107-ux.github.io/PRODUCT-DESIGN-MAKER/gallery/upload.html?product=PICTURE_BOOK_MAKER';
  const esc = function (s) { return ColorM.escapeHTML(s); };

  // 갤러리 분류: 마음색(16가지)을 비슷한 색끼리 8묶음으로 나눈 이름. 색을 안 골랐으면 「기타」.
  // ※ 갤러리(index.html · upload.html)의 PICTURE_BOOK_MAKER categories와 글자까지 똑같아야 자동 선택돼요.
  const COLOR_GROUPS = {
    '레드': '빨강·코랄', '코랄': '빨강·코랄',
    '오렌지': '주황·노랑', '옐로우': '주황·노랑',
    '그린': '초록·라임', '라임': '초록·라임',
    '민트': '민트·청록', '터콰이즈': '민트·청록',
    '블루': '파랑·네이비', '네이비': '파랑·네이비',
    '퍼플': '보라·라벤더', '라벤더': '보라·라벤더',
    '핑크': '분홍·마젠타', '마젠타': '분홍·마젠타',
    '브라운': '갈색·회색', '그레이': '갈색·회색'
  };
  function galleryCategory() {
    if (typeof ColorMMind === 'undefined' || !ColorMMind.hasColor()) return '기타';
    return COLOR_GROUPS[ColorMMind.get().colorName] || '기타';
  }

  // 갤러리 등록 화면에 미리 채울 값 (제목 40자 · 소개 150자 · 태그 100자 · 분류는 마음색 묶음)
  function galleryData() {
    const p = ColorM.getProject();
    const plan = p.plan || {}, story = p.story || {}, cover = p.cover || {}, pub = (p.publish && p.publish.fields) || {};
    const coverTitle = cover.title && cover.title !== '제목 미정' ? cover.title : '';
    const title = (p.bookTitle || pub.title || coverTitle || (story.titles && story.titles[0]) ||
      (p.projectName !== ColorM.DEFAULT_PROJECT_NAME ? p.projectName : '') || '').trim();
    const summary = (story.summary || '').trim().split(/(?<=[.!?])\s+/)[0] || '';
    const concept = (pub.logline || plan.oneLine || summary || [plan.hero, plan.goal].filter(Boolean).join(' — ')).trim();
    const kw = (pub.keywords || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
    // 마음색에서 고른 감정(최대 2개)을 태그 맨 앞에 넣어 같은 마음의 작품을 찾기 쉽게 해요.
    const emos = (typeof ColorMMind !== 'undefined' && ColorMMind.hasColor())
      ? ColorMMind.get().emotions.slice(0, 2) : [];
    const base = (kw.length ? kw : [plan.genre, plan.mood, plan.topic]).filter(Boolean);
    const tags = emos.concat(base.filter(function (t) { return emos.indexOf(t) < 0; }));
    return { title: title.slice(0, 40), concept: concept.slice(0, 150), tags: tags.join(', ').slice(0, 100), category: galleryCategory() };
  }
  function galleryUrl() {
    const d = galleryData();
    const q = new URLSearchParams();
    if (d.title) q.set('title', d.title);
    if (d.concept) q.set('concept', d.concept);
    q.set('category', d.category);
    if (d.tags) q.set('tags', d.tags);
    return GALLERY_UPLOAD + '&' + q.toString();
  }

  // opts: { pdf: function, txt: function, copyAll: function() → string, pdfLabel }
  function mount(anchor, opts, where) {
    if (!anchor || !anchor.parentNode) return;
    opts = opts || {};
    const sec = document.createElement('section');
    sec.className = 'card finish-card';
    sec.innerHTML =
      '<h3 class="finish-title">프로젝트 저장 · 불러오기</h3>' +
      '<p class="help">작업파일을 저장하면 다음에 다시 불러와서 이어서 수정할 수 있어요.</p>' +
      '<div class="finish-btns">' +
        '<button type="button" class="btn primary" data-act="pdf">📕 ' + esc(opts.pdfLabel || '그림책 PDF 저장') + '</button>' +
        '<button type="button" class="btn soft" data-act="txt">📝 TXT 저장</button>' +
        '<button type="button" class="btn soft" data-act="save">💾 작업파일 저장</button>' +
        '<button type="button" class="btn soft" data-act="load">📂 작업파일 불러오기</button>' +
        '<button type="button" class="btn soft" data-act="copy">📋 전체 내용 복사</button>' +
        '<button type="button" class="btn ghost finish-reset" data-act="reset">🔄 처음부터 다시 만들기</button>' +
        '<input type="file" accept=".json,application/json" hidden data-role="file">' +
      '</div>' +
      '<p class="help">※ PDF는 제출·출력용이에요. 다시 수정하려면 「작업파일(.json)」을 저장해 주세요.</p>' +
      '<p class="help">💾 입력한 내용은 서버로 보내지 않고 <b>이 브라우저에만 저장</b>돼요. 다른 기기에서 이어서 하려면 「작업파일 저장」을 쓰고, 학교·도서관 같은 공용 컴퓨터에서는 마친 뒤 「처음부터 다시 만들기」로 지워 주세요.</p>' +
      '<div class="gallery-cta">' +
        '<p><b>🖼 완성한 그림책 이미지가 있나요?</b></p>' +
        '<a class="btn primary big" data-act="gallery" target="_blank" rel="noopener">✨ 갤러리에 자랑하기 →</a>' +
        '<p class="help" data-role="ginfo"></p>' +
      '</div>';
    if (where === 'after') anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    else anchor.parentNode.insertBefore(sec, anchor);

    const q = function (r) { return sec.querySelector('[data-role="' + r + '"]'); };
    const go = sec.querySelector('[data-act="gallery"]');
    function refreshGallery() {
      const d = galleryData();
      go.href = galleryUrl();
      q('ginfo').textContent = (d.title ? '제목 「' + d.title + '」' : '제목은 등록 화면에서 입력해요') +
        ' · 분류 「' + d.category + '」 · 한 줄 소개 · 태그가 등록 화면에 자동으로 들어가요';
    }
    refreshGallery();
    // 눌러보기 전에 제목이 바뀌었을 수 있어서, 누르는 순간의 값으로 다시 만듭니다.
    go.addEventListener('click', refreshGallery);
    go.addEventListener('mouseenter', refreshGallery);
    go.addEventListener('focus', refreshGallery);

    sec.addEventListener('click', function (e) {
      const b = e.target.closest('[data-act]');
      if (!b || b.dataset.act === 'gallery') return;
      const a = b.dataset.act;
      if (a === 'pdf') { if (opts.pdf) opts.pdf(); }
      else if (a === 'txt') { if (opts.txt) opts.txt(); }
      else if (a === 'save') ColorM.exportProject();
      else if (a === 'load') q('file').click();
      else if (a === 'copy') { if (opts.copyAll) ColorM.copyText(opts.copyAll()); }
      else if (a === 'reset') ColorM.newProject();
    });
    q('file').addEventListener('change', function () { ColorM.importProject(this.files[0]); });
  }

  return { mount: mount, galleryUrl: galleryUrl, galleryData: galleryData, COLOR_GROUPS: COLOR_GROUPS };
})();
