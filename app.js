import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, collection, query, limit, addDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 🔧 FIREBASE CONFIGURATION
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
export let activePreviewClipId = null;

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
    
    headerNormalView: document.getElementById('headerNormalView'),
    headerSearchOverlay: document.getElementById('headerSearchOverlay'),
    headerTitleText: document.getElementById('headerTitleText'),
    syncIndicator: document.getElementById('syncIndicator'),
    btnLock: document.getElementById('btnLock'),
    
    btnOpenSearch: document.getElementById('btnOpenSearch'),
    searchInput: document.getElementById('searchInput'),
    btnSearch: document.getElementById('btnSearch'),
    btnCloseSearch: document.getElementById('btnCloseSearch'),
    searchBanner: document.getElementById('searchBanner'),
    searchBannerText: document.getElementById('searchBannerText'),
    btnResetSearchBanner: document.getElementById('btnResetSearchBanner'),
    
    clipGrid: document.getElementById('clipGrid'),
    emptyState: document.getElementById('emptyState'),
    
    btnFabEditor: document.getElementById('btnFabEditor'),
    btnFabQuickPaste: document.getElementById('btnFabQuickPaste'),
    
    fullPageEditorModal: document.getElementById('fullPageEditorModal'),
    btnCloseFullPageEditor: document.getElementById('btnCloseFullPageEditor'),
    btnFullEditorPaste: document.getElementById('btnFullEditorPaste'),
    btnFullEditorSend: document.getElementById('btnFullEditorSend'),
    txtFullPageEditor: document.getElementById('txtFullPageEditor'),
    
    fullPagePreviewModal: document.getElementById('fullPagePreviewModal'),
    btnClosePreviewModal: document.getElementById('btnClosePreviewModal'),
    btnPreviewCopy: document.getElementById('btnPreviewCopy'),
    btnPreviewDelete: document.getElementById('btnPreviewDelete'),
    btnPreviewSave: document.getElementById('btnPreviewSave'),
    txtPreviewText: document.getElementById('txtPreviewText'),
    
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
    }, 2800);
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

function getTimeMs(ts) {
    if (!ts) return Date.now();
    if (typeof ts === 'number') return ts;
    if (ts.toMillis) return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    return Date.now();
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    const ms = getTimeMs(timestamp);
    const date = new Date(ms);
    
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
// 📡 SYNC & DATA MANAGEMENT
// ==========================================

function startClipsRealtimeSync() {
    if (!currentRoomHash) return;
    if (unsubscribeClips) unsubscribeClips();
    
    const notesRef = collection(db, 'clipboards', currentRoomHash, 'notes');
    
    if (DOM.syncIndicator) {
        DOM.syncIndicator.classList.remove('disconnected');
        DOM.syncIndicator.classList.add('saving');
        DOM.syncIndicator.title = "Connecting...";
    }
    
    const q = query(notesRef, limit(50));
    
    unsubscribeClips = onSnapshot(q, (snapshot) => {
        clipsArray = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            clipsArray.push({
                id: docSnap.id,
                text: data.text || data.content || '',
                timestamp: data.timestamp
            });
        });
        
        // Client-side LIFO sorting (newest first)
        clipsArray.sort((a, b) => getTimeMs(b.timestamp) - getTimeMs(a.timestamp));
        
        if (DOM.syncIndicator) {
            DOM.syncIndicator.classList.remove('saving', 'disconnected');
            DOM.syncIndicator.title = "Synced";
        }
        
        if (!isSearchMode) {
            renderClips(clipsArray);
        }
    }, (error) => {
        console.error("Firestore sync error:", error);
        if (DOM.syncIndicator) {
            DOM.syncIndicator.classList.remove('saving');
            DOM.syncIndicator.classList.add('disconnected');
            DOM.syncIndicator.title = "Offline";
        }
        showToast("Connection issue: " + (error.code || error.message));
    });
}

