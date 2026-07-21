import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp, collection, query, orderBy, limit, addDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
export let currentUser = null;
export let currentRoomHash = null;
export let appLockPasswordHash = null;

export let clipsArray = [];
export let unsubscribeClips = null;
export let isAppLocked = true;
export let isSearchMode = false;

// DOM Elements
const DOM = {
    authScreen: document.getElementById('authScreen'),
    appScreen: document.getElementById('appScreen'),
    initialAuthContainer: document.getElementById('initialAuthContainer'),
    googleLockedContainer: document.getElementById('googleLockedContainer'),
    
    roomNameInput: document.getElementById('roomNameInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginBtn: document.getElementById('loginBtn'),
    btnGoogleLogin: document.getElementById('btnGoogleLogin'),
    
    lockedUserAvatar: document.getElementById('lockedUserAvatar'),
    lockedUserName: document.getElementById('lockedUserName'),
    lockedUserEmail: document.getElementById('lockedUserEmail'),
    lockPasswordInput: document.getElementById('lockPasswordInput'),
    btnUnlockGoogle: document.getElementById('btnUnlockGoogle'),
    btnSwitchAccount: document.getElementById('btnSwitchAccount'),
    
    setupLockPasswordModal: document.getElementById('setupLockPasswordModal'),
    newLockPassword: document.getElementById('newLockPassword'),
    confirmLockPassword: document.getElementById('confirmLockPassword'),
    btnSaveLockPassword: document.getElementById('btnSaveLockPassword'),
    
    headerTitleText: document.getElementById('headerTitleText'),
    syncIndicator: document.getElementById('syncIndicator'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    btnLock: document.getElementById('btnLock'),
    
    searchInput: document.getElementById('searchInput'),
    btnSearch: document.getElementById('btnSearch'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    searchBanner: document.getElementById('searchBanner'),
    searchBannerText: document.getElementById('searchBannerText'),
    btnResetSearchBanner: document.getElementById('btnResetSearchBanner'),
    
    clipGrid: document.getElementById('clipGrid'),
    emptyState: document.getElementById('emptyState'),
    
    txtQuickInput: document.getElementById('txtQuickInput'),
    btnQuickInputPaste: document.getElementById('btnQuickInputPaste'),
    btnQuickInputSend: document.getElementById('btnQuickInputSend'),
    
    toast: document.getElementById('toast')
};

// ==========================================
// 🔐 AUTH & CRYPTO UTILITIES
// ==========================================
export async function hashPassword(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function countWordsAndChars(text) {
    if (!text || typeof text !== 'string') return '0 words | 0 chars';
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    return `${words} words | ${chars} chars`;
}

export function showToast(message) {
    if (!DOM.toast) return;
    DOM.toast.textContent = message;
    DOM.toast.classList.add('show');
    setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, 2400);
}

export function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else {
        return 'Just now';
    }
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
        return timeStr;
    }
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

// ==========================================
// 🔒 LOCK & SCREEN MANAGEMENT
// ==========================================
export function lockApp() {
    isAppLocked = true;
    if (unsubscribeClips) {
        unsubscribeClips();
        unsubscribeClips = null;
    }
    
    if (DOM.appScreen) DOM.appScreen.classList.add('hidden');
    if (DOM.authScreen) DOM.authScreen.classList.remove('hidden');
    
    if (currentUser && !currentUser.isAnonymous) {
        if (DOM.initialAuthContainer) DOM.initialAuthContainer.classList.add('hidden');
        if (DOM.googleLockedContainer) DOM.googleLockedContainer.classList.remove('hidden');
    } else {
        if (DOM.initialAuthContainer) DOM.initialAuthContainer.classList.remove('hidden');
        if (DOM.googleLockedContainer) DOM.googleLockedContainer.classList.add('hidden');
    }
}

export function unlockApp() {
    isAppLocked = false;
    if (DOM.authScreen) DOM.authScreen.classList.add('hidden');
    if (DOM.appScreen) DOM.appScreen.classList.remove('hidden');
    
    startClipsRealtimeSync();
}

// ==========================================
// 📡 FIRESTORE REALTIME STREAM & COLD STORAGE
// ==========================================

// Target Refactoring Backend 2: Query Utama LIFO + limit(50)
function startClipsRealtimeSync() {
    if (!currentRoomHash) return;
    if (unsubscribeClips) unsubscribeClips();
    
    const clipsRef = collection(db, 'clipboards', currentRoomHash, 'clips');
    // Query LIFO (newest first) strictly capped to 50 items
    const q = query(clipsRef, orderBy('timestamp', 'desc'), limit(50));
    
    if (DOM.syncIndicator) DOM.syncIndicator.classList.add('saving');
    
    unsubscribeClips = onSnapshot(q, (snapshot) => {
        clipsArray = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            clipsArray.push({
                id: docSnap.id,
                text: data.text || '',
                timestamp: data.timestamp
            });
        });
        
        if (DOM.syncIndicator) DOM.syncIndicator.classList.remove('saving');
        
        // If not in active search mode, render the realtime 50 stream
        if (!isSearchMode) {
            renderClips(clipsArray);
        }
    }, (error) => {
        console.error("Firestore realtime sync error:", error);
        showToast("Koneksi realtime terputus");
        if (DOM.syncIndicator) DOM.syncIndicator.classList.remove('saving');
    });
}

