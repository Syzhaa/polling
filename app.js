// =================================================================
// KONFIGURASI SUPABASE
// =================================================================
const SUPABASE_URL = 'https://lofsbwhexxzpxqupfxiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZnNid2hleHh6cHhxdXBmeGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4OTQ0NTksImV4cCI6MjA3MjQ3MDQ1OX0.FoF14c8ZYMs-7BbQpTcbJhPzRPAhdBXK_ksMUBWZEP0';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =================================================================
// REFERENSI ELEMENT HTML
// =================================================================
const nameRegistrationScreen = document.getElementById('name-registration-screen');
const nameForm = document.getElementById('name-form');
const nameInputReg = document.getElementById('name-input-reg');
const mainApp = document.getElementById('main-app');
const chatScreen = document.getElementById('chat-screen');
const commentForm = document.getElementById('comment-form');
const commentInput = document.getElementById('comment-input');   // textarea
const agreeBtn = document.getElementById('agree-btn');
const disagreeBtn = document.getElementById('disagree-btn');
const chartCanvas = document.getElementById('voteChart').getContext('2d');
const replyContextBar = document.getElementById('reply-context-bar');
const replyToNameEl = document.getElementById('reply-to-name');
const replyToTextEl = document.getElementById('reply-to-text');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');
const chartCard = document.getElementById('chart-card');
const toggleChartBtn = document.getElementById('toggle-chart-btn');

// =================================================================
// STATE APLIKASI
// =================================================================
let currentUser = null;
let voteChart;
let replyContext = null;

// =================================================================
// UTIL / UI
// =================================================================
function disableVotingButtons() {
  agreeBtn.disabled = true; disagreeBtn.disabled = true;
  agreeBtn.style.cursor = 'not-allowed'; disagreeBtn.style.cursor = 'not-allowed';
  agreeBtn.style.opacity = '0.5'; disagreeBtn.style.opacity = '0.5';
}

function initializeChart() {
  voteChart = new Chart(chartCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Setuju', 'Tidak Setuju'],
      datasets: [{ data: [0, 0], backgroundColor: ['#25D366', '#FF5A5F'], borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom' } },
      cutout: '60%'
    }
  });
}

function updateChart(agreeCount, disagreeCount) {
  if (!voteChart) return;
  voteChart.data.datasets[0].data[0] = agreeCount;
  voteChart.data.datasets[0].data[1] = disagreeCount;
  voteChart.update();
}

function scrollToBottom() {
  chatScreen.scrollTop = chatScreen.scrollHeight;
}

function showReplyUI(context) {
  replyContextBar.style.display = 'flex';
  replyToNameEl.textContent = context.name;
  replyToTextEl.textContent = context.text;
  commentInput.focus();
}

function cancelReply() {
  replyContext = null;
  replyContextBar.style.display = 'none';
}

// =================================================================
// RENDER PESAN
// =================================================================
function displayMessage(data) {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  bubble.dataset.id = data.id;
  bubble.dataset.name = data.name;
  bubble.dataset.text = data.comment_text;

  let replyHTML = '';
  if (data.reply_to_id) {
    replyHTML = `
      <div class="reply-block">
        <div class="name">${data.reply_to_name}</div>
        <div class="text">${data.reply_to_text}</div>
      </div>
    `;
  }
  if (data.vote_option === 'komentar') {
    if (data.name === currentUser) {
      bubble.classList.add('sent');
      bubble.innerHTML = `${replyHTML}<div class="text">${data.comment_text}</div>`;
    } else {
      bubble.classList.add('received');
      bubble.innerHTML = `${replyHTML}<div class="name">${data.name}</div><div class="text">${data.comment_text}</div>`;
    }
  } else {
    bubble.classList.add('system');
    bubble.innerHTML = `<strong>${data.name}</strong> ${data.comment_text}`;
  }
  chatScreen.appendChild(bubble);
}

// =================================================================
// DATA
// =================================================================
async function fetchInitialData() {
  const { data: votes } = await supabaseClient.from('votes').select('option, count');
  if (votes) {
    const agree = votes.find(v => v.option === 'setuju')?.count || 0;
    const disagree = votes.find(v => v.option === 'tidak-setuju')?.count || 0;
    updateChart(agree, disagree);
  }
  const { data: comments } = await supabaseClient.from('comments').select('*').order('created_at', { ascending: true });
  if (comments) {
    chatScreen.innerHTML = '';
    comments.forEach(displayMessage);
    scrollToBottom();
  }
}

