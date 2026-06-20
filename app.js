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
const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 menit

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
    
    clipGrid: document.getElementById('clipGrid'),
    emptyState: document.getElementById('emptyState'),
    
    folderList: document.getElementById('folderList'),
    btnAddFolder: document.getElementById('btnAddFolder'),
    
    btnAddNote: document.getElementById('btnAddNote'),
    btnLock: document.getElementById('btnLock'),
    btnToggleView: document.getElementById('btnToggleView'),
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
    closeLightbox: document.getElementById('closeLightbox')
};

// ==========================================
// 🔒 AUTH & AUTO-LOCK
// ==========================================
signInAnonymously(auth).catch(err => alert("Gagal koneksi: " + err.message));
onAuthStateChanged(auth, user => currentUser = user);

async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Activity based auto-lock (5 mins)
function resetAutoLockTimer() {
    if (isAppLocked) return;
    if (DOM.strictLockToggle.checked) return; // Ignore timer if strict mode
    clearTimeout(autoLockTimer);
    autoLockTimer = setTimeout(lockApp, AUTO_LOCK_TIMEOUT);
}

['mousemove', 'keydown', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, resetAutoLockTimer);
});

// Instant strict lock
function checkStrictLock() {
    if (ignoreBlur) return;
    if (!isAppLocked && DOM.strictLockToggle.checked) {
        lockApp();
    }
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) checkStrictLock();
});
window.addEventListener("blur", checkStrictLock);
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
    
    showToast("🔒 Terkunci");
    closeMobileSidebar();
}

async function login() {
    const pwd = DOM.passwordInput.value.trim();
    if (!pwd) return;
    if (!currentUser) return showToast("Menunggu koneksi server...");

    DOM.loginBtn.textContent = "Membuka...";
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
        showToast("Terjadi kesalahan.");
    } finally {
        DOM.loginBtn.textContent = "Buka Ruangan";
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
        DOM.sidebar.classList.toggle('collapsed');
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
        showToast("Terputus dari sinkronisasi catatan");
    });
}

