(function () {
  'use strict';

  // ---------- Storage keys ----------
  var LS_API_KEY = 'ijazai_gemini_api_key';
  var LS_SYSTEM_PROMPT = 'ijazai_system_prompt';
  var LS_HISTORY = 'ijazai_chat_history';

  var GEMINI_MODEL = 'gemini-2.5-flash';
  var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

  // ---------- DOM refs ----------
  var chatArea = document.getElementById('chatArea');
  var emptyState = document.getElementById('emptyState');
  var messagesEl = document.getElementById('messages');
  var composerForm = document.getElementById('composerForm');
  var promptInput = document.getElementById('promptInput');
  var sendBtn = document.getElementById('sendBtn');
  var statusTag = document.getElementById('statusTag');
  var newChatBtn = document.getElementById('newChatBtn');
  var settingsBtn = document.getElementById('settingsBtn');
  var closeSettingsBtn = document.getElementById('closeSettingsBtn');
  var settingsModal = document.getElementById('settingsModal');
  var apiKeyInput = document.getElementById('apiKeyInput');
  var systemPromptInput = document.getElementById('systemPromptInput');
  var saveSettingsBtn = document.getElementById('saveSettingsBtn');
  var settingsMsg = document.getElementById('settingsMsg');
  var toastEl = document.getElementById('toast');
  var suggestionChips = document.querySelectorAll('.suggestion-chip');

  // ---------- State ----------
  var history = loadHistory(); // array of {role: 'user'|'model', text: string}
  var isSending = false;
  var toastTimer = null;

  // ---------- Init ----------
  function init() {
    renderHistory();
    updateStatusTag();

    apiKeyInput.value = getApiKey() || '';
    systemPromptInput.value = getSystemPrompt() || '';

    if (!getApiKey()) {
      openSettings();
    }

    autoResizeTextarea();
  }

  // ---------- Storage helpers ----------
  function getApiKey() {
    try { return localStorage.getItem(LS_API_KEY) || ''; } catch (e) { return ''; }
  }
  function setApiKey(val) {
    try { localStorage.setItem(LS_API_KEY, val); } catch (e) {}
  }
  function getSystemPrompt() {
    try { return localStorage.getItem(LS_SYSTEM_PROMPT) || ''; } catch (e) { return ''; }
  }
  function setSystemPrompt(val) {
    try { localStorage.setItem(LS_SYSTEM_PROMPT, val); } catch (e) {}
  }
  function loadHistory() {
    try {
      var raw = localStorage.getItem(LS_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history)); } catch (e) {}
  }

  // ---------- UI helpers ----------
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3200);
  }

  function updateStatusTag() {
    if (getApiKey()) {
      statusTag.textContent = 'Connected · Gemini';
      statusTag.classList.add('connected');
    } else {
      statusTag.textContent = 'Not connected';
      statusTag.classList.remove('connected');
    }
  }

  function openSettings() {
    settingsMsg.hidden = true;
    settingsModal.hidden = false;
  }
  function closeSettings() {
    settingsModal.hidden = true;
  }

  function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  }

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function toggleEmptyState() {
    var hasMessages = history.length > 0;
    emptyState.hidden = hasMessages;
    messagesEl.hidden = !hasMessages;
  }

  // ---------- Rendering ----------
  function renderHistory() {
    messagesEl.innerHTML = '';
    for (var i = 0; i < history.length; i++) {
      appendMessageEl(history[i].role, history[i].text, false);
    }
    toggleEmptyState();
    scrollToBottom();
  }

  function appendMessageEl(role, text, isError) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (role === 'user' ? 'user' : 'assistant') + (isError ? ' error' : '');

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? 'You' : 'Ij';

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    return bubble;
  }

  function appendTypingIndicator() {
    var wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    wrap.id = 'typingIndicator';

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = 'Ij';

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  // ---------- Gemini API call ----------
  function buildContents() {
    var contents = [];
    for (var i = 0; i < history.length; i++) {
      contents.push({
        role: history[i].role,
        parts: [{ text: history[i].text }]
      });
    }
    return contents;
  }

  function callGemini(apiKey) {
    var body = {
      contents: buildContents()
    };

    var sysPrompt = getSystemPrompt();
    if (sysPrompt && sysPrompt.trim()) {
      body.system_instruction = { parts: [{ text: sysPrompt.trim() }] };
    }

    var url = GEMINI_URL + '?key=' + encodeURIComponent(apiKey);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var errMsg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + res.status);
          throw new Error(errMsg);
        }
        return data;
      });
    });
  }

  function extractReplyText(data) {
    try {
      var candidate = data.candidates && data.candidates[0];
      if (!candidate) return null;

      if (candidate.finishReason === 'SAFETY') {
        return "Maazrat, is sawal ka jawab safety guidelines ki wajah se nahi de sakta.";
      }

      var parts = candidate.content && candidate.content.parts;
      if (!parts || !parts.length) return null;

      var textParts = [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].text) textParts.push(parts[i].text);
      }
      return textParts.join('').trim() || null;
    } catch (e) {
      return null;
    }
  }

  // ---------- Send flow ----------
  function sendMessage(text) {
    var apiKey = getApiKey();
    if (!apiKey) {
      showToast('Pehle Settings mein apni free Gemini API key daalein.');
      openSettings();
      return;
    }
    if (isSending) return;

    text = text.trim();
    if (!text) return;

    history.push({ role: 'user', text: text });
    saveHistory();
    toggleEmptyState();
    appendMessageEl('user', text, false);
    scrollToBottom();

    promptInput.value = '';
    autoResizeTextarea();

    isSending = true;
    sendBtn.disabled = true;
    appendTypingIndicator();

    callGemini(apiKey)
      .then(function (data) {
        removeTypingIndicator();
        var reply = extractReplyText(data);
        if (!reply) {
          reply = 'Maazrat, koi jawab nahi mila. Dobara koshish karein.';
          history.push({ role: 'model', text: reply });
          saveHistory();
          appendMessageEl('assistant', reply, true);
        } else {
          history.push({ role: 'model', text: reply });
          saveHistory();
          appendMessageEl('assistant', reply, false);
        }
        scrollToBottom();
      })
      .catch(function (err) {
        removeTypingIndicator();
        var msg = 'Error: ' + (err && err.message ? err.message : 'Kuch ghalat ho gaya.');
        if (err && err.message && err.message.indexOf('API_KEY_INVALID') !== -1) {
          msg = 'API key sahi nahi hai. Settings mein dobara check karein.';
        } else if (err && /quota|RESOURCE_EXHAUSTED/i.test(err.message || '')) {
          msg = 'Free tier ki daily/rate limit khatam ho gayi. Thodi dair baad dobara koshish karein.';
        }
        appendMessageEl('assistant', msg, true);
        scrollToBottom();
      })
      .finally(function () {
        isSending = false;
        sendBtn.disabled = false;
      });
  }

  // ---------- Event listeners ----------
  composerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage(promptInput.value);
  });

  promptInput.addEventListener('input', autoResizeTextarea);

  promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(promptInput.value);
    }
  });

  suggestionChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var p = chip.getAttribute('data-prompt') || '';
      sendMessage(p);
    });
  });

  newChatBtn.addEventListener('click', function () {
    if (!history.length) return;
    var confirmed = window.confirm('Naya chat shuru karein? Purani baat cheet delete ho jaye gi.');
    if (!confirmed) return;
    history = [];
    saveHistory();
    renderHistory();
  });

  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsModal.addEventListener('click', function (e) {
    if (e.target === settingsModal) closeSettings();
  });

  saveSettingsBtn.addEventListener('click', function () {
    var key = apiKeyInput.value.trim();
    setApiKey(key);
    setSystemPrompt(systemPromptInput.value.trim());
    updateStatusTag();

    settingsMsg.textContent = key ? 'Save ho gaya!' : 'API key hata di gayi.';
    settingsMsg.hidden = false;

    setTimeout(function () {
      closeSettings();
    }, 700);
  });

  // ---------- Service worker registration ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  // ---------- Go ----------
  init();
})();
