// ---------- Global State ----------
let selectedCategory = null;
let currentInputMode = 'text';
let isRecording = false;
let data = {
  emergency: null,
  health: null,
  plants: null,
  women: null
};

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const adviceDisplay = $('#advice-display');

function showAdviceCard({ title, content, tags = [], type = 'info', confidence = null }) {
  const tagHtml = tags.map(t => `<span class="badge">${t}</span>`).join(' ');
  const confHtml = confidence !== null
    ? `<span class="badge badge-outline text-xs">${confidence}% confidence</span>`
    : '';
  adviceDisplay.innerHTML = `
    <div class="card p-6" style="border:2px solid hsl(var(--primary)); background:hsl(var(--primary)/0.08)">
      <div class="space-y-4">
        <div class="flex items-start space-x-3">
          <div class="p-2 rounded-full bg-white shadow-sm">${type === 'warn' ? '⚠️' : 'ℹ️'}</div>
          <div class="flex-1">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold text-lg">${title}</h3>
              <div class="flex items-center space-x-2">${confHtml}</div>
            </div>
            ${Array.isArray(content)
              ? `<ul style="text-align:left;padding-left:1rem">${content.map(c=>`<li style="margin:.25rem 0">${c}</li>`).join('')}</ul>`
              : `<p class="leading-relaxed mb-4" style="text-align:left">${content}</p>`}
            <div class="flex flex-wrap gap-2">${tagHtml}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function loading(title = 'Processing...', content = 'Analyzing your input...') {
  adviceDisplay.innerHTML = `
    <div class="card p-6" style="border:2px solid hsl(var(--primary)); background:hsl(var(--primary)/0.08)">
      <div class="space-y-4">
        <div class="flex items-start space-x-3">
          <div class="p-2 rounded-full bg-white shadow-sm"><div class="animate-pulse">⏳</div></div>
          <div class="flex-1">
            <h3 class="font-semibold text-lg">${title}</h3>
            <p class="leading-relaxed mb-4">${content}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---------- JSON Loader with Fallback ----------
async function loadJSON(url, fallbackScriptId) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch blocked');
    return await res.json();
  } catch {
    // Use embedded fallback if fetch fails (e.g., opening file directly on phone)
    const txt = document.getElementById(fallbackScriptId)?.textContent || '{}';
    return JSON.parse(txt);
  }
}

async function initData() {
  [data.emergency, data.health, data.plants, data.women] = await Promise.all([
    loadJSON('emergency.json', 'embedded-emergency'),
    loadJSON('health.json', 'embedded-health'),
    loadJSON('plants.json', 'embedded-plants'),
    loadJSON('women.json', 'embedded-women')
  ]);
}

