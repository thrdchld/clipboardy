import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp, collection, query, where, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 🔧 KONFIGURASI FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAIkIoF6iT4LfUbt0C03053vfyDpm3YsuA",
    authDomain: "my-clipboardy.firebaseapp.com",
    projectId: "my-clipboardy",
    storageBucket: "my-clipboardy.firebasestorage.app",
    messagingSenderId: "302329908136",
    appId: "1:302329908136:web:32f057d0e82a136c91eb9d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 💾 STATE MANAGEMENT
// ==========================================
let currentUser = null;
let currentRoomHash = null;

let folders = [{ id: 'default', name: 'General' }];
let currentFolderId = 'default';
let notesArray = []; 

let unsubscribeNotes = null;
let unsubscribeFolders = null;

let isAppLocked = true;
let viewMode = 'active'; // 'active' atau 'archived'
let searchQuery = '';
let ignoreBlur = false;

let autoLockTimer = null;
let strictLockEnabled = localStorage.getItem('strictLockEnabled') !== 'false';
let idleLockEnabled = localStorage.getItem('idleLockEnabled') === 'true';
let idleLockMinutes = parseInt(localStorage.getItem('idleLockMinutes')) || 5;

const saveTimeouts = new Map(); // Debounce map per note ID

// DOM Elements
const DOM = {
    authScreen: document.getElementById('authScreen'),
    appScreen: document.getElementById('appScreen'),
    passwordInput: document.getElementById('passwordInput'),
    loginBtn: document.getElementById('loginBtn'),
    
    sidebar: document.querySelector('.sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    btnMobileMenu: document.getElementById('btnMobileMenu'),
    
    strictLockToggle: document.getElementById('strictLockToggle'),
    idleLockToggle: document.getElementById('idleLockToggle'),
    idleTimeoutSelect: document.getElementById('idleTimeoutSelect'),
    idleTimeoutContainer: document.getElementById('idleTimeoutContainer'),
    
    clipGrid: document.getElementById('clipGrid'),
    emptyState: document.getElementById('emptyState'),
    
    folderList: document.getElementById('folderList'),
    btnAddFolder: document.getElementById('btnAddFolder'),
    
    btnAddNote: document.getElementById('btnAddNote'),
    btnAddNoteMobile: document.getElementById('btnAddNoteMobile'),
    btnLock: document.getElementById('btnLock'),
    btnToggleView: document.getElementById('btnToggleView'),
    btnToggleTrash: document.getElementById('btnToggleTrash'),
    btnToggleTrashText: document.getElementById('btnToggleTrashText'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    syncIndicator: document.getElementById('syncIndicator'),
    
    toast: document.getElementById('toast'),
    
    folderModal: document.getElementById('folderModal'),
    folderNameInput: document.getElementById('folderNameInput'),
    btnCancelFolder: document.getElementById('btnCancelFolder'),
    btnSaveFolder: document.getElementById('btnSaveFolder'),
    
    lightboxModal: document.getElementById('lightboxModal'),
    lightboxImage: document.getElementById('lightboxImage'),
    closeLightbox: document.getElementById('closeLightbox'),
    btnDownloadLightbox: document.getElementById('btnDownloadLightbox'),
    btnToggleViewText: document.getElementById('btnToggleViewText')
};

// Initialize settings state in DOM
DOM.strictLockToggle.checked = strictLockEnabled;
DOM.idleLockToggle.checked = idleLockEnabled;
DOM.idleTimeoutSelect.value = idleLockMinutes.toString();
updateIdleTimeoutVisibility();

function updateIdleTimeoutVisibility() {
    if (idleLockEnabled) {
        DOM.idleTimeoutContainer.style.display = 'flex';
    } else {
        DOM.idleTimeoutContainer.style.display = 'none';
    }
}

// ==========================================
// 🔒 AUTH & AUTO-LOCK
// ==========================================
signInAnonymously(auth).catch(err => alert("Connection failed: " + err.message));
onAuthStateChanged(auth, user => currentUser = user);

async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Activity based auto-lock
function resetAutoLockTimer() {
    if (isAppLocked) return;
    clearTimeout(autoLockTimer);
    if (!idleLockEnabled) return;
    const timeoutMs = idleLockMinutes * 60 * 1000;
    autoLockTimer = setTimeout(lockApp, timeoutMs);
}

['mousemove', 'keydown', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, resetAutoLockTimer);
});

// Instant strict lock
function checkStrictLock() {
    if (ignoreBlur) return;
    if (!isAppLocked && strictLockEnabled) {
        lockApp();
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) checkStrictLock();
});
window.addEventListener("pagehide", checkStrictLock);

