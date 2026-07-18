  const API_URL = "https://www.tikwm.com/api/";
  const API_ORIGIN = "https://www.tikwm.com";

  const urlInput = document.getElementById('urlInput');
  const fetchBtn = document.getElementById('fetchBtn');
  const loading = document.getElementById('loading');
  const resultCard = document.getElementById('resultCard');
  const videoTitle = document.getElementById('videoTitle');
  const formatBadge = document.getElementById('formatBadge');
  const downloadLinkBtn = document.getElementById('downloadLinkBtn');
  const newDownloadBtn = document.getElementById('newDownloadBtn');
  const errorMessageDiv = document.getElementById('errorMessage');
  const thumbFrame = document.getElementById('thumbFrame');
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const historyClearBtn = document.getElementById('historyClearBtn');
  const statTotal = document.getElementById('statTotal');
  const statToday = document.getElementById('statToday');

  const DEFAULT_THUMB = '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.6"><path d="M4 6h16v12H4z" stroke-linejoin="round"/><path d="M10 9.5v5l4.5-2.5z" fill="#ef4444" stroke="none"/></svg>';

  let currentFormat = 'no_wm';
  let currentDownloadUrl = '';
  let currentTitle = '';

  const STORE_KEY = 'ttdl_history_v1';
  const STATS_KEY = 'ttdl_stats_v1';

  function loadHistory(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch(e){ return []; }
  }
  function saveHistory(list){
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 20)));
  }
  function loadStats(){
    try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { total:0, day:'', dayCount:0 }; }
    catch(e){ return { total:0, day:'', dayCount:0 }; }
  }
  function saveStats(stats){ localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }

  function renderStats(){
    const stats = loadStats();
    statTotal.textContent = stats.total || 0;
    const today = new Date().toDateString();
    statToday.textContent = (stats.day === today) ? (stats.dayCount || 0) : 0;
  }

  function bumpStats(){
    const stats = loadStats();
    const today = new Date().toDateString();
    stats.total = (stats.total || 0) + 1;
    if (stats.day === today){ stats.dayCount = (stats.dayCount || 0) + 1; }
    else { stats.day = today; stats.dayCount = 1; }
    saveStats(stats);
    renderStats();
  }

  function renderHistory(){
    const list = loadHistory();
    if (!list.length){
      historySection.style.display = 'none';
      return;
    }
    historySection.style.display = 'block';
    historyList.innerHTML = list.map(item => `
      <div class="history-item">
        <div class="h-dot"></div>
        <div class="h-info">
          <div class="h-title-text">${item.title}</div>
          <div class="h-meta">${item.format} · ${item.time}</div>
        </div>
      </div>
    `).join('');
  }

  function addToHistory(title, format){
    const list = loadHistory();
    list.unshift({
      title: title || 'TikTok Video',
      format: format || '',
      time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
    });
    saveHistory(list);
    renderHistory();
  }

  historyClearBtn.addEventListener('click', () => {
    localStorage.removeItem(STORE_KEY);
    renderHistory();
    showToast('History cleared');
  });

  renderStats();
  renderHistory();

  // Format selector
  const formatBtns = document.querySelectorAll('.format-btn');
  formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      formatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFormat = btn.dataset.format;
      updateFormatBadge();
    });
  });

  function updateFormatBadge(){
    formatBadge.textContent = currentFormat === 'no_wm' ? 'No Watermark Video' : 'MP3 Audio';
  }

  function showError(msg){
    errorMessageDiv.textContent = msg;
    errorMessageDiv.style.display = 'block';
    setTimeout(() => errorMessageDiv.style.display = 'none', 5000);
  }
  function hideError(){ errorMessageDiv.style.display = 'none'; }

  function showToast(msg, isError = false){
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    if (isError) toast.style.borderColor = '#ff4d6d';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  function isValidTikTokUrl(url){
    if (!url) return false;
    return /tiktok\.com/i.test(url);
  }

  function resolveUrl(u){
    if (!u) return '';
    return u.startsWith('http') ? u : API_ORIGIN + u;
  }

  async function processDownload(){
    const url = urlInput.value.trim();

    if (!url){
      showError('Please enter a TikTok URL.');
      return;
    }
    if (!isValidTikTokUrl(url)){
      showError('Invalid TikTok URL. Please check the format.');
      return;
    }

    thumbFrame.innerHTML = DEFAULT_THUMB;

    fetchBtn.disabled = true;
    loading.style.display = 'block';
    resultCard.style.display = 'none';
    hideError();

    try {
      const requestUrl = `${API_URL}?url=${encodeURIComponent(url)}`;
      const response = await fetch(requestUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if ((data.code === 0 || data.success === true) && data.data){
        const info = data.data;
        const videoLink = resolveUrl(info.play || info.hdplay || info.wmplay);
        const audioLink = resolveUrl(info.music);
        const link = currentFormat === 'mp3' ? audioLink : videoLink;

        if (!link) throw new Error('Download link not available');

        currentDownloadUrl = link;
        currentTitle = info.title || 'TikTok Video';

        if (info.cover){
          thumbFrame.innerHTML = `<img src="${resolveUrl(info.cover)}" alt="thumbnail" onerror="this.parentNode.innerHTML=DEFAULT_THUMB">`;
        }

        videoTitle.textContent = currentTitle;
        updateFormatBadge();
        downloadLinkBtn.href = currentDownloadUrl;
        downloadLinkBtn.download = `${currentTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0,60)}.${currentFormat === 'mp3' ? 'mp3' : 'mp4'}`;

        resultCard.style.display = 'block';
        showToast('Ready to download!');
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        throw new Error(data.msg || data.message || 'Download link not available');
      }
    } catch (error) {
      showError(`Error: ${error.message}. Please check the URL and try again.`);
      showToast(`Failed: ${error.message}`, true);
    } finally {
      fetchBtn.disabled = false;
      loading.style.display = 'none';
    }
  }

  function resetForm(){
    urlInput.value = '';
    resultCard.style.display = 'none';
    currentDownloadUrl = '';
    currentTitle = '';
    thumbFrame.innerHTML = DEFAULT_THUMB;
    videoTitle.textContent = '-';
    urlInput.focus();
    showToast('Ready for new download');
  }

  fetchBtn.addEventListener('click', processDownload);
  newDownloadBtn.addEventListener('click', resetForm);
  urlInput.addEventListener('keypress', e => { if (e.key === 'Enter') processDownload(); });

  downloadLinkBtn.addEventListener('click', () => {
    addToHistory(videoTitle.textContent, currentFormat === 'mp3' ? 'MP3' : 'MP4');
    bumpStats();
  });

  updateFormatBadge();

  const waOverlay = document.getElementById('waOverlay');
  const waModalClose = document.getElementById('waModalClose');
  const waModalLater = document.getElementById('waModalLater');
  waModalClose.addEventListener('click', () => waOverlay.classList.remove('show'));
  waModalLater.addEventListener('click', () => waOverlay.classList.remove('show'));
  waOverlay.addEventListener('click', (e) => {
    if (e.target === waOverlay) waOverlay.classList.remove('show');
  });
  setTimeout(() => { waOverlay.classList.add('show'); }, 1000);