async function handleVote(voteChoice, message) {
  if (localStorage.getItem('userHasVoted')) {
    alert('Anda sudah memberikan suara.'); return;
  }
  disableVotingButtons();
  localStorage.setItem('userHasVoted', 'true');
  await supabaseClient.from('comments').insert([{ name: currentUser, comment_text: message, vote_option: voteChoice }]);
  await supabaseClient.rpc('increment_vote', { vote_option: voteChoice });
}

// =================================================================
// AUTH / START
// =================================================================
function checkUser() {
  const storedName = localStorage.getItem('votingAppName');
  if (storedName) {
    currentUser = storedName;
    nameRegistrationScreen.style.display = 'none';
    mainApp.style.display = 'flex';

    const hasVoted = localStorage.getItem('userHasVoted');
    if (hasVoted) disableVotingButtons();

    fetchInitialData();
    subscribeToChanges();
  } else {
    nameRegistrationScreen.style.display = 'flex';
    mainApp.style.display = 'none';
  }
}

// =================================================================
// EVENT LISTENERS
// =================================================================
nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInputReg.value.trim();
  if (name) {
    localStorage.setItem('votingAppName', name);
    checkUser();
  }
});

// Auto-expand textarea & kontrol Enter
commentInput.addEventListener('input', () => {
  commentInput.style.height = 'auto';
  commentInput.style.height = Math.min(commentInput.scrollHeight, 120) + 'px';
});

commentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    // Enter biasa → baris baru, jangan submit
    e.stopPropagation();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    // Ctrl/Cmd+Enter → kirim
    e.preventDefault();
    commentForm.requestSubmit();
  }
});

commentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const comment = commentInput.value.trim();
  if (comment) {
    const messageData = { name: currentUser, comment_text: comment, vote_option: 'komentar' };
    if (replyContext) {
      messageData.reply_to_id = replyContext.id;
      messageData.reply_to_name = replyContext.name;
      messageData.reply_to_text = replyContext.text;
    }
    await supabaseClient.from('comments').insert([messageData]);
    commentInput.value = '';
    commentInput.style.height = '32px'; // reset kecil lagi
    cancelReply();
  }
});

agreeBtn.addEventListener('click', () => handleVote('setuju', 'memilih Setuju 👍'));
disagreeBtn.addEventListener('click', () => handleVote('tidak-setuju', 'memilih Tidak Setuju 👎'));
cancelReplyBtn.addEventListener('click', cancelReply);

chatScreen.addEventListener('click', (e) => {
  const bubble = e.target.closest('.chat-bubble:not(.system)');
  if (bubble) {
    replyContext = { id: bubble.dataset.id, name: bubble.dataset.name, text: bubble.dataset.text };
    showReplyUI(replyContext);
  }
});

// Toggle chart collapse
toggleChartBtn.addEventListener('click', () => {
  chartCard.classList.toggle('is-collapsed');
  const icon = toggleChartBtn.querySelector('.material-symbols-outlined');
  const collapsed = chartCard.classList.contains('is-collapsed');
  icon.textContent = collapsed ? 'expand_more' : 'expand_less';
  toggleChartBtn.setAttribute('aria-expanded', String(!collapsed));

  if (collapsed) {
    voteChart && voteChart.resize(0, 0); // paksa nol
  } else {
    setTimeout(() => { voteChart && voteChart.resize(); }, 10);
  }
});

// =================================================================
// REAL-TIME SUBSCRIPTIONS
// =================================================================
function subscribeToChanges() {
  supabaseClient
    .channel('public-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      if (payload.table === "comments" && payload.eventType === 'INSERT') {
        displayMessage(payload.new);
        scrollToBottom();
      }
      if (payload.table === "votes" && payload.eventType === 'UPDATE') {
        const { option, count } = payload.new;
        const currentAgree = option === 'setuju' ? count : voteChart.data.datasets[0].data[0];
        const currentDisagree = option === 'tidak-setuju' ? count : voteChart.data.datasets[0].data[1];
        updateChart(currentAgree, currentDisagree);
      }
    })
    .subscribe();
}

// =================================================================
// INISIALISASI
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
  initializeChart();
  checkUser();
});