// Helper safe confirm dialog to avoid blur auto-lock
function safeConfirm(message) {
    ignoreBlur = true;
    const result = confirm(message);
    setTimeout(() => {
        ignoreBlur = false;
    }, 300);
    return result;
}

// Reset ignoreBlur when window gains focus back
window.addEventListener("focus", () => {
    if (ignoreBlur) {
        setTimeout(() => {
            ignoreBlur = false;
        }, 300);
    }
});

function lockApp() {
    if (isAppLocked) return;
    isAppLocked = true;
    clearTimeout(autoLockTimer);
    
    DOM.appScreen.classList.add('app-blur');
    
    // Bersihkan memori paksa
    currentRoomHash = null;
    notesArray = [];
    folders = [{ id: 'default', name: 'General' }];
    currentFolderId = 'default';
    
    if (unsubscribeNotes) { unsubscribeNotes(); unsubscribeNotes = null; }
    if (unsubscribeFolders) { unsubscribeFolders(); unsubscribeFolders = null; }
    
    DOM.clipGrid.innerHTML = ''; 
    DOM.lightboxModal.classList.add('hidden');
    DOM.lightboxImage.src = '';
    
    setTimeout(() => {
        DOM.appScreen.classList.add('hidden');
        DOM.appScreen.classList.remove('app-blur');
        DOM.authScreen.classList.remove('hidden');
        DOM.passwordInput.value = '';
    }, 100);
    
    showToast("Application locked");
    closeMobileSidebar();
}

async function login() {
    const pwd = DOM.passwordInput.value.trim();
    if (!pwd) return;
    if (!currentUser) return showToast("Waiting for server connection...");

    DOM.loginBtn.textContent = "Unlocking...";
    DOM.loginBtn.disabled = true;

    try {
        currentRoomHash = await hashPassword(pwd);
        
        await ensureRoomMetadata();
        
        startFoldersSync();
        startNotesSync();
        
        isAppLocked = false;
        DOM.authScreen.classList.add('hidden');
        DOM.appScreen.classList.remove('hidden');
        DOM.passwordInput.value = ''; 
        
        resetAutoLockTimer();
        
    } catch (err) {
        console.error(err);
        showToast("An error occurred.");
    } finally {
        DOM.loginBtn.textContent = "Unlock Room";
        DOM.loginBtn.disabled = false;
    }
}

// ==========================================
// 📱 SIDEBAR LOGIC (MOBILE & DESKTOP)
// ==========================================
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        DOM.sidebar.classList.add('open');
        DOM.sidebarBackdrop.classList.remove('hidden');
    } else {
        DOM.sidebar.classList.remove('collapsed');
    }
}

function closeMobileSidebar() {
    if (window.innerWidth <= 768) {
        DOM.sidebar.classList.remove('open');
        DOM.sidebarBackdrop.classList.add('hidden');
    }
}

DOM.btnMobileMenu.addEventListener('click', toggleSidebar);
DOM.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
document.getElementById('btnSidebarCollapse').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        closeMobileSidebar();
    } else {
        DOM.sidebar.classList.add('collapsed');
    }
});

// ==========================================
// 📡 DATABASE SYNC
// ==========================================

async function ensureRoomMetadata() {
    const roomRef = doc(db, 'clipboards', currentRoomHash);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
        await setDoc(roomRef, {
            folders: [{ id: 'default', name: 'General' }],
            createdAt: serverTimestamp()
        });
    }
}

function startFoldersSync() {
    const roomRef = doc(db, 'clipboards', currentRoomHash);
    unsubscribeFolders = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().folders) {
            folders = docSnap.data().folders;
            if (!folders.find(f => f.id === currentFolderId)) {
                currentFolderId = folders[0] ? folders[0].id : 'default';
            }
            renderFolders();
        }
    });
}

function startNotesSync() {
    if (unsubscribeNotes) unsubscribeNotes();
    
    const notesRef = collection(db, 'clipboards', currentRoomHash, 'notes');
    const q = query(notesRef, where('folderId', '==', currentFolderId));
    
    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        notesArray = [];
        snapshot.forEach(docSnap => {
            notesArray.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        DOM.syncIndicator.classList.remove('saving');
        renderGrid();
    }, (error) => {
        console.error("Sync Error", error);
        showToast("Disconnected from note sync");
    });
}

function updateViewArchiveUI() {
    if (viewMode === 'archived') {
        DOM.btnToggleViewText.textContent = "Back to Active";
        DOM.btnToggleView.classList.add('active');
    } else {
        DOM.btnToggleViewText.textContent = "View Archive";
        DOM.btnToggleView.classList.remove('active');
    }
    renderFolders();
}