async function createNewClip(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    
    if (!currentRoomHash) {
        showToast("Room is required!");
        return;
    }
    
    // Ensure Firebase Auth session is ready
    if (!auth.currentUser) {
        try {
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
        } catch (err) {
            console.error("Auth error during clip creation:", err);
            showToast("Unable to authenticate room: " + err.message);
            return;
        }
    }
    
    try {
        if (DOM.syncIndicator) DOM.syncIndicator.classList.add('saving');
        const notesRef = collection(db, 'clipboards', currentRoomHash, 'notes');
        
        await addDoc(notesRef, {
            text: cleanText,
            timestamp: serverTimestamp(),
            userId: auth.currentUser ? auth.currentUser.uid : 'guest'
        });
        
        if (DOM.txtFullPageEditor) DOM.txtFullPageEditor.value = '';
        showToast("Clip saved!");
    } catch (err) {
        console.error("Failed to save clip:", err);
        showToast("Failed to save clip: " + (err.message || err));
    } finally {
        if (DOM.syncIndicator) DOM.syncIndicator.classList.remove('saving');
    }
}

async function updateClip(clipId, newText) {
    if (!clipId || !newText || !newText.trim()) return;
    try {
        const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', clipId);
        await updateDoc(docRef, {
            text: newText.trim(),
            timestamp: serverTimestamp()
        });
        showToast("Clip updated!");
    } catch (err) {
        console.error("Failed to update clip:", err);
        showToast("Failed to update clip: " + (err.message || err));
    }
}

async function deleteClip(clipId) {
    try {
        const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', clipId);
        await deleteDoc(docRef);
        showToast("Clip deleted");
    } catch (err) {
        console.error("Failed to delete clip:", err);
        showToast("Failed to delete clip: " + (err.message || err));
    }
}

// Search across clips in history
// ponytail: [search query limit 200] -> [integrate full-text search engine if room exceeds 10,000 clips]
async function performSearch() {
    const term = (DOM.searchInput?.value || '').trim().toLowerCase();
    
    if (!term) {
        resetSearchMode();
        return;
    }
    
    isSearchMode = true;
    showToast("Searching clips...");
    if (DOM.searchBanner) DOM.searchBanner.classList.remove('hidden');
    if (DOM.searchBannerText) DOM.searchBannerText.textContent = `Showing search results for "${term}"...`;
    
    try {
        const notesRef = collection(db, 'clipboards', currentRoomHash, 'notes');
        const q = query(notesRef, limit(200));
        const snapshot = await getDocs(q);
        
        const matchedClips = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const text = data.text || data.content || '';
            if (text.toLowerCase().includes(term)) {
                matchedClips.push({
                    id: docSnap.id,
                    text: text,
                    timestamp: data.timestamp
                });
            }
        });
        
        matchedClips.sort((a, b) => getTimeMs(b.timestamp) - getTimeMs(a.timestamp));
        
        if (DOM.searchBannerText) {
            DOM.searchBannerText.textContent = `Found ${matchedClips.length} clips for "${term}"`;
        }
        
        renderClips(matchedClips, true);
    } catch (err) {
        console.error("Error searching clips:", err);
        showToast("Search error: " + (err.message || err));
    }
}

function resetSearchMode() {
    isSearchMode = false;
    if (DOM.searchInput) DOM.searchInput.value = '';
    if (DOM.searchBanner) DOM.searchBanner.classList.add('hidden');
    renderClips(clipsArray);
}

function closeSearchOverlay() {
    if (DOM.headerSearchOverlay) DOM.headerSearchOverlay.classList.add('hidden');
    if (DOM.headerNormalView) DOM.headerNormalView.classList.remove('hidden');
    resetSearchMode();
}

// ==========================================
// 🎨 FRONTEND UI RENDERING
// ==========================================