// Target Refactoring Backend 1: Simplifikasi Skema Data (pure text, timestamp, userId)
async function createNewClip(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    
    try {
        if (DOM.syncIndicator) DOM.syncIndicator.classList.add('saving');
        const clipsRef = collection(db, 'clipboards', currentRoomHash, 'clips');
        
        await addDoc(clipsRef, {
            text: cleanText,
            timestamp: serverTimestamp(),
            userId: currentUser ? currentUser.uid : 'guest'
        });
        
        if (DOM.txtQuickInput) DOM.txtQuickInput.value = '';
        showToast("Klip tersimpan!");
    } catch (err) {
        console.error("Gagal menyimpan klip:", err);
        showToast("Gagal menyimpan klip");
    } finally {
        if (DOM.syncIndicator) DOM.syncIndicator.classList.remove('saving');
    }
}

async function deleteClip(clipId) {
    try {
        const docRef = doc(db, 'clipboards', currentRoomHash, 'clips', clipId);
        await deleteDoc(docRef);
        showToast("Klip dihapus");
    } catch (err) {
        console.error("Gagal menghapus klip:", err);
        showToast("Gagal menghapus klip");
    }
}

// Target Refactoring Frontend 4: Cold Storage Search Button (CRITICAL RULE)
// ponytail: [cold storage search query limit 200] -> [integrate full-text search engine (e.g. Algolia/Elastic) if room exceeds 10,000 clips]
async function performColdStorageSearch() {
    const term = (DOM.searchInput?.value || '').trim().toLowerCase();
    
    if (!term) {
        resetSearchMode();
        return;
    }
    
    isSearchMode = true;
    showToast("Mencari di cold storage...");
    if (DOM.btnClearSearch) DOM.btnClearSearch.classList.remove('hidden');
    if (DOM.searchBanner) DOM.searchBanner.classList.remove('hidden');
    if (DOM.searchBannerText) DOM.searchBannerText.textContent = `Menampilkan hasil pencarian untuk "${term}"...`;
    
    try {
        const clipsRef = collection(db, 'clipboards', currentRoomHash, 'clips');
        // Fetch up to 200 documents from LIFO cold storage for substring match
        const q = query(clipsRef, orderBy('timestamp', 'desc'), limit(200));
        const snapshot = await getDocs(q);
        
        const matchedClips = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const text = data.text || '';
            if (text.toLowerCase().includes(term)) {
                matchedClips.push({
                    id: docSnap.id,
                    text: text,
                    timestamp: data.timestamp
                });
            }
        });
        
        if (DOM.searchBannerText) {
            DOM.searchBannerText.textContent = `Cold storage: ${matchedClips.length} klip ditemukan untuk "${term}"`;
        }
        
        renderClips(matchedClips, true);
    } catch (err) {
        console.error("Error searching cold storage:", err);
        showToast("Gagal mencari di cold storage");
    }
}