async function cleanupExpiredFolders() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let updatedFolders = [...folders];
    let changed = false;
    updatedFolders = updatedFolders.filter(f => {
        if (f.deleted && f.deletedAt && f.deletedAt < thirtyDaysAgo) {
            changed = true;
            return false;
        }
        return true;
    });
    if (changed) {
        folders = updatedFolders;
        try {
            const roomRef = doc(db, 'clipboards', currentRoomHash);
            await setDoc(roomRef, { folders }, { merge: true });
        } catch (err) {
            console.error("Failed to clean up expired folders", err);
        }
    }
}

function startFoldersSync() {
    const roomRef = doc(db, 'clipboards', currentRoomHash);
    unsubscribeFolders = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().folders) {
            folders = docSnap.data().folders;
            cleanupExpiredFolders();
            
            const activeFolders = folders.filter(f => !f.deleted);
            if (!activeFolders.find(f => f.id === currentFolderId)) {
                currentFolderId = activeFolders[0] ? activeFolders[0].id : 'default';
            }
            renderFolders();
        }
    });
}

async function cleanupExpiredNotes() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const expiredNotes = notesArray.filter(n => n.deleted && n.deletedAt && n.deletedAt < thirtyDaysAgo);
    for (const note of expiredNotes) {
        const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
        try {
            await deleteDoc(noteRef);
        } catch (err) {
            console.error("Failed to delete expired note", note.id, err);
        }
    }
}

function startNotesSync() {
    if (unsubscribeNotes) unsubscribeNotes();
    
    const notesRef = collection(db, 'clipboards', currentRoomHash, 'notes');
    const q = query(notesRef);
    
    unsubscribeNotes = onSnapshot(q, (snapshot) => {
        notesArray = [];
        snapshot.forEach(docSnap => {
            notesArray.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        cleanupExpiredNotes();
        DOM.syncIndicator.classList.remove('saving');
        renderGrid();
    }, (error) => {
        console.error("Sync Error", error);
        showToast("Disconnected from note sync");
    });
}

function updateViewArchiveUI() {
    DOM.btnToggleView.classList.remove('active');
    if (DOM.btnToggleTrash) DOM.btnToggleTrash.classList.remove('active');
    
    if (viewMode === 'archived') {
        DOM.btnToggleViewText.textContent = "Back to Active";
        DOM.btnToggleView.classList.add('active');
    } else if (viewMode === 'trash') {
        DOM.btnToggleViewText.textContent = "View Archive";
        if (DOM.btnToggleTrash) {
            DOM.btnToggleTrashText.textContent = "Back to Active";
            DOM.btnToggleTrash.classList.add('active');
        }
    } else {
        DOM.btnToggleViewText.textContent = "View Archive";
        if (DOM.btnToggleTrash) {
            DOM.btnToggleTrashText.textContent = "Trash";
        }
    }
    renderFolders();
}

function switchFolder(folderId) {
    currentFolderId = folderId;
    viewMode = 'active';
    updateViewArchiveUI();
    renderGrid();
    closeMobileSidebar(); // Auto-close on mobile when folder selected
}

async function forceSaveNoteToServer(note) {
    if (isAppLocked || !currentRoomHash) return;
    DOM.syncIndicator.classList.add('saving');
    
    const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
    try {
        await setDoc(noteRef, {
            ...note,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (err) {
        console.error(err);
        showToast("Failed to save note");
    }
}

function triggerNoteAutoSave(note) {
    DOM.syncIndicator.classList.add('saving');
    if (saveTimeouts.has(note.id)) {
        clearTimeout(saveTimeouts.get(note.id));
    }
    const timeout = setTimeout(() => {
        forceSaveNoteToServer(note);
    }, 1000);
    saveTimeouts.set(note.id, timeout);
}

// ==========================================
// 🎨 UI RENDERING - FOLDERS
// ==========================================
function renderFolders() {
    DOM.folderList.innerHTML = '';
    folders.forEach(f => {
        if (f.deleted) return;
        
        const li = document.createElement('li');
        li.className = `folder-item ${f.id === currentFolderId && viewMode === 'active' ? 'active' : ''}`;
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `Folder ${f.name}`);
        
        const folderNameWrapper = document.createElement('div');
        folderNameWrapper.style.display = 'flex';
        folderNameWrapper.style.alignItems = 'center';
        folderNameWrapper.style.gap = '8px';
        
        const folderIcon = document.createElement('span');
        folderIcon.className = 'folder-icon-wrapper';
        folderIcon.style.display = 'inline-flex';
        folderIcon.style.alignItems = 'center';
        folderIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
        folderNameWrapper.appendChild(folderIcon);
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = f.name;
        folderNameWrapper.appendChild(nameSpan);
        li.appendChild(folderNameWrapper);
        
        if (f.id !== 'default') {
            const actions = document.createElement('div');
            actions.className = 'folder-actions';
            const btnDel = document.createElement('button');
            btnDel.className = 'btn-delete-folder';
            btnDel.setAttribute('title', 'Delete Folder');
            btnDel.setAttribute('aria-label', `Delete Folder ${f.name}`);
            btnDel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
            btnDel.onclick = (e) => {
                e.stopPropagation();
                deleteFolder(f.id);
            };
            actions.appendChild(btnDel);
            li.appendChild(actions);
        }
        
        li.onclick = () => switchFolder(f.id);
        li.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchFolder(f.id);
            }
        };
        DOM.folderList.appendChild(li);
    });
}

async function saveNewFolder() {
    const name = DOM.folderNameInput.value.trim();
    if (!name) return;
    
    const newFolder = {
        id: 'f_' + Date.now().toString(36),
        name: name
    };
    
    folders.push(newFolder);
    DOM.folderModal.classList.add('hidden');
    DOM.folderNameInput.value = '';
    
    try {
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { folders }, { merge: true });
        switchFolder(newFolder.id);
    } catch(err) {
        showToast("Failed to create folder");
    }
}

async function deleteFolder(folderId) {
    if (!safeConfirm("Move this folder to Trash? Notes inside it will also be archived and moved to Trash.")) return;
    
    folders = folders.map(f => f.id === folderId ? { ...f, deleted: true, deletedAt: Date.now() } : f);
    try {
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { folders }, { merge: true });
        
        // Also soft-delete all notes in this folder
        const notesInFolder = notesArray.filter(n => n.folderId === folderId);
        for (const note of notesInFolder) {
            const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
            await setDoc(noteRef, {
                deleted: true,
                deletedAt: Date.now()
            }, { merge: true });
        }
        
        if (currentFolderId === folderId) switchFolder('default');
        showToast("Folder moved to Trash");
    } catch(err) {
        showToast("Failed to delete folder");
    }
}