function switchFolder(folderId) {
    currentFolderId = folderId;
    renderFolders();
    startNotesSync();
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
        showToast("Gagal menyimpan catatan");
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
        const li = document.createElement('li');
        li.className = `folder-item ${f.id === currentFolderId ? 'active' : ''}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = f.name;
        li.appendChild(nameSpan);
        
        if (f.id !== 'default') {
            const actions = document.createElement('div');
            actions.className = 'folder-actions';
            const btnDel = document.createElement('button');
            btnDel.innerHTML = '🗑️';
            btnDel.onclick = (e) => {
                e.stopPropagation();
                deleteFolder(f.id);
            };
            actions.appendChild(btnDel);
            li.appendChild(actions);
        }
        
        li.onclick = () => switchFolder(f.id);
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
        showToast("Gagal membuat folder");
    }
}

async function deleteFolder(folderId) {
    if (!safeConfirm("Hapus folder ini? Catatan di dalamnya tidak terhapus otomatis dari server tapi akan hilang dari UI.")) return;
    
    folders = folders.filter(f => f.id !== folderId);
    try {
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { folders }, { merge: true });
        if (currentFolderId === folderId) switchFolder('default');
    } catch(err) {
        showToast("Gagal menghapus folder");
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
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

function renderGrid() {
    if (isAppLocked) return;
    DOM.clipGrid.innerHTML = "";
    
    let filtered = notesArray.filter(n => {
        const matchesView = viewMode === 'archived' ? n.archived : !n.archived;
        const matchesSearch = n.text.toLowerCase().includes(searchQuery);
        return matchesView && matchesSearch;
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
        
        const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleString('id-ID', {day:'numeric', month:'short', hour: '2-digit', minute:'2-digit'}) : 'Baru';

        const imageHtml = item.image ? `
            <div class="card-image-wrapper">
                <img src="${item.image}" class="card-image" alt="Catatan Gambar">
                <button class="btn-remove-image" title="Hapus Gambar">&times;</button>
            </div>
        ` : '';

        const uploadBtnHtml = item.image ? '' : `
            <button class="action-btn upload-btn" title="Unggah Gambar">🖼️</button>
            <input type="file" class="card-file-input" accept="image/*" style="display: none;">
            <button class="action-btn paste-img-btn" title="Tempel Gambar dari Clipboard Device">📋</button>
        `;

        let moveOptions = `<option value="" disabled selected>Pindahkan...</option>`;
        folders.forEach(f => {
            if (f.id !== currentFolderId) {
                moveOptions += `<option value="${f.id}">📁 ${f.name}</option>`;
            }
        });

        const moveSelectHtml = folders.length > 1 ? `
            <select class="action-btn move-select" title="Pindahkan Catatan" style="max-width: 95px; text-overflow: ellipsis; cursor: pointer;">
                ${moveOptions}
            </select>
        ` : '';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-badges">
                    <span class="badge pin-btn ${item.pinned ? 'active-pin' : ''}">${item.pinned ? '📌 Pinned' : '📌 Pin'}</span>
                    <span class="badge arc-btn ${item.archived ? 'active-arc' : ''}">${item.archived ? '📦 Unarchive' : '📦 Archive'}</span>
                </div>
            </div>
            ${imageHtml}
            <textarea class="card-body" placeholder="Ketik sesuatu...">${item.text}</textarea>
            <div class="card-footer">
                <div class="card-stats">
                    <span class="card-date">${dateStr}</span>
                    <span class="word-count">${countWordsAndChars(item.text)}</span>
                </div>
                <div class="card-actions">
                    ${uploadBtnHtml}
                    ${moveSelectHtml}
                    <button class="action-btn copy-btn">Copy</button>
                    <button class="action-btn del del-btn">Hapus</button>
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

                    showToast("⏳ Mengompres gambar dari clipboard...");
                    
                    try {
                        const compressedBase64 = await compressImage(file, 256);
                        item.image = compressedBase64;
                        item.updatedAt = Date.now();
                        await forceSaveNoteToServer(item);
                        renderGrid();
                        showToast("Gambar dari clipboard berhasil diunggah!");
                    } catch (err) {
                        console.error(err);
                        showToast(err.message || "Gagal mengompres gambar dari clipboard.");
                    }
                    break;
                }
            }
        });

        card.querySelector('.pin-btn').addEventListener('click', () => {
            item.pinned = !item.pinned;
            item.updatedAt = Date.now();
            forceSaveNoteToServer(item);
            renderGrid();
        });

        card.querySelector('.arc-btn').addEventListener('click', () => {
            item.archived = !item.archived;
            if (item.archived) item.pinned = false; 
            item.updatedAt = Date.now();
            forceSaveNoteToServer(item);
            renderGrid();
        });

        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(textInput.value).then(() => {
                // Micro-animation
                const originalText = copyBtn.textContent;
                copyBtn.textContent = "Copied! ✅";
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
        });

        card.querySelector('.del-btn').addEventListener('click', async () => {
            if (safeConfirm("Hapus catatan ini selamanya?")) {
                const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', item.id);
                try {
                    await deleteDoc(noteRef);
                    showToast("Catatan dihapus");
                } catch(err) {
                    showToast("Gagal menghapus");
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
                    showToast("Catatan dipindahkan!");
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
                if (safeConfirm("Hapus gambar dari catatan ini?")) {
                    item.image = null;
                    item.updatedAt = Date.now();
                    forceSaveNoteToServer(item);
                    renderGrid();
                }
            });
        } else {
            // Upload handlers
            const uploadBtn = card.querySelector('.upload-btn');
            const fileInput = card.querySelector('.card-file-input');
            const pasteImgBtn = card.querySelector('.paste-img-btn');

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

                uploadBtn.textContent = "⏳...";
                uploadBtn.disabled = true;

                try {
                    const compressedBase64 = await compressImage(file, 256);
                    item.image = compressedBase64;
                    item.updatedAt = Date.now();
                    await forceSaveNoteToServer(item);
                    renderGrid();
                    showToast("Gambar berhasil diunggah!");
                } catch (err) {
                    console.error(err);
                    showToast(err.message || "Gagal mengompres gambar.");
                    uploadBtn.textContent = "🖼️";
                    uploadBtn.disabled = false;
                }
            });

            pasteImgBtn.addEventListener('click', async () => {
                try {
                    const items = await navigator.clipboard.read();
                    let imageFound = false;
                    for (const clipboardItem of items) {
                        for (const type of clipboardItem.types) {
                            if (type.startsWith('image/')) {
                                pasteImgBtn.textContent = "⏳...";
                                pasteImgBtn.disabled = true;
                                
                                const blob = await clipboardItem.getType(type);
                                const file = new File([blob], "clipboard-image.png", { type });

                                try {
                                    const compressedBase64 = await compressImage(file, 256);
                                    item.image = compressedBase64;
                                    item.updatedAt = Date.now();
                                    await forceSaveNoteToServer(item);
                                    renderGrid();
                                    showToast("Gambar berhasil ditempel!");
                                } catch (err) {
                                    console.error(err);
                                    showToast(err.message || "Gagal mengompres gambar.");
                                    pasteImgBtn.textContent = "📋";
                                    pasteImgBtn.disabled = false;
                                }
                                imageFound = true;
                                break;
                            }
                        }
                        if (imageFound) break;
                    }
                    if (!imageFound) {
                        showToast("Tidak ada gambar di clipboard.");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Gagal membaca clipboard. Izinkan akses clipboard.");
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

DOM.btnAddNote.addEventListener('click', async () => {
    if(viewMode === 'archived') {
        viewMode = 'active';
        DOM.btnToggleView.textContent = "Lihat Arsip";
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
});

DOM.btnToggleView.addEventListener('click', () => {
    viewMode = viewMode === 'active' ? 'archived' : 'active';
    DOM.btnToggleView.textContent = viewMode === 'active' ? "Lihat Arsip" : "Kembali ke Aktif";
    DOM.btnToggleView.classList.toggle('btn-primary');
    renderGrid();
});

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

// Strict Lock Toggle handling
DOM.strictLockToggle.addEventListener('change', () => {
    if (!DOM.strictLockToggle.checked) {
        // If turned off, start the 5 min timer immediately
        resetAutoLockTimer();
    }
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

// Utility
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
            reject(new Error("File yang dipilih bukan gambar."));
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
                    reject(new Error(`Gambar terlalu besar. Kompresi maksimal hanya berhasil menurunkan ukuran ke ${Math.round(getKBSize(base64))} KB.`));
                } else {
                    resolve(base64);
                }
            };
            img.onerror = (err) => reject(new Error("Gagal memuat gambar untuk kompresi."));
        };
        reader.onerror = (err) => reject(new Error("Gagal membaca file gambar."));
    });
}
