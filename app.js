// --- CONFIGURAZIONE FIREBASE (GRATUITO) ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBvBBQaHQEji3b-eHoOu2qaanG1W-66Asc",
  authDomain: "my-shool-3bacc.firebaseapp.com",
  projectId: "my-shool-3bacc",
  storageBucket: "my-shool-3bacc.firebasestorage.app",
  messagingSenderId: "680933420912",
  appId: "1:680933420912:web:d080fc76fed5f7d08a29b5",
  measurementId: "G-1Z8EKY1M31"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let subjectsData = [];
let tasksData = [];
let currentSubjectId = null; // ID della cartella materia aperta al momento

// --- AUTENTICAZIONE ---
const authContainer = document.getElementById('auth-container');
const mainApp = document.getElementById('main-app');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');

document.getElementById('btn-signup').addEventListener('click', () => {
    auth.createUserWithEmailAndPassword(authEmail.value, authPassword.value)
        .catch(err => authError.textContent = err.message);
});

authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    auth.signInWithEmailAndPassword(authEmail.value, authPassword.value)
        .catch(err => authError.textContent = err.message);
});

document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        authContainer.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loadUserData();
    } else {
        authContainer.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
});

// --- CARICAMENTO DATI ---
function loadUserData() {
    if (!currentUser) return;

    db.collection('users').doc(currentUser.uid).collection('subjects')
        .onSnapshot(snapshot => {
            subjectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderSubjectFolders();
            renderDashboard();
            if (currentSubjectId) {
                renderSubjectDetailView(); // aggiorna la vista se hai una cartella aperta
            }
        });

    db.collection('users').doc(currentUser.uid).collection('tasks')
        .onSnapshot(snapshot => {
            tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAgenda();
        });
}

// --- CREA MATERIA ---
document.getElementById('add-subject-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('subject-name').value;
    db.collection('users').doc(currentUser.uid).collection('subjects').add({ name, grades: [] });
    document.getElementById('subject-name').value = '';
});

// --- AGGIUNGI VOTO NELLA CARTELLA APERTA ---
document.getElementById('add-grade-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentSubjectId) return;

    const category = document.getElementById('grade-category').value.trim() || 'Generale';
    const value = parseFloat(document.getElementById('grade-value').value);
    const weight = parseFloat(document.getElementById('grade-weight').value);

    const subject = subjectsData.find(s => s.id === currentSubjectId);
    if (subject) {
        const updatedGrades = [...(subject.grades || []), { value, category, weight, id: Date.now().toString() }];
        db.collection('users').doc(currentUser.uid).collection('subjects').doc(currentSubjectId).update({
            grades: updatedGrades
        });
    }
    document.getElementById('grade-value').value = '';
});

function calculateSubjectAverage(grades) {
    if (!grades || grades.length === 0) return 0;
    let totalWeight = 0;
    let weightedSum = 0;
    grades.forEach(g => {
        weightedSum += g.value * (g.weight / 100);
        totalWeight += (g.weight / 100);
    });
    return totalWeight === 0 ? 0 : (weightedSum / totalWeight).toFixed(2);
}

// --- RENDERIZZA LA GRIGLIA DELLE CARTELLE (MATERIE) ---
function renderSubjectFolders() {
    const grid = document.getElementById('subject-folders-grid');
    grid.innerHTML = '';

    if (subjectsData.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); grid-column: 1/-1;">Nessuna cartella materia creata. Creane una qui sopra!</p>';
        return;
    }

    subjectsData.forEach(sub => {
        const avg = calculateSubjectAverage(sub.grades);
        const card = document.createElement('div');
        card.className = 'folder-card';
        card.onclick = () => openSubjectFolder(sub.id);
        card.innerHTML = `
            <div class="folder-icon">📂</div>
            <h4>${sub.name}</h4>
            <div class="folder-avg">Media: ${avg > 0 ? avg : 'N/D'}</div>
        `;
        grid.appendChild(card);
    });
}

// --- APRI UNA SPECIFICA CARTELLA MATERIA ---
function openSubjectFolder(subjectId) {
    currentSubjectId = subjectId;
    document.getElementById('folders-main-view').classList.add('hidden');
    document.getElementById('subject-detail-view').classList.remove('hidden');
    renderSubjectDetailView();
}

// --- CHIUDI LA CARTELLA E TORNA ALLA LISTA ---
function closeSubjectFolder() {
    currentSubjectId = null;
    document.getElementById('subject-detail-view').classList.add('hidden');
    document.getElementById('folders-main-view').classList.remove('hidden');
}