// ==========================================
// 🎨 UI RENDERING - GRID & CARDS
// ==========================================
function countWordsAndChars(text) {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return `${words} words | ${chars} chars`;
}

function resizeTextarea(textarea) {
    textarea.style.height = 'auto';
    const limit = 220; // limit height to 220px to look neat like Google Keep
    if (textarea.scrollHeight > limit) {
        textarea.style.height = limit + 'px';
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.height = textarea.scrollHeight + 'px';
        textarea.style.overflowY = 'hidden';
    }
}

function renderGrid() {
    if (isAppLocked) return;
    DOM.clipGrid.innerHTML = "";
    
    if (viewMode === 'trash') {
        const trashFolders = folders.filter(f => f.deleted && f.name.toLowerCase().includes(searchQuery));
        const trashNotes = notesArray.filter(n => n.deleted && n.text.toLowerCase().includes(searchQuery));
        
        if (trashFolders.length === 0 && trashNotes.length === 0) {
            DOM.emptyState.classList.remove('hidden');
            DOM.emptyState.querySelector('h3').textContent = "Trash is empty";
            DOM.emptyState.querySelector('p').textContent = "Deleted notes and folders will appear here for 30 days.";
            return;
        } else {
            DOM.emptyState.classList.add('hidden');
        }
        
        trashFolders.forEach(f => {
            const card = document.createElement('div');
            card.className = 'card trash-card';
            
            const msRemaining = (f.deletedAt + 30 * 24 * 60 * 60 * 1000) - Date.now();
            const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-badges">
                        <span class="badge" style="background: var(--danger); color: white; display: inline-flex; align-items: center; gap: 4px;">
                            Folder
                        </span>
                        <span class="badge" style="display: inline-flex; align-items: center; gap: 4px;">
                            ${daysRemaining} days left
                        </span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin: 15px 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    <span style="font-weight: 700; font-size: 1.1em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.name}</span>
                </div>
                <div class="card-footer">
                    <div class="card-actions" style="justify-content: space-between; width: 100%;">
                        <button class="action-btn restore-folder-btn" style="display:inline-flex; align-items:center; gap:4px; font-weight: 600;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            Restore
                        </button>
                        <button class="action-btn del delete-folder-perm-btn" style="display:inline-flex; align-items:center; gap:4px;">
                            Delete Perm
                        </button>
                    </div>
                </div>
            `;
            
            card.querySelector('.restore-folder-btn').onclick = () => restoreFolder(f.id);
            card.querySelector('.delete-folder-perm-btn').onclick = () => deleteFolderPermanently(f.id);
            DOM.clipGrid.appendChild(card);
        });
        
        trashNotes.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card trash-card';
            
            const msRemaining = (item.deletedAt + 30 * 24 * 60 * 60 * 1000) - Date.now();
            const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
            
            const imageHtml = item.image ? `
                <div class="card-image-wrapper">
                    <img src="${item.image}" class="card-image" alt="Note Image">
                </div>
            ` : '';
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-badges">
                        <span class="badge" style="background: var(--warning); color: white; display: inline-flex; align-items: center; gap: 4px;">
                            Note
                        </span>
                        <span class="badge" style="display: inline-flex; align-items: center; gap: 4px;">
                            ${daysRemaining} days left
                        </span>
                    </div>
                </div>
                ${imageHtml}
                <textarea class="card-body" readonly aria-label="Note Content" style="opacity: 0.8; cursor: not-allowed;">${item.text}</textarea>
                <div class="card-footer">
                    <div class="card-actions" style="justify-content: space-between; width: 100%;">
                        <button class="action-btn restore-note-btn" style="display:inline-flex; align-items:center; gap:4px; font-weight: 600;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            Restore
                        </button>
                        <button class="action-btn del delete-note-perm-btn" style="display:inline-flex; align-items:center; gap:4px;">
                            Delete Perm
                        </button>
                    </div>
                </div>
            `;
            
            const textInput = card.querySelector('.card-body');
            setTimeout(() => resizeTextarea(textInput), 0);
            
            card.querySelector('.restore-note-btn').onclick = () => restoreNote(item.id);
            card.querySelector('.delete-note-perm-btn').onclick = () => deleteNotePermanently(item.id);
            DOM.clipGrid.appendChild(card);
        });
        
        return;
    }
    
    DOM.emptyState.querySelector('h3').textContent = "No notes yet";
    DOM.emptyState.querySelector('p').textContent = 'Click "+ New Note" to start writing in this folder.';
    
    let filtered = notesArray.filter(n => {
        const matchesFolder = n.folderId === currentFolderId;
        const matchesView = viewMode === 'archived' ? (n.archived && !n.deleted) : (!n.archived && !n.deleted);
        const matchesSearch = n.text.toLowerCase().includes(searchQuery);
        return matchesFolder && matchesView && matchesSearch;
    });

    filtered.sort((a, b) => {
        if (a.pinned === b.pinned) return (b.updatedAt || 0) - (a.updatedAt || 0);
        return a.pinned ? -1 : 1;
    });

    if (filtered.length === 0) {
        DOM.emptyState.classList.remove('hidden');
    } else {
        DOM.emptyState.classList.add('hidden');
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = `card ${item.pinned ? 'pinned' : ''}`;
        
        const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleString('en-US', {day:'numeric', month:'short', hour: '2-digit', minute:'2-digit'}) : 'New';

        const imageHtml = item.image ? `
            <div class="card-image-wrapper">
                <img src="${item.image}" class="card-image" alt="Note Image">
                <button class="btn-download-image" title="Download Image" aria-label="Download Image">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
                <button class="btn-remove-image" title="Delete Image" aria-label="Delete Image">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        ` : '';

        const downloadBtnHtml = '';

        const uploadBtnHtml = item.image ? '' : `
            <button class="action-btn upload-btn" title="Upload Image" aria-label="Upload Image" style="display:inline-flex; align-items:center; justify-content:center; padding: 6px 10px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </button>
            <input type="file" class="card-file-input" accept="image/*" style="display: none;" aria-label="Upload Image">
        `;

        let moveOptions = `<option value="" disabled selected>Move...</option>`;
        folders.forEach(f => {
            if (f.id !== currentFolderId) {
                moveOptions += `<option value="${f.id}">${f.name}</option>`;
            }
        });

        const moveSelectHtml = folders.length > 1 ? `
            <select class="badge move-select" title="Move Note" aria-label="Move Note" style="cursor: pointer; max-width: 95px; text-overflow: ellipsis;">
                ${moveOptions}
            </select>
        ` : '';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-badges">
                    <span class="badge pin-btn ${item.pinned ? 'active-pin' : ''}" role="button" tabindex="0" aria-label="${item.pinned ? 'Unpin Note' : 'Pin Note'}" style="display:inline-flex; align-items:center; gap:4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.89A.5.5 0 0 0 6.36 14h11.28a.5.5 0 0 0 .25-.56l-1.78-.89a2 2 0 0 1-1.11-1.79V4H9v6.76zM8 4h8M10 2h4"/></svg>
                        ${item.pinned ? 'Pinned' : 'Pin'}
                    </span>
                    <span class="badge arc-btn ${item.archived ? 'active-arc' : ''}" role="button" tabindex="0" aria-label="${item.archived ? 'Unarchive Note' : 'Archive Note'}" style="display:inline-flex; align-items:center; gap:4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                        ${item.archived ? 'Unarchived' : 'Archive'}
                    </span>
                    ${moveSelectHtml}
                </div>
            </div>
            ${imageHtml}
            <textarea class="card-body" placeholder="Type something..." aria-label="Note Content">${item.text}</textarea>
            <div class="card-footer">
                <div class="card-stats">
                    <span class="card-date">${dateStr}</span>
                    <span class="word-count">${countWordsAndChars(item.text)}</span>
                </div>
                <div class="card-actions">
                    ${uploadBtnHtml}
                    <button class="action-btn copy-btn" title="Copy Note" aria-label="Copy Note" style="display:inline-flex; align-items:center; gap:4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                    </button>
                    <button class="action-btn del del-btn" title="Delete Note" aria-label="Delete Note" style="display:inline-flex; align-items:center; gap:4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        const textInput = card.querySelector('.card-body');
        const wordCountDisplay = card.querySelector('.word-count');
        
        // Auto-resize on initial render
        setTimeout(() => resizeTextarea(textInput), 0);

        textInput.addEventListener('input', (e) => {
            item.text = e.target.value;
            item.updatedAt = Date.now();
            wordCountDisplay.textContent = countWordsAndChars(item.text);
            resizeTextarea(textInput);
            triggerNoteAutoSave(item);
        });

        textInput.addEventListener('paste', async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (!file) continue;

                    showToast("Compressing image from clipboard...");
                    
                    try {
                        const compressedBase64 = await compressImage(file, 256);
                        item.image = compressedBase64;
                        item.updatedAt = Date.now();
                        await forceSaveNoteToServer(item);
                        renderGrid();
                        showToast("Image from clipboard uploaded successfully!");
                    } catch (err) {
                        console.error(err);
                        showToast(err.message || "Failed to compress image from clipboard.");
                    }
                    break;
                }
            }
        });

        const pinBtn = card.querySelector('.pin-btn');
        const togglePin = () => {
            item.pinned = !item.pinned;
            item.updatedAt = Date.now();
            forceSaveNoteToServer(item);
            renderGrid();
        };
        pinBtn.addEventListener('click', togglePin);
        pinBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePin();
            }
        });

        const arcBtn = card.querySelector('.arc-btn');
        const toggleArc = () => {
            item.archived = !item.archived;
            if (item.archived) item.pinned = false; 
            item.updatedAt = Date.now();
            forceSaveNoteToServer(item);
            renderGrid();
        };
        arcBtn.addEventListener('click', toggleArc);
        arcBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleArc();
            }
        });

        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(textInput.value).then(() => {
                // Micro-animation
                const originalContent = copyBtn.innerHTML;
                copyBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Copied!
                `;
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = originalContent;
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
        });

        card.querySelector('.del-btn').addEventListener('click', async () => {
            if (safeConfirm("Move this note to Trash?")) {
                const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', item.id);
                try {
                    await setDoc(noteRef, {
                        deleted: true,
                        deletedAt: Date.now()
                    }, { merge: true });
                    showToast("Note moved to Trash");
                } catch(err) {
                    showToast("Failed to move note to Trash");
                }
            }
        });

        if (folders.length > 1) {
            card.querySelector('.move-select').addEventListener('change', async (e) => {
                const targetFolderId = e.target.value;
                if (targetFolderId) {
                    item.folderId = targetFolderId;
                    item.updatedAt = Date.now();
                    await forceSaveNoteToServer(item);
                    renderGrid();
                    showToast("Note moved!");
                }
            });
        }

        if (item.image) {
            // Lightbox viewer
            card.querySelector('.card-image').addEventListener('click', () => {
                DOM.lightboxImage.src = item.image;
                DOM.lightboxModal.classList.remove('hidden');
            });

            // Remove image
            card.querySelector('.btn-remove-image').addEventListener('click', (e) => {
                e.stopPropagation();
                if (safeConfirm("Delete the image from this note?")) {
                    item.image = null;
                    item.updatedAt = Date.now();
                    forceSaveNoteToServer(item);
                    renderGrid();
                }
            });

            // Download image overlay
            card.querySelector('.btn-download-image').addEventListener('click', (e) => {
                e.stopPropagation();
                downloadImage(item.image, `image-${item.id}`);
            });
        } else {
            // Upload handlers
            const uploadBtn = card.querySelector('.upload-btn');
            const fileInput = card.querySelector('.card-file-input');

            uploadBtn.addEventListener('click', () => {
                ignoreBlur = true;
                fileInput.click();
            });

            fileInput.addEventListener('cancel', () => {
                setTimeout(() => { ignoreBlur = false; }, 300);
            });

            fileInput.addEventListener('change', async (e) => {
                setTimeout(() => { ignoreBlur = false; }, 300);
                const file = e.target.files[0];
                if (!file) return;

                uploadBtn.innerHTML = `<svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`;
                uploadBtn.disabled = true;

                try {
                    const compressedBase64 = await compressImage(file, 256);
                    item.image = compressedBase64;
                    item.updatedAt = Date.now();
                    await forceSaveNoteToServer(item);
                    renderGrid();
                    showToast("Image uploaded successfully!");
                } catch (err) {
                    console.error(err);
                    showToast(err.message || "Failed to compress image.");
                    uploadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
                    uploadBtn.disabled = false;
                }
            });
        }

        DOM.clipGrid.appendChild(card);
    });
}

// ==========================================
// 🎮 GLOBAL EVENTS
// ==========================================
DOM.loginBtn.addEventListener('click', login);
DOM.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });
DOM.btnLock.addEventListener('click', lockApp);

const handleAddNote = async () => {
    if(viewMode === 'archived') {
        viewMode = 'active';
        updateViewArchiveUI();
    }
    
    const newNoteId = 'n_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newNote = {
        id: newNoteId,
        text: "",
        folderId: currentFolderId,
        pinned: false,
        archived: false,
        updatedAt: Date.now()
    };
    
    await forceSaveNoteToServer(newNote);
    
    setTimeout(() => {
        const firstInput = DOM.clipGrid.querySelector('.card-body');
        if (firstInput) {
            firstInput.focus();
            resizeTextarea(firstInput);
        }
    }, 100);
};

DOM.btnAddNote.addEventListener('click', handleAddNote);
if (DOM.btnAddNoteMobile) {
    DOM.btnAddNoteMobile.addEventListener('click', handleAddNote);
}

DOM.btnToggleView.addEventListener('click', () => {
    viewMode = viewMode === 'active' ? 'archived' : 'active';
    updateViewArchiveUI();
    renderGrid();
});

if (DOM.btnToggleTrash) {
    DOM.btnToggleTrash.addEventListener('click', () => {
        viewMode = viewMode === 'trash' ? 'active' : 'trash';
        updateViewArchiveUI();
        renderGrid();
    });
}

// Search and Clear Search
DOM.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    if (searchQuery.length > 0) {
        DOM.btnClearSearch.classList.remove('hidden');
    } else {
        DOM.btnClearSearch.classList.add('hidden');
    }
    renderGrid();
});

DOM.btnClearSearch.addEventListener('click', () => {
    DOM.searchInput.value = '';
    searchQuery = '';
    DOM.btnClearSearch.classList.add('hidden');
    renderGrid();
});

// Settings Event Handlers
DOM.strictLockToggle.addEventListener('change', () => {
    strictLockEnabled = DOM.strictLockToggle.checked;
    localStorage.setItem('strictLockEnabled', strictLockEnabled);
});

DOM.idleLockToggle.addEventListener('change', () => {
    idleLockEnabled = DOM.idleLockToggle.checked;
    localStorage.setItem('idleLockEnabled', idleLockEnabled);
    updateIdleTimeoutVisibility();
    resetAutoLockTimer();
});

DOM.idleTimeoutSelect.addEventListener('change', () => {
    idleLockMinutes = parseInt(DOM.idleTimeoutSelect.value) || 5;
    localStorage.setItem('idleLockMinutes', idleLockMinutes);
    resetAutoLockTimer();
});

// Modal Events
DOM.btnAddFolder.addEventListener('click', () => {
    DOM.folderModal.classList.remove('hidden');
    DOM.folderNameInput.focus();
});
DOM.btnCancelFolder.addEventListener('click', () => {
    DOM.folderModal.classList.add('hidden');
    DOM.folderNameInput.value = '';
});
DOM.btnSaveFolder.addEventListener('click', saveNewFolder);
DOM.folderNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveNewFolder(); });

// Lightbox Close Events
DOM.closeLightbox.addEventListener('click', () => {
    DOM.lightboxModal.classList.add('hidden');
    DOM.lightboxImage.src = '';
});
DOM.lightboxModal.addEventListener('click', (e) => {
    if (e.target === DOM.lightboxModal) {
        DOM.lightboxModal.classList.add('hidden');
        DOM.lightboxImage.src = '';
    }
});

// Lightbox Download Event
DOM.btnDownloadLightbox.addEventListener('click', () => {
    if (DOM.lightboxImage.src) {
        downloadImage(DOM.lightboxImage.src, `download-${Date.now()}`);
    }
});

// Utility
function downloadImage(base64Data, baseFilename = 'image') {
    ignoreBlur = true;
    const link = document.createElement('a');
    link.href = base64Data;
    
    // Deduce file extension
    let ext = 'jpg';
    const match = base64Data.match(/^data:image\/(\w+);base64,/);
    if (match && match[1]) {
        ext = match[1];
    }
    
    link.download = `${baseFilename}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
        ignoreBlur = false;
    }, 1000);
}