// ---------- Scrolling ----------
function scrollToCategories() {
  document.getElementById('health-categories').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Emergency Actions ----------
function handleCPR() {
  const { brief = [], detailed = [] } = data.emergency?.cpr || {};
  showAdviceCard({
    title: 'CPR — Brief Steps',
    content: brief,
    tags: ['Emergency', 'CPR', 'Immediate Action'],
    type: 'warn',
    confidence: 98
  });
  // Append "Detailed" section
  setTimeout(() => {
    showAdviceCard({
      title: 'CPR — Detailed Guide',
      content: detailed,
      tags: ['CPR', 'Detailed'],
      type: 'info',
      confidence: 96
    });
  }, 400);
}

function handleContacts() {
  const list = data.emergency?.contactsHyderabad || [];
  const content = list.map(x => `${x.name}: <b>${x.number}</b>`);
  showAdviceCard({
    title: 'Emergency Contacts — Hyderabad / India',
    content,
    tags: ['112', '100', '108', '101', '102', '1091', '1098'],
    type: 'info'
  });
}

// ---------- Category Selection ----------
function selectCategory(cat, el) {
  document.querySelectorAll('.health-category').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  selectedCategory = cat;

  if (cat === 'medical') {
    const tips = data.health?.generalTips || [];
    showAdviceCard({
      title: 'General Medical Guidance',
      content: tips,
      tags: ['Medical', 'General']
    });
  } else if (cat === 'plant') {
    const diseases = data.plants?.diseases || [];
    const lines = diseases.map(d => `• <b>${d.name}</b> — ${d.signs}. Care: ${d.care}`);
    showAdviceCard({
      title: 'Common Plant Diseases & Care',
      content: lines,
      tags: ['Plants','Care']
    });
  } else if (cat === 'women') {
    const w = data.women || {};
    const lines = [
      'PCOD/PCOS:', ...(w.pcodPcos || []),
      '',
      'Menstrual Care:', ...(w.menstrualCare || []),
      '',
      'Wellness:', ...(w.wellness || [])
    ];
    showAdviceCard({
      title: "Women's Health — PCOD/PCOS & Menstrual Care",
      content: lines,
      tags: ['Women','PCOS','Menstrual']
    });
  }
}

// ---------- Input Modes ----------
function setMode(mode) {
  currentInputMode = mode;
  // button styles
  ['text','voice','image'].forEach(id=>{
    const b = document.getElementById(`${id}-btn`);
    b.className = 'btn btn-outline text-sm';
  });
  document.getElementById(`${mode}-btn`).className = 'btn btn-primary text-sm';

  // show/hide areas
  const textWrap = document.getElementById('text-area-wrap');
  const camWrap = document.getElementById('camera-wrap');

  if (mode === 'text' || mode === 'voice') {
    textWrap.classList.remove('hidden');
    camWrap.classList.add('hidden');
  } else if (mode === 'image') {
    textWrap.classList.add('hidden');
    camWrap.classList.remove('hidden');
  }
}

// ---------- Voice to Text ----------
let recognizer = null;
function startVoice() {
  if (isRecording) return;
  const textarea = document.getElementById('input-textarea');
  const voiceBtn = document.getElementById('voice-btn');
  const voiceText = document.getElementById('voice-text');

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showAdviceCard({
      title: 'Voice Not Supported',
      content: 'Your browser does not support offline Web Speech API here. Please use text input.',
      tags: ['Voice'], type: 'info'
    });
    return;
  }

  recognizer = new SR();
  recognizer.lang = 'en-IN';
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  isRecording = true;
  voiceBtn.classList.add('recording');
  voiceText.textContent = 'Recording...';

  recognizer.onresult = (e) => {
    const text = e.results[0][0].transcript;
    textarea.value = text;
    updateSubmitButton();
  };
  recognizer.onerror = () => {};
  recognizer.onend = () => {
    isRecording = false;
    voiceBtn.classList.remove('recording');
    voiceText.textContent = 'Voice';
  };

  recognizer.start();
}

// ---------- Camera + Offline Heuristic ID ----------
let stream = null;
async function startCamera() {
  const video = document.getElementById('video');
  const captureBtn = document.getElementById('btn-capture');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    captureBtn.disabled = false;
  } catch {
    showAdviceCard({
      title: 'Camera Permission Needed',
      content: 'Allow camera access in your browser/app permissions.',
      tags: ['Camera'], type: 'warn'
    });
  }
}

function stopCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
}

function analyzeImageHeuristic() {
  // Simple offline heuristic: check if image is predominantly green -> assume plant
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let greenish = 0, total = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i], g = imgData[i+1], b = imgData[i+2];
    if (g > r + 15 && g > b + 15) greenish++;
    total++;
  }
  const ratio = greenish / total;
  return ratio > 0.25; // crude threshold
}

