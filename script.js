(function () {
  'use strict';

  /* ==========================================================================
     CONFIG — the only bit you should need to touch day-to-day
     ========================================================================== */
  var CONFIG = {
    // Paste your deployed Apps Script Web App /exec URL here.
    webAppUrl: 'https://script.google.com/macros/s/AKfycbzGUqWrtCCNS--0J-V_eLIfdhUIdM68zPMKW0RhxiuEUnFgH8cs70ICzZqOZGxqw_6L/exec',
    // Which tab this guide reads from (see apps-script.gs).
    sheetParam: 'bankRecon',
    requestTimeoutMs: 12000
  };

  // Card fields, in display order, each with its label and CSS accent class.
  var FIELDS = [
    { key: 'who', label: 'Who' },
    { key: 'what', label: 'What' },
    { key: 'where', label: 'Where' },
    { key: 'when', label: 'When' },
    { key: 'why', label: 'Why' },
    { key: 'how', label: 'How' }
  ];

  var COVER_TITLE = 'Practising Bank Reconciliation';
  var COVER_SUBTITLE = 'in Your Demo Account';
  var COVER_INTRO = 'This guide walks you through safely practising bank imports and reconciliation using your Street demo account, so you can build confidence before working with live client data.';

  var CLOSING_TITLE = 'Ready to have a go';
  var CLOSING_BODY = 'Use your demo account to practise these steps as many times as you like \u2014 nothing here affects live data.';
  var CLOSING_NOTE = 'Please only practise bank reconciliation in your demo account. If you\u2019re ever unsure, contact your Street Accounting Onboarding team.';

  /* ==========================================================================
     DOM REFERENCES
     ========================================================================== */
  var el = {};

  function cacheDom() {
    el.viewport = document.getElementById('page-viewport');
    el.pagesRoot = document.getElementById('pages-root');
    el.loading = document.getElementById('state-loading');
    el.error = document.getElementById('state-error');
    el.errorDetail = document.getElementById('state-error-detail');
    el.retryBtn = document.getElementById('retry-button');
    el.nav = document.getElementById('fb-nav');
    el.navPrev = document.getElementById('nav-prev');
    el.navNext = document.getElementById('nav-next');
    el.navLabel = document.getElementById('nav-page-label');
    el.navBar = document.getElementById('nav-progress-bar');
    el.srAnnounce = document.getElementById('sr-page-announce');
  }

  /* ==========================================================================
     STATE
     ========================================================================== */
  var state = {
    rawRecords: [],
    pageModels: [], // ordered list of everything to render: cover, section pages, closing
    pageEls: [],    // rendered DOM nodes, parallel to pageModels
    currentIndex: 0
  };

  /* ==========================================================================
     TEXT HELPERS
     ========================================================================== */

  // Splits raw cell text into paragraphs, preserving blank-line breaks from the sheet.
  function splitParagraphs(text) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .split(/\n{1,}/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
  }

  // Recognises simple numbered-step patterns ("1.", "1)", "Step 1:") across several lines.
  var STEP_PATTERN = /^\s*(?:step\s*)?\d+[\.\)\:]\s*/i;

  function looksLikeNumberedSteps(paragraphs) {
    if (paragraphs.length < 2) return false;
    var matches = 0;
    paragraphs.forEach(function (p) { if (STEP_PATTERN.test(p)) matches++; });
    return matches >= Math.ceil(paragraphs.length * 0.6);
  }

  function stripStepMarker(text) {
    return text.replace(STEP_PATTERN, '').trim();
  }

  /* ==========================================================================
     DOM BUILDERS (textContent only \u2014 never innerHTML with sheet data,
     so unexpected characters can never break the page)
     ========================================================================== */

  function createCardNode(fieldKey, label, rawContent) {
    var paragraphs = splitParagraphs(rawContent);
    if (!paragraphs.length) return null; // never render an empty card

    var card = document.createElement('div');
    card.className = 'card card--' + fieldKey;

    var labelRow = document.createElement('div');
    labelRow.className = 'card__label';
    var dot = document.createElement('span');
    dot.className = 'card__label-dot';
    dot.setAttribute('aria-hidden', 'true');
    var labelText = document.createElement('span');
    labelText.textContent = label;
    labelRow.appendChild(dot);
    labelRow.appendChild(labelText);
    card.appendChild(labelRow);

    var body = document.createElement('div');
    body.className = 'card__body';

    if (fieldKey === 'how' && looksLikeNumberedSteps(paragraphs)) {
      var ol = document.createElement('ol');
      paragraphs.forEach(function (p) {
        var li = document.createElement('li');
        li.textContent = stripStepMarker(p);
        ol.appendChild(li);
      });
      body.appendChild(ol);
    } else {
      paragraphs.forEach(function (p) {
        var pEl = document.createElement('p');
        pEl.textContent = p;
        body.appendChild(pEl);
      });
    }

    card.appendChild(body);
    return card;
  }

  function createTitleNode(titleText, continued) {
    var wrap = document.createElement('div');
    wrap.className = 'section-intro-space';

    if (continued) {
      var badge = document.createElement('span');
      badge.className = 'section-continued';
      badge.textContent = 'Continued';
      wrap.appendChild(document.createElement('br'));
      wrap.insertBefore(badge, wrap.firstChild);
    }

    var h = document.createElement('h2');
    h.className = 'section-title';
    h.textContent = titleText || 'Guidance';
    wrap.appendChild(h);

    return wrap;
  }

  function createCardGrid(cardNodes, twoCol) {
    var grid = document.createElement('div');
    grid.className = 'card-grid' + (twoCol ? ' card-grid--two-col' : '');
    cardNodes.forEach(function (c) { grid.appendChild(c); });
    return grid;
  }

  /* ==========================================================================
     DATA -> SECTIONS
     ========================================================================== */

  function buildSections(records) {
    var sections = [];
    records.forEach(function (record) {
      var cardData = [];
      FIELDS.forEach(function (f) {
        var val = record[f.key];
        if (val && String(val).trim()) {
          cardData.push({ key: f.key, label: f.label, text: val });
        }
      });
      var title = (record.guidance || '').toString().trim();
      if (!title && !cardData.length) return; // fully blank, ignore
      sections.push({ title: title || 'Guidance', cards: cardData });
    });
    return sections;
  }

  /* ==========================================================================
     MEASUREMENT RIG
     A hidden .page (same class as every real page, so identical box model,
     padding, fonts and flex behaviour) used purely to test whether a
     candidate arrangement of nodes fits before it is committed to a page.
     ========================================================================== */

  var rig = null;

  function ensureRig() {
    if (rig) return rig;
    var page = document.createElement('div');
    page.className = 'page';
    page.style.zIndex = '-1';
    var inner = document.createElement('div');
    inner.className = 'page-inner';
    page.appendChild(inner);
    el.pagesRoot.appendChild(page);
    rig = { page: page, inner: inner };
    return rig;
  }

  // Returns true if the given content (already-built DOM nodes) fits within
  // one page's real, currently-rendered available height.
  function contentFits(nodes, compact) {
    var r = ensureRig();
    r.inner.className = 'page-inner' + (compact ? ' page-inner--compact' : '');
    r.inner.innerHTML = '';
    nodes.forEach(function (n) { r.inner.appendChild(n); });
    // Force layout before reading measurements.
    // eslint-disable-next-line no-unused-expressions
    r.inner.offsetHeight;
    return r.inner.scrollHeight <= r.inner.clientHeight + 1;
  }

  /* ==========================================================================
     PAGINATION
     Greedily fills each page with as many whole cards as will fit, testing a
     two-column layout (denser, better balance for shorter content) and a
     one-column layout (better for longer content), and only spills onto a
     continuation page ("Continued") when content genuinely doesn't fit.
     ========================================================================== */

  function buildCandidateNodes(title, continued, cardDataSlice, twoCol) {
    var nodes = [createTitleNode(title, continued)];
    var cardNodes = cardDataSlice
      .map(function (c) { return createCardNode(c.key, c.label, c.text); })
      .filter(Boolean);
    nodes.push(createCardGrid(cardNodes, twoCol));
    return nodes;
  }

  function paginateSection(section) {
    var pages = [];
    var remaining = section.cards.slice();

    while (remaining.length) {
      var continued = pages.length > 0;
      var bestN = 0;
      var bestLayout = 'one-col';
      var bestCompact = false;

      // Try to fit as many cards as possible, from all-remaining down to 1.
      outer:
      for (var n = remaining.length; n >= 1; n--) {
        var slice = remaining.slice(0, n);
        var fitsOneCol = contentFits(buildCandidateNodes(section.title, continued, slice, false), false);
        var fitsTwoCol = n >= 2 && contentFits(buildCandidateNodes(section.title, continued, slice, true), false);

        if (fitsOneCol || fitsTwoCol) {
          bestN = n;
          // Prefer the two-column layout when it fits 2+ cards \u2014 it reads
          // more balanced and avoids a lone card stranded on an empty page.
          bestLayout = fitsTwoCol ? 'two-col' : 'one-col';
          bestCompact = false;
          break outer;
        }
      }

      if (bestN === 0) {
        // Even a single card doesn't fit at normal size (an unusually long
        // guidance entry). Fall back to a slightly more compact type scale
        // before accepting it as-is, rather than ever adding a scrollbar.
        var singleSlice = remaining.slice(0, 1);
        var compactFits = contentFits(buildCandidateNodes(section.title, continued, singleSlice, false), true);
        bestN = 1;
        bestLayout = 'one-col';
        bestCompact = true;
        if (!compactFits) {
          console.warn('Bank Recon guide: a single card could not be made to fit even in compact mode \u2014 rendering it anyway to avoid data loss.', section.title);
        }
      }

      var committed = remaining.slice(0, bestN);
      remaining = remaining.slice(bestN);

      pages.push({
        type: 'section',
        title: section.title,
        continued: continued,
        cards: committed,
        twoCol: bestLayout === 'two-col',
        compact: bestCompact
      });
    }

    return pages;
  }

  function paginateAll(sections) {
    var models = [{ type: 'cover' }];
    sections.forEach(function (section) {
      paginateSection(section).forEach(function (p) { models.push(p); });
    });
    models.push({ type: 'closing' });
    return models;
  }

  /* ==========================================================================
     PAGE RENDERING
     ========================================================================== */

  function renderCoverPage() {
    var inner = document.createElement('div');
    inner.className = 'page-inner';

    var page = document.createElement('div');
    page.className = 'cover-page';

    var swatch = document.createElement('div');
    swatch.className = 'cover-page__swatch';
    page.appendChild(swatch);

    var eyebrow = document.createElement('span');
    eyebrow.className = 'cover-page__eyebrow';
    eyebrow.textContent = 'Accounting onboarding guide';
    page.appendChild(eyebrow);

    var h1 = document.createElement('h1');
    h1.className = 'cover-page__title';
    h1.textContent = COVER_TITLE + ' ' + COVER_SUBTITLE;
    page.appendChild(h1);

    var intro = document.createElement('p');
    intro.className = 'cover-page__intro';
    intro.textContent = COVER_INTRO;
    page.appendChild(intro);

    var pillRow = document.createElement('div');
    pillRow.className = 'cover-page__pill-row';
    ['Demo account only', 'Safe to repeat', 'Step-by-step'].forEach(function (t) {
      var pill = document.createElement('span');
      pill.className = 'cover-page__pill';
      pill.textContent = t;
      pillRow.appendChild(pill);
    });
    page.appendChild(pillRow);

    inner.appendChild(page);
    return wrapPage(inner);
  }

  function renderClosingPage() {
    var inner = document.createElement('div');
    inner.className = 'page-inner';

    var page = document.createElement('div');
    page.className = 'closing-page';

    var h2 = document.createElement('h2');
    h2.className = 'closing-page__title';
    h2.textContent = CLOSING_TITLE;
    page.appendChild(h2);

    var body = document.createElement('p');
    body.className = 'closing-page__body';
    body.textContent = CLOSING_BODY;
    page.appendChild(body);

    var note = document.createElement('div');
    note.className = 'closing-page__note';
    note.textContent = CLOSING_NOTE;
    page.appendChild(note);

    inner.appendChild(page);
    return wrapPage(inner);
  }

  function renderSectionPage(model) {
    var inner = document.createElement('div');
    inner.className = 'page-inner' + (model.compact ? ' page-inner--compact' : '');

    inner.appendChild(createTitleNode(model.title, model.continued));

    var cardNodes = model.cards
      .map(function (c) { return createCardNode(c.key, c.label, c.text); })
      .filter(Boolean);
    inner.appendChild(createCardGrid(cardNodes, model.twoCol));

    return wrapPage(inner);
  }

  function wrapPage(innerEl) {
    var page = document.createElement('div');
    page.className = 'page';
    page.appendChild(innerEl);
    return page;
  }

  function renderAllPages() {
    state.pageEls = state.pageModels.map(function (model) {
      if (model.type === 'cover') return renderCoverPage();
      if (model.type === 'closing') return renderClosingPage();
      return renderSectionPage(model);
    });

    // Clear out everything (including the measurement rig) and mount the
    // final pages fresh.
    el.pagesRoot.innerHTML = '';
    rig = null;
    state.pageEls.forEach(function (p) { el.pagesRoot.appendChild(p); });
  }

  /* ==========================================================================
     NAVIGATION
     ========================================================================== */

  function goToPage(index, direction) {
    var total = state.pageEls.length;
    if (index < 0 || index >= total) return;

    state.pageEls.forEach(function (p, i) {
      p.classList.remove('is-active', 'is-leaving-back');
      if (i === index) {
        p.classList.add('is-active');
      } else if (direction === 'back' && i === state.currentIndex) {
        p.classList.add('is-leaving-back');
      }
    });

    state.currentIndex = index;
    updateNavUI();
  }

  function updateNavUI() {
    var total = state.pageEls.length;
    var current = state.currentIndex + 1;
    el.navLabel.textContent = current + ' of ' + total;
    el.navBar.style.width = (current / total * 100) + '%';
    el.navPrev.disabled = state.currentIndex === 0;
    el.navNext.disabled = state.currentIndex === total - 1;
    if (el.srAnnounce) el.srAnnounce.textContent = 'Page ' + current + ' of ' + total;
  }

  function next() {
    if (state.currentIndex < state.pageEls.length - 1) goToPage(state.currentIndex + 1, 'forward');
  }

  function prev() {
    if (state.currentIndex > 0) goToPage(state.currentIndex - 1, 'back');
  }

  function bindNavEvents() {
    el.navNext.addEventListener('click', next);
    el.navPrev.addEventListener('click', prev);

    document.addEventListener('keydown', function (e) {
      if (el.nav.hidden) return;
      if (e.key === 'ArrowRight') { next(); }
      else if (e.key === 'ArrowLeft') { prev(); }
    });

    var touchStartX = null;
    el.viewport.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    el.viewport.addEventListener('touchend', function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) next(); else prev();
    }, { passive: true });
  }

  /* ==========================================================================
     RECALCULATION (resize / font changes)
     ========================================================================== */

  var recalcTimer = null;
  function scheduleRecalc() {
    clearTimeout(recalcTimer);
    recalcTimer = setTimeout(function () {
      if (!state.rawRecords.length) return;
      var sections = buildSections(state.rawRecords);
      state.pageModels = paginateAll(sections);
      renderAllPages();
      var clamped = Math.min(state.currentIndex, state.pageEls.length - 1);
      goToPage(Math.max(clamped, 0));
    }, 200);
  }

  window.addEventListener('resize', scheduleRecalc);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleRecalc)['catch'](function () {});
  }

  /* ==========================================================================
     STATE SCREENS
     ========================================================================== */

  function showLoading() {
    el.loading.hidden = false;
    el.error.hidden = true;
    el.pagesRoot.hidden = true;
    el.nav.hidden = true;
  }

  function showError(message) {
    el.loading.hidden = true;
    el.error.hidden = false;
    el.pagesRoot.hidden = true;
    el.nav.hidden = true;
    el.errorDetail.textContent = message;
  }

  function showGuide() {
    el.loading.hidden = true;
    el.error.hidden = true;
    el.pagesRoot.hidden = false;
    el.nav.hidden = false;
  }

  /* ==========================================================================
     DATA LOADING (JSONP \u2014 avoids cross-origin issues with the Apps
     Script /exec endpoint when called from a GitHub Pages origin)
     ========================================================================== */

  function loadData() {
    showLoading();

    if (!CONFIG.webAppUrl || CONFIG.webAppUrl.indexOf('PASTE_YOUR') === 0) {
      console.error('Bank Recon guide: CONFIG.webAppUrl has not been set in script.js.');
      showError('This guide isn\u2019t connected to its data source yet.');
      return;
    }

    var callbackName = 'bankReconCb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    var finished = false;
    var scriptEl = null;

    function cleanup() {
      delete window[callbackName];
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
    }

    var timeoutId = setTimeout(function () {
      if (finished) return;
      finished = true;
      cleanup();
      console.error('Bank Recon guide: request to Apps Script timed out.');
      showError('This is taking longer than expected. Please check your connection and try again.');
    }, CONFIG.requestTimeoutMs);

    window[callbackName] = function (payload) {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      cleanup();
      handlePayload(payload);
    };

    scriptEl = document.createElement('script');
    var sep = CONFIG.webAppUrl.indexOf('?') > -1 ? '&' : '?';
    scriptEl.src = CONFIG.webAppUrl + sep + 'sheet=' + encodeURIComponent(CONFIG.sheetParam) + '&callback=' + callbackName;
    scriptEl.onerror = function () {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      cleanup();
      console.error('Bank Recon guide: the Apps Script request failed to load (network or deployment issue).');
      showError('Could not reach the guide data. Please check your connection and try again.');
    };
    document.body.appendChild(scriptEl);
  }

  function handlePayload(payload) {
    if (!payload || payload.success !== true || !Array.isArray(payload.data)) {
      console.error('Bank Recon guide: Apps Script returned an unexpected or unsuccessful response.', payload);
      showError((payload && payload.error) || 'No guidance data is available right now.');
      return;
    }

    var sections = buildSections(payload.data);
    if (!sections.length) {
      console.error('Bank Recon guide: no active rows were returned.', payload);
      showError('No active guidance is available right now. Please check back later.');
      return;
    }

    state.rawRecords = payload.data;
    state.pageModels = paginateAll(sections);
    renderAllPages();
    showGuide();
    goToPage(0);
  }

  /* ==========================================================================
     INIT
     ========================================================================== */

  function init() {
    cacheDom();
    bindNavEvents();
    el.retryBtn.addEventListener('click', loadData);
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