// Card text limited to 3 lines clamp & non-selectable; clicking opens preview modal
function renderClips(clipsList, isSearchResult = false) {
    if (!DOM.clipGrid) return;
    DOM.clipGrid.innerHTML = '';
    
    if (!clipsList || clipsList.length === 0) {
        if (DOM.emptyState) {
            DOM.emptyState.classList.remove('hidden');
            const subText = DOM.emptyState.querySelector('p');
            if (subText) {
                subText.textContent = isSearchResult 
                    ? "No matching clips found."
                    : "Use the (+) button at bottom right to write a new clip, or the Paste button to auto-save.";
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
            <div class="clip-body" title="Click to view & edit full clip">
                <div class="clip-text">${escapeHtml(clip.text)}</div>
                <div class="clip-meta">${timeStr}</div>
            </div>
            <div class="clip-actions">
                <button class="btn-copy" aria-label="Copy clip text">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy
                </button>
                <button class="btn-delete-clip" title="Delete clip" aria-label="Delete clip">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        
        // Open Full Page Preview & Edit Modal on card click
        card.addEventListener('click', (e) => {
            // Auto-close topbar search if active
            closeSearchOverlay();
            
            // Do not trigger if clicking copy or delete action buttons
            if (e.target.closest('.btn-copy') || e.target.closest('.btn-delete-clip')) {
                return;
            }
            openPreviewModal(clip);
        });
        
        // 1-Tap Copy Button Event
        const copyBtn = card.querySelector('.btn-copy');
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(clip.text);
                showToast("Clip copied to clipboard!");
                copyBtn.innerHTML = `✓ Copied`;
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
                }, 1500);
            } catch (err) {
                console.error("Failed to copy:", err);
                showToast("Failed to copy text");
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

function openPreviewModal(clip) {
    activePreviewClipId = clip.id;
    if (DOM.txtPreviewText) {
        DOM.txtPreviewText.value = clip.text;
    }
    if (DOM.fullPagePreviewModal) {
        DOM.fullPagePreviewModal.classList.remove('hidden');
    }
}

function closePreviewModal() {
    activePreviewClipId = null;
    if (DOM.fullPagePreviewModal) {
        DOM.fullPagePreviewModal.classList.add('hidden');
    }
}

// ==========================================
// 🚀 EVENT LISTENERS & INITIALIZATION
// ==========================================

// Network connection listeners
window.addEventListener('online', () => {
    if (DOM.syncIndicator) {
        DOM.syncIndicator.classList.remove('disconnected');
        DOM.syncIndicator.title = "Synced";
    }
    showToast("Internet reconnected");
    if (!isAppLocked && currentRoomHash) {
        startClipsRealtimeSync();
    }
});

window.addEventListener('offline', () => {
    if (DOM.syncIndicator) {
        DOM.syncIndicator.classList.remove('saving');
        DOM.syncIndicator.classList.add('disconnected');
        DOM.syncIndicator.title = "Offline";
    }
    showToast("Connection lost (Offline)");
});

// Guest / Room Login Handler
if (DOM.loginBtn) {
    DOM.loginBtn.addEventListener('click', async () => {
        const roomName = (DOM.roomNameInput?.value || '').trim().toLowerCase();
        const pin = (DOM.passwordInput?.value || '').trim();
        
        if (!roomName) {
            showToast("Please enter Room Name!");
            return;
        }
        if (pin.length !== 4) {
            showToast("Please enter 4-Digit PIN!");
            return;
        }
        
        const combined = `${roomName}_${pin}`;
        currentRoomHash = await hashPassword(combined);
        appLockPasswordHash = await hashPassword(pin);
        
        if (!auth.currentUser) {
            try {
                const cred = await signInAnonymously(auth);
                currentUser = cred.user;
            } catch (err) {
                console.error("Anonymous auth error:", err);
                showToast("Failed to authenticate room: " + err.message);
                return;
            }
        } else {
            currentUser = auth.currentUser;
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
            showToast("Google sign in error: " + (err.message || err));
        }
    });
}

// First time Google PIN setup handler
if (DOM.btnSaveLockPassword) {
    DOM.btnSaveLockPassword.addEventListener('click', async () => {
        const pin = (DOM.newLockPassword?.value || '').trim();
        const confirmPin = (DOM.confirmLockPassword?.value || '').trim();
        
        if (pin.length !== 4) {
            showToast("PIN must be 4 digits!");
            return;
        }
        if (pin !== confirmPin) {
            showToast("PIN confirmation does not match!");
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
            showToast("Incorrect PIN!");
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
        closeSearchOverlay();
        lockApp();
    });
}

// ==========================================
// 🔍 EXPANDABLE TOP BAR SEARCH LISTENERS & AUTO-CLOSE
// ==========================================
if (DOM.btnOpenSearch) {
    DOM.btnOpenSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (DOM.headerNormalView) DOM.headerNormalView.classList.add('hidden');
        if (DOM.headerSearchOverlay) DOM.headerSearchOverlay.classList.remove('hidden');
        if (DOM.searchInput) DOM.searchInput.focus();
    });
}

if (DOM.btnCloseSearch) {
    DOM.btnCloseSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSearchOverlay();
    });
}