function showToast(msg) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}

// Image Compression Algorithm
function compressImage(file, maxSizeKB = 256) {
    return new Promise((resolve, reject) => {
        // Validate it's an image file
        if (!file.type.startsWith('image/')) {
            reject(new Error("The selected file is not an image."));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimensions to avoid large memory footprints
                const maxDim = 1200;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Initial high quality JPEG export
                let quality = 0.9;
                let base64 = canvas.toDataURL('image/jpeg', quality);
                
                // Calculate size in KB
                const getKBSize = (b64Str) => (b64Str.length * 0.75) / 1024;

                // Iterative quality reduction loop
                while (getKBSize(base64) > maxSizeKB && quality > 0.1) {
                    quality -= 0.1;
                    base64 = canvas.toDataURL('image/jpeg', quality);
                }

                // If quality reduction isn't enough, iteratively scale down the canvas resolution
                if (getKBSize(base64) > maxSizeKB) {
                    let scale = 0.75;
                    while (getKBSize(base64) > maxSizeKB && scale > 0.15) {
                        const newWidth = Math.round(width * scale);
                        const newHeight = Math.round(height * scale);
                        
                        canvas.width = newWidth;
                        canvas.height = newHeight;
                        ctx.drawImage(img, 0, 0, newWidth, newHeight);
                        
                        base64 = canvas.toDataURL('image/jpeg', 0.5); // Use a low quality setting for scaled dimensions
                        scale -= 0.15;
                    }
                }

                if (getKBSize(base64) > maxSizeKB) {
                    reject(new Error(`Image is too large. Maximum compression only succeeded in reducing size to ${Math.round(getKBSize(base64))} KB.`));
                } else {
                    resolve(base64);
                }
            };
            img.onerror = (err) => reject(new Error("Failed to load image for compression."));
        };
        reader.onerror = (err) => reject(new Error("Failed to read image file."));
    });
}