// --- RENDERIZZA IL CONTENUTO DELLA CARTELLA APERTA ---
function renderSubjectDetailView() {
    if (!currentSubjectId) return;
    const sub = subjectsData.find(s => s.id === currentSubjectId);
    if (!sub) return;

    const avg = calculateSubjectAverage(sub.grades);
    document.getElementById('binder-title').textContent = `📂 ${sub.name}`;
    document.getElementById('binder-average').textContent = `Media: ${avg > 0 ? avg : 'N/D'}`;

    // Raggruppa i voti per categoria
    const categories = {};
    (sub.grades || []).forEach(g => {
        const catName = g.category || 'Generale';
        if (!categories[catName]) categories[catName] = [];
        categories[catName].push(g);
    });

    const catListContainer = document.getElementById('binder-categories-list');
    catListContainer.innerHTML = '';

    if (Object.keys(categories).length === 0) {
        catListContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Nessun voto in questa cartella.</p>';
        return;
    }

    for (const [catName, gradesList] of Object.entries(categories)) {
        const box = document.createElement('div');
        box.className = 'binder-category-box';
        box.innerHTML = `
            <div class="binder-category-title">📁 ${catName}</div>
            <div>
                ${gradesList.map(g => `
                    <span class="grade-chip">
                        <span class="grade-val">${g.value}</span>
                        <span class="grade-w">(${g.weight}%)</span>
                    </span>
                `).join('')}
            </div>
        `;
        catListContainer.appendChild(box);
    }
}

function renderDashboard() {
    const summaryList = document.getElementById('subjects-summary-list');
    const overallAvgElem = document.getElementById('overall-average');
    summaryList.innerHTML = '';

    let totalAvgSum = 0;
    let count = 0;

    subjectsData.forEach(sub => {
        const avg = parseFloat(calculateSubjectAverage(sub.grades));
        if (avg > 0) {
            totalAvgSum += avg;
            count++;
        }

        const badge = document.createElement('div');
        badge.className = `subject-badge ${avg >= 6 ? 'good' : (avg > 0 ? 'bad' : '')}`;
        badge.innerHTML = `
            <h4 style="margin-bottom: 5px; font-size:1.1rem;">${sub.name}</h4>
            <p style="font-size: 1.5rem; font-weight: 800; margin-bottom: 5px; color:var(--accent);">${avg > 0 ? avg : 'N/D'}</p>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${avg >= 6 ? '🟢 Ottimo lavoro!' : (avg > 0 ? '🔴 Attenzione, sotto il 6' : '⚪ Nessun voto')}</p>
        `;
        summaryList.appendChild(badge);
    });

    overallAvgElem.textContent = count > 0 ? (totalAvgSum / count).toFixed(2) : '--';
}

// --- TIMER POMODORO ---
let timerInterval = null;
let timeLeft = 25 * 60;
let isStudying = true;

const timerDisplay = document.getElementById('timer-display');
const timerStatus = document.getElementById('timer-status');

function updateTimerDisplay() {
    const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const sec = (timeLeft % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${min}:${sec}`;
}

document.getElementById('btn-start-timer').addEventListener('click', () => {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            alert(isStudying ? "🎉 Sessione terminata! Ora prenditi una pausa." : "🔔 Pausa finita! Si torna a concentrarsi.");
            isStudying = !isStudying;
            const studyTime = parseInt(document.getElementById('study-time').value) || 25;
            const restTime = parseInt(document.getElementById('rest-time').value) || 5;
            timeLeft = (isStudying ? studyTime : restTime) * 60;
            timerStatus.textContent = isStudying ? "Focus Studio 🧠" : "Pausa Relax ☕";
            updateTimerDisplay();
        }
    }, 1000);
});

document.getElementById('btn-pause-timer').addEventListener('click', () => {
    clearInterval(timerInterval);
    timerInterval = null;
});

document.getElementById('btn-reset-timer').addEventListener('click', () => {
    clearInterval(timerInterval);
    timerInterval = null;
    isStudying = true;
    const studyTime = parseInt(document.getElementById('study-time').value) || 25;
    timeLeft = studyTime * 60;
    timerStatus.textContent = "Pronto per lo sprint di studio? 🧠";
    updateTimerDisplay();
});

// --- AGENDA SETTIMANALE ---
document.getElementById('add-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('task-desc').value;
    const day = document.getElementById('task-day').value;

    db.collection('users').doc(currentUser.uid).collection('tasks').add({ desc, day });
    document.getElementById('task-desc').value = '';
});

function renderAgenda() {
    const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const container = document.getElementById('weekly-schedule');
    container.innerHTML = '';

    days.forEach(day => {
        const col = document.createElement('div');
        col.className = 'day-column';
        const dayTasks = tasksData.filter(t => t.day === day);

        col.innerHTML = `
            <h4>${day}</h4>
            ${dayTasks.map(t => `<div class="task-item">📌 ${t.desc}</div>`).join('') || '<p style="color:var(--text-muted); font-size:0.85rem;">Libero!</p>'}
        `;
        container.appendChild(col);
    });
}

// --- TABS SWITCHER ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}