if (DOM.btnSearch) {
    DOM.btnSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        performSearch();
    });
}

if (DOM.searchInput) {
    DOM.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
}

if (DOM.btnResetSearchBanner) {
    DOM.btnResetSearchBanner.addEventListener('click', () => {
        resetSearchMode();
    });
}

// Global click listener to auto-close topbar search when clicking outside
document.addEventListener('click', (e) => {
    if (DOM.headerSearchOverlay && !DOM.headerSearchOverlay.classList.contains('hidden')) {
        const isClickInsideSearch = DOM.headerSearchOverlay.contains(e.target);
        const isClickOpenSearchBtn = DOM.btnOpenSearch?.contains(e.target);
        if (!isClickInsideSearch && !isClickOpenSearchBtn) {
            closeSearchOverlay();
        }
    }
});

// ==========================================
// 🔘 2 FABs MECHANISM LISTENERS
// ==========================================

// FAB Top (+ Plus): Open Full Page Text Editor Modal
if (DOM.btnFabEditor) {
    DOM.btnFabEditor.addEventListener('click', () => {
        closeSearchOverlay();
        if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.remove('hidden');
        if (DOM.txtFullPageEditor) {
            DOM.txtFullPageEditor.value = '';
            DOM.txtFullPageEditor.focus();
        }
    });
}

// Full Page Editor: Close Button
if (DOM.btnCloseFullPageEditor) {
    DOM.btnCloseFullPageEditor.addEventListener('click', () => {
        if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.add('hidden');
    });
}

// Full Page Editor: Paste Button
if (DOM.btnFullEditorPaste) {
    DOM.btnFullEditorPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && DOM.txtFullPageEditor) {
                DOM.txtFullPageEditor.value = text;
                showToast("Text pasted from clipboard!");
            }
        } catch (err) {
            console.error("Failed to read clipboard:", err);
            showToast("Allow clipboard access in browser");
        }
    });
}

// Full Page Editor: Save Button
if (DOM.btnFullEditorSend) {
    DOM.btnFullEditorSend.addEventListener('click', async () => {
        const text = (DOM.txtFullPageEditor?.value || '').trim();
        if (text) {
            await createNewClip(text);
            if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.add('hidden');
        } else {
            showToast("Write clip text first");
        }
    });
}

// FAB Bottom (Paste Icon): 1-Tap Automatic Paste & Immediate Save
if (DOM.btnFabQuickPaste) {
    DOM.btnFabQuickPaste.addEventListener('click', async () => {
        closeSearchOverlay();
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                await createNewClip(text.trim());
                showToast("Clip saved from clipboard!");
            } else {
                showToast("Clipboard is empty!");
            }
        } catch (err) {
            console.error("Failed to read clipboard:", err);
            showToast("Allow clipboard access in browser");
        }
    });
}

// ==========================================
// 📖 FULL PAGE PREVIEW MODAL LISTENERS
// ==========================================
if (DOM.btnClosePreviewModal) {
    DOM.btnClosePreviewModal.addEventListener('click', () => {
        closePreviewModal();
    });
}

if (DOM.btnPreviewCopy) {
    DOM.btnPreviewCopy.addEventListener('click', async () => {
        const text = DOM.txtPreviewText?.value || '';
        try {
            await navigator.clipboard.writeText(text);
            showToast("Clip copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy text:", err);
            showToast("Failed to copy text");
        }
    });
}

if (DOM.btnPreviewSave) {
    DOM.btnPreviewSave.addEventListener('click', async () => {
        const text = (DOM.txtPreviewText?.value || '').trim();
        if (activePreviewClipId && text) {
            await updateClip(activePreviewClipId, text);
            closePreviewModal();
        }
    });
}

if (DOM.btnPreviewDelete) {
    DOM.btnPreviewDelete.addEventListener('click', async () => {
        if (activePreviewClipId) {
            await deleteClip(activePreviewClipId);
            closePreviewModal();
        }
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