async function restoreFolder(folderId) {
    folders = folders.map(f => f.id === folderId ? { ...f, deleted: false, deletedAt: null } : f);
    try {
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { folders }, { merge: true });
        showToast("Folder restored");
        renderGrid();
    } catch(err) {
        showToast("Failed to restore folder");
    }
}

async function deleteFolderPermanently(folderId) {
    if (!safeConfirm("Permanently delete this folder and all notes inside it? This action cannot be undone.")) return;
    
    folders = folders.filter(f => f.id !== folderId);
    try {
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { folders }, { merge: true });
        
        const notesInFolder = notesArray.filter(n => n.folderId === folderId);
        for (const note of notesInFolder) {
            const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
            await deleteDoc(noteRef);
        }
        
        showToast("Folder and notes permanently deleted");
        renderGrid();
    } catch(err) {
        showToast("Failed to delete folder permanently");
    }
}

async function restoreNote(noteId) {
    const note = notesArray.find(n => n.id === noteId);
    if (!note) return;
    
    const parentFolder = folders.find(f => f.id === note.folderId);
    let targetFolderId = note.folderId;
    if (parentFolder && parentFolder.deleted) {
        targetFolderId = 'default';
        showToast("Note's original folder is deleted. Note restored to General folder.");
    }
    
    const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', noteId);
    try {
        await setDoc(noteRef, {
            deleted: false,
            deletedAt: null,
            folderId: targetFolderId,
            updatedAt: Date.now()
        }, { merge: true });
        showToast("Note restored");
    } catch(err) {
        showToast("Failed to restore note");
    }
}

async function deleteNotePermanently(noteId) {
    if (!safeConfirm("Permanently delete this note? This action cannot be undone.")) return;
    
    const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', noteId);
    try {
        await deleteDoc(noteRef);
        showToast("Note permanently deleted");
    } catch(err) {
        showToast("Failed to delete note");
    }
}

// Exports for unit testing
export { hashPassword, countWordsAndChars, login, lockApp, isAppLocked, currentUser, currentRoomHash, ignoreBlur, safeConfirm };
