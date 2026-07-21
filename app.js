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

// Attachments state
export let editorAttachment = null;   // { type: 'image'|'file', data: string, name?: string, size?: number }
export let previewAttachment = null;  // { type: 'image'|'file', data: string, name?: string, size?: number }

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
    btnAttachImage: document.getElementById('btnAttachImage'),
    btnAttachFile: document.getElementById('btnAttachFile'),
    inputEditorImage: document.getElementById('inputEditorImage'),
    inputEditorFile: document.getElementById('inputEditorFile'),
    editorAttachmentPreview: document.getElementById('editorAttachmentPreview'),
    btnFullEditorPaste: document.getElementById('btnFullEditorPaste'),
    btnFullEditorSend: document.getElementById('btnFullEditorSend'),
    txtFullPageEditor: document.getElementById('txtFullPageEditor'),
    
    fullPagePreviewModal: document.getElementById('fullPagePreviewModal'),
    btnClosePreviewModal: document.getElementById('btnClosePreviewModal'),
    btnPreviewAttachImage: document.getElementById('btnPreviewAttachImage'),
    btnPreviewAttachFile: document.getElementById('btnPreviewAttachFile'),
    inputPreviewImage: document.getElementById('inputPreviewImage'),
    inputPreviewFile: document.getElementById('inputPreviewFile'),
    previewAttachmentDisplay: document.getElementById('previewAttachmentDisplay'),
    btnPreviewCopy: document.getElementById('btnPreviewCopy'),
    btnPreviewDelete: document.getElementById('btnPreviewDelete'),
    btnPreviewSave: document.getElementById('btnPreviewSave'),
    txtPreviewText: document.getElementById('txtPreviewText'),
    
    toast: document.getElementById('toast')
};

// ==========================================
// 🔐 UTILITIES & ATTACHMENT COMPRESSION
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

// Compress image file automatically to under 128 KB
export async function compressImageToDataUrl(file, maxKb = 128) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Downscale if very high resolution
                const maxDim = 1000;
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
                
                let quality = 0.8;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                
                while (dataUrl.length > maxKb * 1024 * 1.33 && quality > 0.15) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                
                if (dataUrl.length > maxKb * 1024 * 1.33) {
                    canvas.width = Math.round(width * 0.6);
                    canvas.height = Math.round(height * 0.6);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                }
                
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

// Read document file & verify <= 128 KB
export async function readDocumentFile(file, maxKb = 128) {
    const maxBytes = maxKb * 1024;
    if (file.size > maxBytes) {
        const kbSize = Math.round(file.size / 1024);
        throw new Error(`File size (${kbSize} KB) exceeds limit of ${maxKb} KB!`);
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            data: reader.result
        });
        reader.onerror = () => reject(new Error("Failed to read document file"));
        reader.readAsDataURL(file);
    });
}

// Read clipboard for text, image, or document file
export async function readClipboardContent() {
    // 1. Try rich Clipboard API first (supports images)
    if (navigator.clipboard && navigator.clipboard.read) {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                // Check for image types in clipboard
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], "clipboard-image.jpg", { type: imageType });
                    const compressedDataUrl = await compressImageToDataUrl(file, 128);
                    return { type: 'image', data: compressedDataUrl };
                }
                
                // Check for text
                if (item.types.includes('text/plain')) {
                    const blob = await item.getType('text/plain');
                    const text = await blob.text();
                    if (text && text.trim()) {
                        return { type: 'text', text: text.trim() };
                    }
                }
            }
        } catch (err) {
            console.warn("navigator.clipboard.read fallback:", err);
        }
    }
    
    // 2. Fallback to standard readText
    if (navigator.clipboard && navigator.clipboard.readText) {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                return { type: 'text', text: text.trim() };
            }
        } catch (err) {
            console.warn("navigator.clipboard.readText fallback:", err);
        }
    }
    
    return null;
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
                timestamp: data.timestamp,
                imageData: data.imageData || null,
                fileData: data.fileData || null
            });
        });
        
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