function captureAndIdentify() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const w = video.videoWidth, h = video.videoHeight;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  const isPlant = analyzeImageHeuristic();

  if (isPlant) {
    const diseases = data.plants?.diseases || [];
    const lines = [
      'Detected plant-like image (heuristic).',
      ...diseases.map(d => `• ${d.name}: ${d.signs}. Care: ${d.care}`)
    ];
    showAdviceCard({ title: 'Plant Identified (Offline Heuristic)', content: lines, tags: ['Image','Plants'] });
  } else {
    showAdviceCard({
      title: 'Could Not Identify',
      content: 'No strong plant features detected. Try better lighting, closer focus, or provide text description.',
      tags: ['Image'], type: 'info'
    });
  }
}

// ---------- AI Advice: keyword search across JSON ----------
function searchAdvice(query) {
  const q = query.toLowerCase();
  const results = [];

  // Medical symptoms
  (data.health?.symptoms || []).forEach(s => {
    if (s.keywords.some(k => q.includes(k))) {
      results.push({ area:'Medical', advice:s.advice });
    }
  });

  // Women’s
  if (q.includes('pcos') || q.includes('pcod')) {
    (data.women?.pcodPcos || []).forEach(a => results.push({ area:'Women (PCOS)', advice:a }));
  }
  if (q.includes('period') || q.includes('menstru')) {
    (data.women?.menstrualCare || []).forEach(a => results.push({ area:'Menstrual Care', advice:a }));
  }

  // Plants
  (data.plants?.diseases || []).forEach(d => {
    if ([d.name, d.signs].some(t => t.toLowerCase().includes(q)) || q.includes('plant') || q.includes('leaf')) {
      results.push({ area:'Plants', advice:`${d.name}: ${d.care}` });
    }
  });

  return results;
}

function submitInput() {
  const textarea = document.getElementById('input-textarea');
  const content = textarea.value.trim();
  if (!content) return;

  loading();

  setTimeout(() => {
    const found = searchAdvice(content);
    if (found.length) {
      const lines = found.map(f => `• <b>${f.area}</b> — ${f.advice}`);
      showAdviceCard({
        title: 'AI Advice (Offline Knowledge Base)',
        content: lines,
        tags: ['Offline','KB'],
        confidence: 87
      });
    } else {
      showAdviceCard({
        title: 'No Direct Match',
        content: "I couldn't find an exact match. Try adding more detail like symptom duration, severity, or affected plant part.",
        tags: ['Hint'], type: 'info'
      });
    }
    textarea.value = '';
    updateSubmitButton();
  }, 600);
}

// ---------- UI Wiring ----------
function updateSubmitButton() {
  const textarea = document.getElementById('input-textarea');
  const submitBtn = document.getElementById('submit-btn');
  if (textarea.value.trim()) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  } else {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
  }
}

// ---------- Event Listeners ----------
document.addEventListener('DOMContentLoaded', async () => {
  await initData();

  // Start button scroll
  document.getElementById('start-btn').addEventListener('click', scrollToCategories);

  // Emergency actions
  document.getElementById('btn-cpr').addEventListener('click', handleCPR);
  document.getElementById('btn-contacts').addEventListener('click', handleContacts);

  // Category cards
  document.querySelectorAll('.health-category').forEach(card => {
    card.addEventListener('click', () => selectCategory(card.dataset.category, card));
  });

  // Modes
  document.getElementById('text-btn').addEventListener('click', () => setMode('text'));
  document.getElementById('voice-btn').addEventListener('click', () => { setMode('voice'); startVoice(); });
  document.getElementById('image-btn').addEventListener('click', () => setMode('image'));

  // Text input + submit
  document.getElementById('input-textarea').addEventListener('input', updateSubmitButton);
  document.getElementById('input-textarea').addEventListener('keypress', (e)=>{
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitInput(); }
  });
  document.getElementById('submit-btn').addEventListener('click', submitInput);

  // Camera controls
  document.getElementById('btn-start-camera').addEventListener('click', startCamera);
  document.getElementById('btn-capture').addEventListener('click', captureAndIdentify);

  // Default state
  updateSubmitButton();
  setMode('text');
});

// Clean up camera if user navigates away
window.addEventListener('beforeunload', stopCamera);