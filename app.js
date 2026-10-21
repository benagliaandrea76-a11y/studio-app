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

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// STATO DELLO STUDENT APP
let currentUser = null;
let subjectsData = [];
let tasksData = [];

// --- GESTIONE AUTENTICAZIONE ---
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

// --- CARICAMENTO DATI DA FIRESTORE ---
function loadUserData() {
    if (!currentUser) return;

    // Carica Materie e Voti
    db.collection('users').doc(currentUser.uid).collection('subjects')
        .onSnapshot(snapshot => {
            subjectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderSubjectsAndGrades();
            renderDashboard();
        });

    // Carica Promemoria Agenda
    db.collection('users').doc(currentUser.uid).collection('tasks')
        .onSnapshot(snapshot => {
            tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAgenda();
        });
}

// --- GESTIONE MATERIE E VOTI ---
document.getElementById('add-subject-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('subject-name').value;
    db.collection('users').doc(currentUser.uid).collection('subjects').add({
        name: name,
        grades: []
    });
    document.getElementById('subject-name').value = '';
});

document.getElementById('add-grade-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('grade-subject-select').value;
    const value = parseFloat(document.getElementById('grade-value').value);
    const weight = parseFloat(document.getElementById('grade-weight').value);

    const subject = subjectsData.find(s => s.id === subjectId);
    if (subject) {
        const updatedGrades = [...(subject.grades || []), { value, weight, id: Date.now().toString() }];
        db.collection('users').doc(currentUser.uid).collection('subjects').doc(subjectId).update({
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

function renderSubjectsAndGrades() {
    const select = document.getElementById('grade-subject-select');
    const detailedList = document.getElementById('subjects-detailed-list');
    
    select.innerHTML = '<option value="">Seleziona Materia</option>';
    detailedList.innerHTML = '';

    subjectsData.forEach(sub => {
        const avg = calculateSubjectAverage(sub.grades);
        
        // Popola select
        const option = document.createElement('option');
        option.value = sub.id;
        option.textContent = sub.name;
        select.appendChild(option);

        // Popola vista dettagliata
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>${sub.name} (Media Ponderata: <strong>${avg}</strong>)</h3>
            <div style="margin-top:10px;">
                <strong>Voti:</strong>
                ${(sub.grades || []).map(g => `<span style="background:#eee; padding:3px 8px; margin:2px; border-radius:4px; display:inline-block;">${g.value} <small>(${g.weight}%)</small></span>`).join('')}
            </div>
        `;
        detailedList.appendChild(card);
    });
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
        badge.className = `subject-badge ${avg >= 6 ? 'grade-sufficient' : 'grade-insufficient'}`;
        badge.innerHTML = `
            <h4>${sub.name}</h4>
            <p>Media: <strong>${avg > 0 ? avg : 'N/D'}</strong></p>
            <p>Stato: ${avg >= 6 ? '🟢 In Regola' : (avg > 0 ? '🔴 Da Recuperare' : '⚪ Senza Voti')}</p>
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
            alert(isStudying ? "Tempo di studio finito! Ora riposati." : "Pausa finita! Si torna a studiare.");
            isStudying = !isStudying;
            const studyTime = parseInt(document.getElementById('study-time').value) || 25;
            const restTime = parseInt(document.getElementById('rest-time').value) || 5;
            timeLeft = (isStudying ? studyTime : restTime) * 60;
            timerStatus.textContent = isStudying ? "Sessione di Studio" : "Sessione di Riposo";
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
    timerStatus.textContent = "Pronto per studiare?";
    updateTimerDisplay();
});

// --- AGENDA E CALENDARIO ---
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
            ${dayTasks.map(t => `<div class="task-item">📌 ${t.desc}</div>`).join('') || '<p style="color:#aaa; font-size:0.8rem;">Nessun impegno</p>'}
        `;
        container.appendChild(col);
    });
}

// --- TAB SWITCHER ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}