function resetSearchMode() {
    isSearchMode = false;
    if (DOM.searchInput) DOM.searchInput.value = '';
    if (DOM.btnClearSearch) DOM.btnClearSearch.classList.add('hidden');
    if (DOM.searchBanner) DOM.searchBanner.classList.add('hidden');
    renderClips(clipsArray);
}

// ==========================================
// 🎨 FRONTEND UI RENDERING
// ==========================================

// Target Refactoring Frontend 2: Truncate max 2 lines & 1-tap Copy Button
function renderClips(clipsList, isSearchResult = false) {
    if (!DOM.clipGrid) return;
    DOM.clipGrid.innerHTML = '';
    
    if (!clipsList || clipsList.length === 0) {
        if (DOM.emptyState) {
            DOM.emptyState.classList.remove('hidden');
            const subText = DOM.emptyState.querySelector('p');
            if (subText) {
                subText.textContent = isSearchResult 
                    ? "Tidak ada klip yang cocok ditemukan di cold storage."
                    : "Ketik atau tempel teks di form bawah untuk membuat klip baru.";
            }
        }
        return;
    }
    
    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');
    
    clipsList.forEach(clip => {
        const card = document.createElement('div');
        card.className = 'clip-card';
        
        const timeStr = formatTime(clip.timestamp);
        
        card.innerHTML = `
            <div class="clip-body" title="Klik untuk ekspansi / perkecil teks">
                <div class="clip-text">${escapeHtml(clip.text)}</div>
                <div class="clip-meta">${timeStr}</div>
            </div>
            <div class="clip-actions">
                <button class="btn-copy" aria-label="Copy clip text">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy
                </button>
                <button class="btn-delete-clip" title="Hapus klip" aria-label="Delete clip">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        
        // Expand/Collapse text on card body click
        const bodyEl = card.querySelector('.clip-body');
        const textEl = card.querySelector('.clip-text');
        bodyEl.addEventListener('click', () => {
            textEl.classList.toggle('expanded');
        });
        
        // 1-Tap Copy Button Event
        const copyBtn = card.querySelector('.btn-copy');
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(clip.text);
                showToast("Teks berhasil disalin!");
                copyBtn.innerHTML = `✓ Disalin`;
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
                }, 1500);
            } catch (err) {
                console.error("Failed to copy:", err);
                showToast("Gagal menyalin teks");
            }
        });
        
        // Delete Button Event
        const delBtn = card.querySelector('.btn-delete-clip');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteClip(clip.id);
        });
        
        DOM.clipGrid.appendChild(card);
    });
}

// ==========================================
// 🚀 EVENT LISTENERS & INITIALIZATION
// ==========================================

// Guest / Room Login Handler
if (DOM.loginBtn) {
    DOM.loginBtn.addEventListener('click', async () => {
        const roomName = (DOM.roomNameInput?.value || '').trim().toLowerCase();
        const pin = (DOM.passwordInput?.value || '').trim();
        
        if (!roomName) {
            showToast("Masukkan Nama Room!");
            return;
        }
        if (pin.length !== 4) {
            showToast("Masukkan 4-Digit PIN!");
            return;
        }
        
        const combined = `${roomName}_${pin}`;
        currentRoomHash = await hashPassword(combined);
        appLockPasswordHash = await hashPassword(pin);
        
        if (!currentUser) {
            try {
                const cred = await signInAnonymously(auth);
                currentUser = cred.user;
            } catch (err) {
                console.error("Anonymous auth error:", err);
            }
        }
        
        if (DOM.headerTitleText) DOM.headerTitleText.textContent = roomName;
        unlockApp();
    });
}

// Google Sign In Handler
if (DOM.btnGoogleLogin) {
    DOM.btnGoogleLogin.addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            currentUser = result.user;
            
            currentRoomHash = await hashPassword(currentUser.uid);
            
            const savedPinHash = localStorage.getItem(`lock_pin_${currentUser.uid}`);
            if (savedPinHash) {
                appLockPasswordHash = savedPinHash;
                unlockApp();
            } else {
                if (DOM.setupLockPasswordModal) DOM.setupLockPasswordModal.classList.remove('hidden');
            }
        } catch (err) {
            console.error("Google sign in error:", err);
            showToast("Gagal masuk dengan Google");
        }
    });
}

// First time Google PIN setup handler
if (DOM.btnSaveLockPassword) {
    DOM.btnSaveLockPassword.addEventListener('click', async () => {
        const pin = (DOM.newLockPassword?.value || '').trim();
        const confirmPin = (DOM.confirmLockPassword?.value || '').trim();
        
        if (pin.length !== 4) {
            showToast("PIN harus 4 digit!");
            return;
        }
        if (pin !== confirmPin) {
            showToast("PIN konfirmasi tidak cocok!");
            return;
        }
        
        appLockPasswordHash = await hashPassword(pin);
        if (currentUser) {
            localStorage.setItem(`lock_pin_${currentUser.uid}`, appLockPasswordHash);
        }
        
        if (DOM.setupLockPasswordModal) DOM.setupLockPasswordModal.classList.add('hidden');
        unlockApp();
    });
}

// Unlock Google screen handler
if (DOM.btnUnlockGoogle) {
    DOM.btnUnlockGoogle.addEventListener('click', async () => {
        const pin = (DOM.lockPasswordInput?.value || '').trim();
        const inputHash = await hashPassword(pin);
        
        if (inputHash === appLockPasswordHash) {
            if (DOM.lockPasswordInput) DOM.lockPasswordInput.value = '';
            unlockApp();
        } else {
            showToast("PIN salah!");
        }
    });
}

// Sign out / switch account
if (DOM.btnSwitchAccount) {
    DOM.btnSwitchAccount.addEventListener('click', async () => {
        await signOut(auth);
        currentUser = null;
        currentRoomHash = null;
        appLockPasswordHash = null;
        lockApp();
    });
}

// Lock button
if (DOM.btnLock) {
    DOM.btnLock.addEventListener('click', () => {
        lockApp();
    });
}

// Target Refactoring Frontend 4 (CRITICAL RULE): Search Button Click & Enter Key ONLY
if (DOM.btnSearch) {
    DOM.btnSearch.addEventListener('click', () => {
        performColdStorageSearch();
    });
}

if (DOM.searchInput) {
    DOM.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performColdStorageSearch();
        }
    });
    // NOTE: Strictly NO 'input' or 'keyup' real-time search filtering listener is attached!
}

if (DOM.btnClearSearch) {
    DOM.btnClearSearch.addEventListener('click', () => {
        resetSearchMode();
    });
}

if (DOM.btnResetSearchBanner) {
    DOM.btnResetSearchBanner.addEventListener('click', () => {
        resetSearchMode();
    });
}

// Target Refactoring Frontend 1: Sticky Bottom Input Area Submit & Paste Actions
if (DOM.btnQuickInputSend) {
    DOM.btnQuickInputSend.addEventListener('click', () => {
        const text = (DOM.txtQuickInput?.value || '').trim();
        if (text) {
            createNewClip(text);
        }
    });
}

if (DOM.txtQuickInput) {
    DOM.txtQuickInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = DOM.txtQuickInput.value.trim();
            if (text) {
                createNewClip(text);
            }
        }
    });
}

if (DOM.btnQuickInputPaste) {
    DOM.btnQuickInputPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && DOM.txtQuickInput) {
                DOM.txtQuickInput.value = text;
                showToast("Teks ditempel dari clipboard!");
            }
        } catch (err) {
            console.error("Failed to read clipboard:", err);
            showToast("Izinkan akses clipboard di browser");
        }
    });
}

// Theme Toggle
if (DOM.btnThemeToggle) {
    DOM.btnThemeToggle.addEventListener('click', () => {
        const isLight = document.documentElement.classList.toggle('light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

// Listen to Firebase Auth state change
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (user.photoURL && DOM.lockedUserAvatar) DOM.lockedUserAvatar.src = user.photoURL;
        if (user.displayName && DOM.lockedUserName) DOM.lockedUserName.textContent = user.displayName;
        if (user.email && DOM.lockedUserEmail) DOM.lockedUserEmail.textContent = user.email;
    }
});
