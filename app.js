const firebaseConfig = {
    apiKey: "LA_TUA_API_KEY",
    authDomain: "TUO-PROGETTO.firebaseapp.com",
    projectId: "TUO-PROGETTO",
    storageBucket: "TUO-PROGETTO.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let subjectsData = [];
let tasksData = [];
let activeBinderId = null;

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

function loadUserData() {
    if (!currentUser) return;

    db.collection('users').doc(currentUser.uid).collection('subjects')
        .onSnapshot(snapshot => {
            subjectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderBindersGrid();
            renderDashboard();
            if (activeBinderId) renderOpenBinderView();
        });

    db.collection('users').doc(currentUser.uid).collection('tasks')
        .onSnapshot(snapshot => {
            tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAgenda();
        });
}

document.getElementById('add-subject-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('subject-name').value;
    db.collection('users').doc(currentUser.uid).collection('subjects').add({ name, grades: [] });
    document.getElementById('subject-name').value = '';
});

document.getElementById('add-grade-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeBinderId) return;

    const category = document.getElementById('grade-category').value.trim() || 'Generale';
    const value = parseFloat(document.getElementById('grade-value').value);
    const weight = parseFloat(document.getElementById('grade-weight').value);

    const sub = subjectsData.find(s => s.id === activeBinderId);
    if (sub) {
        const updatedGrades = [...(sub.grades || []), { value, category, weight, id: Date.now().toString() }];
        db.collection('users').doc(currentUser.uid).collection('subjects').doc(activeBinderId).update({
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

// Renderizza la griglia delle cartelle raccoglitore
function renderBindersGrid() {
    const grid = document.getElementById('binders-grid');
    grid.innerHTML = '';

    if (subjectsData.length === 0) {
        grid.innerHTML = '<p style="color:var(--muted); grid-column: 1/-1;">Nessun raccoglitore creato. Creane uno qui sopra!</p>';
        return;
    }

    subjectsData.forEach(sub => {
        const avg = calculateSubjectAverage(sub.grades);
        const card = document.createElement('div');
        card.className = 'binder-folder-card';
        card.onclick = () => openBinder(sub.id);
        card.innerHTML = `
            <div class="binder-icon">📁</div>
            <h4>${sub.name}</h4>
            <div class="binder-card-avg">Media: ${avg > 0 ? avg : 'N/D'}</div>
        `;
        grid.appendChild(card);
    });
}

function openBinder(subjectId) {
    activeBinderId = subjectId;
    document.getElementById('binders-main-view').classList.add('hidden');
    document.getElementById('binder-open-view').classList.remove('hidden');
    renderOpenBinderView();
}

function closeBinder() {
    activeBinderId = null;
    document.getElementById('binder-open-view').classList.add('hidden');
    document.getElementById('binders-main-view').classList.remove('hidden');
}

function renderOpenBinderView() {
    if (!activeBinderId) return;
    const sub = subjectsData.find(s => s.id === activeBinderId);
    if (!sub) return;

    const avg = calculateSubjectAverage(sub.grades);
    document.getElementById('open-binder-title').textContent = `📁 Raccoglitore: ${sub.name}`;
    document.getElementById('open-binder-avg').textContent = `Media: ${avg > 0 ? avg : 'N/D'}`;

    // Raggruppa i voti per categoria dentro la materia
    const categories = {};
    (sub.grades || []).forEach(g => {
        const cat = g.category || 'Generale';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(g);
    });

    const container = document.getElementById('binder-categories-container');
    container.innerHTML = '';

    if (Object.keys(categories).length === 0) {
        container.innerHTML = '<p style="color:var(--muted); font-size:0.9rem;">Nessun voto inserito in questo raccoglitore.</p>';
        return;
    }

    for (const [catName, list] of Object.entries(categories)) {
        const box = document.createElement('div');
        box.className = 'category-folder-box';
        box.innerHTML = `
            <div class="category-folder-title">📂 Categoria: ${catName}</div>
            <div>
                ${list.map(g => `
                    <span class="grade-pill">
                        <strong>${g.value}</strong>&nbsp;<span style="color:var(--muted);">(${g.weight}%)</span>
                    </span>
                `).join('')}
            </div>
        `;
        container.appendChild(box);
    }
}

function renderDashboard() {
    const list = document.getElementById('subjects-summary-list');
    const heroAvg = document.getElementById('overall-average');
    list.innerHTML = '';

    let sum = 0, count = 0;
    subjectsData.forEach(sub => {
        const avg = parseFloat(calculateSubjectAverage(sub.grades));
        if (avg > 0) { sum += avg; count++; }

        const box = document.createElement('div');
        box.className = 'subject-summary-box';
        box.innerHTML = `
            <h4 style="margin-bottom:4px;">${sub.name}</h4>
            <p style="font-size:1.3rem; font-weight:800; color:#38bdf8;">${avg > 0 ? avg : 'N/D'}</p>
        `;
        list.appendChild(box);
    });

    heroAvg.textContent = count > 0 ? (sum / count).toFixed(2) : '--';
}

// Timer Pomodoro
let timerInterval = null, timeLeft = 25 * 60, isStudying = true;
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
            alert(isStudying ? "Tempo di studio finito! Pausa." : "Pausa finita! Al lavoro.");
            isStudying = !isStudying;
            timeLeft = (isStudying ? parseInt(document.getElementById('study-time').value) : parseInt(document.getElementById('rest-time').value)) * 60;
            updateTimerDisplay();
        }
    }, 1000);
});
document.getElementById('btn-pause-timer').addEventListener('click', () => { clearInterval(timerInterval); timerInterval = null; });
document.getElementById('btn-reset-timer').addEventListener('click', () => { clearInterval(timerInterval); timerInterval = null; timeLeft = parseInt(document.getElementById('study-time').value) * 60; updateTimerDisplay(); });

// Agenda
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
        const tasks = tasksData.filter(t => t.day === day);
        col.innerHTML = `<h4>${day}</h4>${tasks.map(t => `<div class="task-box">📌 ${t.desc}</div>`).join('') || '<p style="color:var(--muted); font-size:0.8rem;">Libero</p>'}`;
        container.appendChild(col);
    });
}

function switchTab(id) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}