async function createNewClip(text, attachment = null) {
    const cleanText = (text || '').trim();
    
    if (!cleanText && !attachment) {
        showToast("Write clip text or attach a file first!");
        return;
    }
    
    if (!currentRoomHash) {
        showToast("Room is required!");
        return;
    }
    
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
        
        const payload = {
            text: cleanText,
            timestamp: serverTimestamp(),
            userId: auth.currentUser ? auth.currentUser.uid : 'guest'
        };
        
        if (attachment) {
            if (attachment.type === 'image') {
                payload.imageData = attachment.data;
            } else if (attachment.type === 'file') {
                payload.fileData = {
                    name: attachment.name,
                    size: attachment.size,
                    type: attachment.type,
                    data: attachment.data
                };
            }
        }
        
        await addDoc(notesRef, payload);
        
        if (DOM.txtFullPageEditor) DOM.txtFullPageEditor.value = '';
        editorAttachment = null;
        renderEditorAttachment();
        
        showToast("Clip saved!");
    } catch (err) {
        console.error("Failed to save clip:", err);
        showToast("Failed to save clip: " + (err.message || err));
    } finally {
        if (DOM.syncIndicator) DOM.syncIndicator.classList.remove('saving');
    }
}

async function updateClip(clipId, newText, attachment = null) {
    if (!clipId) return;
    try {
        const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', clipId);
        const payload = {
            text: (newText || '').trim(),
            timestamp: serverTimestamp()
        };
        
        if (attachment === 'DELETE') {
            payload.imageData = null;
            payload.fileData = null;
        } else if (attachment) {
            if (attachment.type === 'image') {
                payload.imageData = attachment.data;
                payload.fileData = null;
            } else if (attachment.type === 'file') {
                payload.fileData = {
                    name: attachment.name,
                    size: attachment.size,
                    type: attachment.type,
                    data: attachment.data
                };
                payload.imageData = null;
            }
        }
        
        await updateDoc(docRef, payload);
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
            const fileName = data.fileData?.name || '';
            if (text.toLowerCase().includes(term) || fileName.toLowerCase().includes(term)) {
                matchedClips.push({
                    id: docSnap.id,
                    text: text,
                    timestamp: data.timestamp,
                    imageData: data.imageData || null,
                    fileData: data.fileData || null
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
        
        let attachmentHtml = '';
        if (clip.imageData) {
            attachmentHtml = `<img src="${clip.imageData}" class="clip-card-attachment-thumb" alt="Attachment Image">`;
        } else if (clip.fileData) {
            const kbSize = Math.round((clip.fileData.size || 0) / 1024);
            attachmentHtml = `
                <div class="clip-card-attachment-file">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    <span>${escapeHtml(clip.fileData.name)} (${kbSize} KB)</span>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="clip-body" title="Click to view & edit full clip">
                ${attachmentHtml}
                <div class="clip-text">${escapeHtml(clip.text || '(No text)')}</div>
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
                const textToCopy = clip.text || (clip.fileData ? clip.fileData.name : 'Clip Attachment');
                await navigator.clipboard.writeText(textToCopy);
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

// Attachment UI Rendering inside Editor
function renderEditorAttachment() {
    if (!DOM.editorAttachmentPreview) return;
    
    if (!editorAttachment) {
        DOM.editorAttachmentPreview.classList.add('hidden');
        DOM.editorAttachmentPreview.innerHTML = '';
        return;
    }
    
    DOM.editorAttachmentPreview.classList.remove('hidden');
    if (editorAttachment.type === 'image') {
        DOM.editorAttachmentPreview.innerHTML = `
            <img src="${editorAttachment.data}" class="attachment-image-display" alt="Attached Image">
            <button id="btnRemoveEditorAttachment" class="btn-detach" title="Remove attachment">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Remove
            </button>
        `;
    } else if (editorAttachment.type === 'file') {
        const kbSize = Math.round((editorAttachment.size || 0) / 1024);
        DOM.editorAttachmentPreview.innerHTML = `
            <div class="attachment-file-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                <span class="attachment-file-name">${escapeHtml(editorAttachment.name)} (${kbSize} KB)</span>
            </div>
            <button id="btnRemoveEditorAttachment" class="btn-detach" title="Remove attachment">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Remove
            </button>
        `;
    }
    
    const removeBtn = document.getElementById('btnRemoveEditorAttachment');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            editorAttachment = null;
            renderEditorAttachment();
        });
    }
}

// Attachment UI Rendering inside Preview Modal
function renderPreviewAttachment() {
    if (!DOM.previewAttachmentDisplay) return;
    
    if (!previewAttachment) {
        DOM.previewAttachmentDisplay.classList.add('hidden');
        DOM.previewAttachmentDisplay.innerHTML = '';
        return;
    }
    
    DOM.previewAttachmentDisplay.classList.remove('hidden');
    if (previewAttachment.type === 'image') {
        DOM.previewAttachmentDisplay.innerHTML = `
            <img src="${previewAttachment.data}" class="attachment-image-display" alt="Attached Image">
            <div style="display: flex; gap: 8px; align-items: center;">
                <a href="${previewAttachment.data}" download="attachment.jpg" class="btn" style="padding: 4px 10px; font-size: 0.8rem;" title="Download image">Download</a>
                <button id="btnRemovePreviewAttachment" class="btn-detach" title="Remove attachment">Remove</button>
            </div>
        `;
    } else if (previewAttachment.type === 'file') {
        const kbSize = Math.round((previewAttachment.size || 0) / 1024);
        DOM.previewAttachmentDisplay.innerHTML = `
            <div class="attachment-file-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                <span class="attachment-file-name">${escapeHtml(previewAttachment.name)} (${kbSize} KB)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <a href="${previewAttachment.data}" download="${escapeHtml(previewAttachment.name)}" class="btn" style="padding: 4px 10px; font-size: 0.8rem;" title="Download file">Download</a>
                <button id="btnRemovePreviewAttachment" class="btn-detach" title="Remove attachment">Remove</button>
            </div>
        `;
    }
    
    const removeBtn = document.getElementById('btnRemovePreviewAttachment');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            previewAttachment = 'DELETE';
            renderPreviewAttachment();
        });
    }
}

function openPreviewModal(clip) {
    activePreviewClipId = clip.id;
    if (DOM.txtPreviewText) {
        DOM.txtPreviewText.value = clip.text;
    }
    
    if (clip.imageData) {
        previewAttachment = { type: 'image', data: clip.imageData };
    } else if (clip.fileData) {
        previewAttachment = { type: 'file', ...clip.fileData };
    } else {
        previewAttachment = null;
    }
    
    renderPreviewAttachment();
    
    if (DOM.fullPagePreviewModal) {
        DOM.fullPagePreviewModal.classList.remove('hidden');
    }
}

function closePreviewModal() {
    activePreviewClipId = null;
    previewAttachment = null;
    if (DOM.fullPagePreviewModal) {
        DOM.fullPagePreviewModal.classList.add('hidden');
    }
}

// ==========================================
// 🚀 EVENT LISTENERS & INITIALIZATION
// ==========================================

// Global Paste Event Listener (supports pasting images/files/text via Ctrl+V or OS paste)
document.addEventListener('paste', async (e) => {
    if (isAppLocked) return;
    
    const items = e.clipboardData?.items || [];
    let imageItem = null;
    let fileItem = null;
    
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            imageItem = item;
            break;
        } else if (item.kind === 'file') {
            fileItem = item;
        }
    }
    
    if (imageItem) {
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (file) {
            try {
                showToast("Compressing pasted image...");
                const compressedDataUrl = await compressImageToDataUrl(file, 128);
                
                if (DOM.fullPageEditorModal && !DOM.fullPageEditorModal.classList.contains('hidden')) {
                    editorAttachment = { type: 'image', data: compressedDataUrl };
                    renderEditorAttachment();
                    showToast("Image attached to clip");
                } else {
                    await createNewClip('', { type: 'image', data: compressedDataUrl });
                    showToast("Image clip saved from clipboard!");
                }
            } catch (err) {
                console.error("Paste image error:", err);
                showToast("Failed to process pasted image");
            }
        }
    } else if (fileItem) {
        e.preventDefault();
        const file = fileItem.getAsFile();
        if (file) {
            try {
                const fileObj = await readDocumentFile(file, 128);
                
                if (DOM.fullPageEditorModal && !DOM.fullPageEditorModal.classList.contains('hidden')) {
                    editorAttachment = { type: 'file', ...fileObj };
                    renderEditorAttachment();
                    showToast("File attached to clip");
                } else {
                    await createNewClip('', { type: 'file', ...fileObj });
                    showToast("File clip saved from clipboard!");
                }
            } catch (err) {
                console.error("Paste file error:", err);
                showToast(err.message || "File size exceeds 128KB limit!");
            }
        }
    }
});

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
// 🔍 EXPANDABLE TOP BAR SEARCH LISTENERS
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
        editorAttachment = null;
        renderEditorAttachment();
        if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.remove('hidden');
        if (DOM.txtFullPageEditor) {
            DOM.txtFullPageEditor.value = '';
            DOM.txtFullPageEditor.focus();
        }
    });
}

// Editor Attachment Actions
if (DOM.btnAttachImage) {
    DOM.btnAttachImage.addEventListener('click', () => {
        DOM.inputEditorImage?.click();
    });
}

if (DOM.inputEditorImage) {
    DOM.inputEditorImage.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                showToast("Compressing image...");
                const compressedDataUrl = await compressImageToDataUrl(file, 128);
                editorAttachment = { type: 'image', data: compressedDataUrl };
                renderEditorAttachment();
                showToast("Image attached (compressed <128KB)");
            } catch (err) {
                console.error("Image error:", err);
                showToast("Failed to process image");
            }
        }
        e.target.value = '';
    });
}

if (DOM.btnAttachFile) {
    DOM.btnAttachFile.addEventListener('click', () => {
        DOM.inputEditorFile?.click();
    });
}

if (DOM.inputEditorFile) {
    DOM.inputEditorFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const fileObj = await readDocumentFile(file, 128);
                editorAttachment = { type: 'file', ...fileObj };
                renderEditorAttachment();
                showToast("File attached (" + Math.round(file.size / 1024) + " KB)");
            } catch (err) {
                console.error("File error:", err);
                showToast(err.message || "File size exceeds 128KB limit!");
            }
        }
        e.target.value = '';
    });
}

// Full Page Editor: Close Button
if (DOM.btnCloseFullPageEditor) {
    DOM.btnCloseFullPageEditor.addEventListener('click', () => {
        editorAttachment = null;
        renderEditorAttachment();
        if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.add('hidden');
    });
}

// Full Page Editor: Paste Button (Supports text & images)
if (DOM.btnFullEditorPaste) {
    DOM.btnFullEditorPaste.addEventListener('click', async () => {
        try {
            const content = await readClipboardContent();
            if (content) {
                if (content.type === 'image') {
                    editorAttachment = { type: 'image', data: content.data };
                    renderEditorAttachment();
                    showToast("Pasted image attached!");
                } else if (content.type === 'text') {
                    if (DOM.txtFullPageEditor) {
                        DOM.txtFullPageEditor.value = content.text;
                    }
                    showToast("Pasted text from clipboard!");
                }
            } else {
                showToast("Allow clipboard access or copy content first");
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
        if (text || editorAttachment) {
            await createNewClip(text, editorAttachment);
            if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.add('hidden');
        } else {
            showToast("Write text or attach a file first");
        }
    });
}

// FAB Bottom (Paste Icon): 1-Tap Automatic Paste & Immediate Save (Supports text & images)
if (DOM.btnFabQuickPaste) {
    DOM.btnFabQuickPaste.addEventListener('click', async () => {
        closeSearchOverlay();
        try {
            const content = await readClipboardContent();
            if (content) {
                if (content.type === 'image') {
                    await createNewClip('', { type: 'image', data: content.data });
                    showToast("Pasted image saved to clips!");
                } else if (content.type === 'text') {
                    await createNewClip(content.text);
                    showToast("Pasted clip saved!");
                }
            } else {
                showToast("Clipboard is empty or inaccessible!");
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
if (DOM.btnPreviewAttachImage) {
    DOM.btnPreviewAttachImage.addEventListener('click', () => {
        DOM.inputPreviewImage?.click();
    });
}

if (DOM.inputPreviewImage) {
    DOM.inputPreviewImage.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                showToast("Compressing image...");
                const compressedDataUrl = await compressImageToDataUrl(file, 128);
                previewAttachment = { type: 'image', data: compressedDataUrl };
                renderPreviewAttachment();
                showToast("Image attached (compressed <128KB)");
            } catch (err) {
                console.error("Image error:", err);
                showToast("Failed to process image");
            }
        }
        e.target.value = '';
    });
}

if (DOM.btnPreviewAttachFile) {
    DOM.btnPreviewAttachFile.addEventListener('click', () => {
        DOM.inputPreviewFile?.click();
    });
}

if (DOM.inputPreviewFile) {
    DOM.inputPreviewFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const fileObj = await readDocumentFile(file, 128);
                previewAttachment = { type: 'file', ...fileObj };
                renderPreviewAttachment();
                showToast("File attached (" + Math.round(file.size / 1024) + " KB)");
            } catch (err) {
                console.error("File error:", err);
                showToast(err.message || "File size exceeds 128KB limit!");
            }
        }
        e.target.value = '';
    });
}

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
        if (activePreviewClipId) {
            await updateClip(activePreviewClipId, text, previewAttachment);
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
