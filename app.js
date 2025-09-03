// =================================================================
// KONFIGURASI SUPABASE
// =================================================================
const SUPABASE_URL = 'https://lofsbwhexxzpxqupfxiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZnNid2hleHh6cHhxdXBmeGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4OTQ0NTksImV4cCI6MjA3MjQ3MDQ1OX0.FoF14c8ZYMs-7BbQpTcbJhPzRPAhdBXK_ksMUBWZEP0';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =================================================================
// REFERENSI ELEMENT HTML
// =================================================================
const commentsContainer = document.getElementById('comments-container');
const participantListEl = document.getElementById('participant-list');
const paginationControlsEl = document.getElementById('pagination-controls');
const chartCanvas = document.getElementById('voteChart').getContext('2d');

// Modal Elements
const openModalBtn = document.getElementById('open-vote-modal');
const modalOverlay = document.getElementById('vote-modal');
const closeModalBtn = document.getElementById('close-modal');
const voteForm = document.getElementById('voteForm');
const nameInput = document.getElementById('name-input');
const commentInput = document.getElementById('comment-input');

// =================================================================
// STATE APLIKASI
// =================================================================
let voteChart;
let allParticipants = [];
let currentPage = 1;
const itemsPerPage = 5;

// =================================================================
// FUNGSI UTAMA
// =================================================================

// Inisialisasi Chart
function initializeChart() {
    voteChart = new Chart(chartCanvas, {
        type: 'pie',
        data: {
            labels: ['Setuju', 'Tidak Setuju'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#27ae60', '#c0392b'],
                borderColor: '#ffffff',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Update data di Chart
function updateChart(agreeCount, disagreeCount) {
    if (voteChart) {
        voteChart.data.datasets[0].data[0] = agreeCount;
        voteChart.data.datasets[0].data[1] = disagreeCount;
        voteChart.update();
    }
}

// Menampilkan komentar dengan gaya chat
function displayComment(data) {
    if (!data.comment_text) return; // Jangan tampilkan jika tidak ada komentar
    
    const bubble = document.createElement('div');
    bubble.classList.add('comment-bubble', data.vote_option);
    
    bubble.innerHTML = `
        <div class="name" style="color: ${data.vote_option === 'setuju' ? '#27ae60' : '#c0392b'};">${data.name}</div>
        <div class="text">${data.comment_text}</div>
    `;
    
    commentsContainer.prepend(bubble); // Prepend agar muncul di atas (tapi karena flex-reverse, jadi di bawah)
}

// Render list partisipan untuk halaman tertentu
function renderParticipants() {
    participantListEl.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = allParticipants.slice(startIndex, endIndex);

    paginatedItems.forEach(name => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        item.textContent = name;
        participantListEl.appendChild(item);
    });
    renderPaginationControls();
}

// Render tombol pagination
function renderPaginationControls() {
    paginationControlsEl.innerHTML = '';
    const totalPages = Math.ceil(allParticipants.length / itemsPerPage);
    if (totalPages <= 1) return;

    paginationControlsEl.innerHTML = `
        <button id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>
        <span>Halaman ${currentPage} dari ${totalPages}</span>
        <button id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>
    `;

    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderParticipants();
        }
    });
    
    document.getElementById('next-page')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderParticipants();
        }
    });
}

// Ambil semua data awal saat halaman dimuat
async function fetchInitialData() {
    // Ambil data votes untuk chart
    const { data: votes, error: votesError } = await supabaseClient.from('votes').select('option, count');
    if (votes) {
        const agree = votes.find(v => v.option === 'setuju')?.count || 0;
        const disagree = votes.find(v => v.option === 'tidak-setuju')?.count || 0;
        updateChart(agree, disagree);
    }

    // Ambil data comments untuk partisipan dan live chat
    const { data: comments, error: commentsError } = await supabaseClient.from('comments').select('*').order('created_at', { ascending: true });
    if (comments) {
        allParticipants = comments.map(c => c.name);
        renderParticipants();
        
        commentsContainer.innerHTML = '';
        comments.forEach(displayComment);
    }
}

// =================================================================
// EVENT LISTENERS
// =================================================================

// Modal Listeners
openModalBtn.addEventListener('click', () => modalOverlay.classList.add('show'));
closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('show'));
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.remove('show');
    }
});

// Form Submission
voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const voteChoice = e.submitter.dataset.vote;
    const name = nameInput.value.trim();
    const comment = commentInput.value.trim();

    if (!name || !voteChoice) {
        alert('Nama harus diisi!');
        return;
    }

    // Kirim komentar dan nama ke tabel 'comments'
    const { error: commentError } = await supabaseClient
        .from('comments')
        .insert([{ name: name, comment_text: comment, vote_option: voteChoice }]);

    if (commentError) {
        console.error("Error submitting comment:", commentError);
        return;
    }
    
    // Panggil RPC untuk menambah vote
    const { error: voteError } = await supabaseClient.rpc('increment_vote', { vote_option: voteChoice });
    if (voteError) console.error("Error incrementing vote:", voteError);

    // Reset form dan tutup modal
    voteForm.reset();
    modalOverlay.classList.remove('show');
});


// =================================================================
// REAL-TIME SUBSCRIPTIONS
// =================================================================
function subscribeToChanges() {
    const channel = supabaseClient.channel('public-db-changes');
    channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
            const newComment = payload.new;
            // Tambahkan ke live chat
            displayComment(newComment);
            // Tambahkan ke daftar partisipan dan render ulang
            allParticipants.push(newComment.name);
            renderParticipants();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'votes' }, (payload) => {
            const { option, count } = payload.new;
            const currentAgree = option === 'setuju' ? count : voteChart.data.datasets[0].data[0];
            const currentDisagree = option === 'tidak-setuju' ? count : voteChart.data.datasets[0].data[1];
            updateChart(currentAgree, currentDisagree);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime status: SUBSCRIBED');
            }
        });
}

// =================================================================
// INISIALISASI APLIKASI
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    initializeChart();
    fetchInitialData();
    subscribeToChanges();
});