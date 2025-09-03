// =================================================================
// LANGKAH 1: KONFIGURASI SUPABASE
// Ganti dengan URL dan ANON KEY dari proyek Supabase Anda
// =================================================================
const SUPABASE_URL = 'https://lofsbwhexxzpxqupfxiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZnNid2hleHh6cHhxdXBmeGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4OTQ0NTksImV4cCI6MjA3MjQ3MDQ1OX0.FoF14c8ZYMs-7BbQpTcbJhPzRPAhdBXK_ksMUBWZEP0A';

// Inisialisasi Klien Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// =================================================================
// LANGKAH 2: REFERENSI KE ELEMENT HTML
// =================================================================
const agreeCountEl = document.getElementById('agree-count');
const disagreeCountEl = document.getElementById('disagree-count');
const agreeBtn = document.getElementById('agree-btn');
const disagreeBtn = document.getElementById('disagree-btn');
const commentForm = document.getElementById('commentForm');
const nameInput = document.getElementById('name-input');
const commentInput = document.getElementById('comment-input');
const commentsContainer = document.getElementById('comments-container');


// =================================================================
// LANGKAH 3: FUNGSI UNTUK MENGAMBIL DATA AWAL
// =================================================================
async function fetchInitialData() {
    // Ambil data voting awal
    const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('option, count');
    
    if (votes) {
        votes.forEach(vote => {
            if (vote.option === 'setuju') {
                agreeCountEl.textContent = vote.count;
            } else if (vote.option === 'tidak-setuju') {
                disagreeCountEl.textContent = vote.count;
            }
        });
    }

    // Ambil data komentar yang sudah ada
    const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false }); // Urutkan dari terbaru

    if (comments) {
        commentsContainer.innerHTML = ''; // Kosongkan dulu
        comments.forEach(comment => displayComment(comment));
    }
}


// =================================================================
// LANGKAH 4: FUNGSI UNTUK VOTING & KOMENTAR
// =================================================================
// Event listener untuk tombol Setuju
agreeBtn.addEventListener('click', async () => {
    // Memanggil fungsi 'increment_vote' yang kita buat di SQL Editor
    await supabase.rpc('increment_vote', { vote_option: 'setuju' });
});

// Event listener untuk tombol Tidak Setuju
disagreeBtn.addEventListener('click', async () => {
    await supabase.rpc('increment_vote', { vote_option: 'tidak-setuju' });
});

// Event listener untuk form komentar
commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const comment = commentInput.value.trim();
    const voteChoice = document.querySelector('input[name="vote_choice"]:checked').value;

    if (name && comment) {
        // Kirim data baru ke tabel 'comments'
        await supabase
            .from('comments')
            .insert([{ name: name, comment_text: comment, vote_option: voteChoice }]);
        
        nameInput.value = '';
        commentInput.value = '';
    }
});

// Fungsi untuk menampilkan komentar
function displayComment(data) {
    const commentElement = document.createElement('div');
    commentElement.classList.add('comment-item', data.vote_option);

    commentElement.innerHTML = `
        <div class="comment-meta">${data.name}</div>
        <div class="comment-text">${data.comment_text}</div>
    `;
    
    // Menambahkan komentar baru di bagian paling atas
    commentsContainer.prepend(commentElement);
}


// =================================================================
// LANGKAH 5: REAL-TIME SUBSCRIPTIONS
// =================================================================
// Fungsi untuk mendengarkan semua perubahan data
function subscribeToChanges() {
    // Mendengarkan jika ada komentar BARU (INSERT) di tabel 'comments'
    supabase
        .from('comments')
        .on('INSERT', payload => {
            displayComment(payload.new);
        })
        .subscribe();
    
    // Mendengarkan jika ada PEMBARUAN (UPDATE) di tabel 'votes'
    supabase
        .from('votes')
        .on('UPDATE', payload => {
            const { option, count } = payload.new;
            if (option === 'setuju') {
                agreeCountEl.textContent = count;
            } else if (option === 'tidak-setuju') {
                disagreeCountEl.textContent = count;
            }
        })
        .subscribe();
}


// =================================================================
// LANGKAH 6: JALANKAN SEMUA FUNGSI
// =================================================================
fetchInitialData();
subscribeToChanges();