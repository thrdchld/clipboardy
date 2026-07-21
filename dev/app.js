import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, collection, query, limit, addDoc, deleteDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
export let isGuestRoom = false;

export let clipsArray = [];
export let unsubscribeClips = null;
export let isAppLocked = true;
export let isSearchMode = false;
export let activePreviewClipId = null;

// Realtime Device Authorization State
export let currentDeviceId = getOrCreateDeviceId();
export let unsubscribeRoomRequests = null;
export let unsubscribeMyRequest = null;
export let activePendingRequestId = null;
let heartbeatInterval = null;

// Gboard-style Clip Creation Mode Tab State: 'text' | 'image' | 'file'
export let currentEditorTab = 'text';

// Attachments state
export let editorAttachment = null;
export let previewAttachment = null;

// Undo / Redo History Stack (Max 50 actions)
export let undoStack = [];
export let redoStack = [];
const MAX_HISTORY = 50;

// DOM Elements
const DOM = {
    authScreen: document.getElementById('authScreen'),
    appScreen: document.getElementById('appScreen'),
    initialAuthContainer: document.getElementById('initialAuthContainer'),
    
    quickGoogleUserContainer: document.getElementById('quickGoogleUserContainer'),
    quickUserAvatar: document.getElementById('quickUserAvatar'),
    quickUserName: document.getElementById('quickUserName'),
    quickUserEmail: document.getElementById('quickUserEmail'),
    quickUserShortName: document.getElementById('quickUserShortName'),
    btnQuickContinueGoogle: document.getElementById('btnQuickContinueGoogle'),
    
    roomNameInput: document.getElementById('roomNameInput'),
    loginBtn: document.getElementById('loginBtn'),
    btnGoogleLogin: document.getElementById('btnGoogleLogin'),
    btnGoogleLoginText: document.getElementById('btnGoogleLoginText'),
    
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
    
    btnToggleUndoRedo: document.getElementById('btnToggleUndoRedo'),
    undoRedoPopup: document.getElementById('undoRedoPopup'),
    btnDoUndo: document.getElementById('btnDoUndo'),
    btnDoRedo: document.getElementById('btnDoRedo'),
    undoSubtext: document.getElementById('undoSubtext'),
    redoSubtext: document.getElementById('redoSubtext'),
    
    clipGrid: document.getElementById('clipGrid'),
    emptyState: document.getElementById('emptyState'),
    
    fabContainer: document.getElementById('fabContainer'),
    btnFabEditor: document.getElementById('btnFabEditor'),
    btnFabQuickPaste: document.getElementById('btnFabQuickPaste'),
    
    fullPageEditorModal: document.getElementById('fullPageEditorModal'),
    btnCloseFullPageEditor: document.getElementById('btnCloseFullPageEditor'),
    
    tabTypeText: document.getElementById('tabTypeText'),
    tabTypeImage: document.getElementById('tabTypeImage'),
    tabTypeFile: document.getElementById('tabTypeFile'),
    panelTypeText: document.getElementById('panelTypeText'),
    inputEditorImage: document.getElementById('inputEditorImage'),
    inputEditorFile: document.getElementById('inputEditorFile'),
    editorAttachmentPreview: document.getElementById('editorAttachmentPreview'),
    btnFullEditorPaste: document.getElementById('btnFullEditorPaste'),
    btnFullEditorSend: document.getElementById('btnFullEditorSend'),
    txtFullPageEditor: document.getElementById('txtFullPageEditor'),
    
    fullPagePreviewModal: document.getElementById('fullPagePreviewModal'),
    btnClosePreviewModal: document.getElementById('btnClosePreviewModal'),
    inputPreviewImage: document.getElementById('inputPreviewImage'),
    inputPreviewFile: document.getElementById('inputPreviewFile'),
    previewAttachmentDisplay: document.getElementById('previewAttachmentDisplay'),
    btnPreviewCopy: document.getElementById('btnPreviewCopy'),
    btnPreviewDelete: document.getElementById('btnPreviewDelete'),
    btnPreviewSave: document.getElementById('btnPreviewSave'),
    txtPreviewText: document.getElementById('txtPreviewText'),
    
    waitingApprovalModal: document.getElementById('waitingApprovalModal'),
    waitingRoomName: document.getElementById('waitingRoomName'),
    btnCancelWaitingRequest: document.getElementById('btnCancelWaitingRequest'),
    
    accessRequestModal: document.getElementById('accessRequestModal'),
    requestingDeviceName: document.getElementById('requestingDeviceName'),
    btnApproveAccessRequest: document.getElementById('btnApproveAccessRequest'),
    btnDenyAccessRequest: document.getElementById('btnDenyAccessRequest'),
    
    toast: document.getElementById('toast')
};

function getOrCreateDeviceId() {
    let id = localStorage.getItem('clipboardy_device_id');
    if (!id) {
        id = 'dev_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('clipboardy_device_id', id);
    }
    return id;
}

function getDeviceName() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "Android Device";
    if (/iPhone|iPad/i.test(ua)) return "iOS Device";
    if (/Macintosh/i.test(ua)) return "Mac Browser";
    if (/Windows/i.test(ua)) return "Windows PC";
    return "Web Browser";
}

function getStartOfTodayWibMs() {
    const now = new Date();
    const wibOffsetMs = 7 * 60 * 60 * 1000;
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibDate = new Date(utcMs + wibOffsetMs);
    wibDate.setHours(0, 0, 0, 0);
    return wibDate.getTime() - wibOffsetMs;
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read blob"));
        reader.readAsDataURL(blob);
    });
}

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

export async function compressImageToDataUrl(file, maxKb = 128) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
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

export async function readDocumentFile(file, maxKb = 128) {
    const maxBytes = maxKb * 1024;
    if (file.size > maxBytes) {
        const kbSize = Math.round(file.size / 1024);
        throw new Error(`File size (${kbSize} KB) exceeds limit of ${maxKb} KB!`);
    }
    
    const dataUrl = await readBlobAsDataUrl(file);
    return {
        fileName: file.name || 'document',
        fileSize: file.size || dataUrl.length,
        mimeType: file.type || 'application/octet-stream',
        data: dataUrl
    };
}

export async function readClipboardContent() {
    if (navigator.clipboard && navigator.clipboard.read) {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    try {
                        const blob = await item.getType(imageType);
                        const file = new File([blob], "pasted-image.jpg", { type: imageType });
                        const compressedDataUrl = await compressImageToDataUrl(file, 128);
                        return { kind: 'image', data: compressedDataUrl };
                    } catch (e) {}
                }
                
                for (const type of item.types) {
                    if (type === 'text/plain') {
                        try {
                            const blob = await item.getType('text/plain');
                            const text = await blob.text();
                            if (text && text.trim()) {
                                return { kind: 'text', text: text.trim() };
                            }
                        } catch (e) {}
                    } else if (!type.includes('html')) {
                        try {
                            const blob = await item.getType(type);
                            const file = new File([blob], `pasted-file`, { type: type });
                            const fileObj = await readDocumentFile(file, 128);
                            return { kind: 'file', ...fileObj };
                        } catch (e) {}
                    }
                }
            }
        } catch (err) {
            console.warn("navigator.clipboard.read fallback:", err);
        }
    }
    
    if (navigator.clipboard && navigator.clipboard.readText) {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                return { kind: 'text', text: text.trim() };
            }
        } catch (err) {
            console.warn("navigator.clipboard.readText fallback:", err);
        }
    }
    
    return null;
}

// ==========================================
// ↺ UNDO & REDO HISTORY SYSTEM (Max 50 Actions)
// ==========================================
export function pushHistoryAction(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    redoStack = [];
    updateUndoRedoUI();
}

export function updateUndoRedoUI() {
    if (DOM.btnDoUndo) {
        DOM.btnDoUndo.disabled = undoStack.length === 0;
    }
    if (DOM.undoSubtext) {
        if (undoStack.length > 0) {
            const last = undoStack[undoStack.length - 1];
            DOM.undoSubtext.textContent = `${last.title} (${undoStack.length}/${MAX_HISTORY})`;
        } else {
            DOM.undoSubtext.textContent = "No actions";
        }
    }
    
    if (DOM.btnDoRedo) {
        DOM.btnDoRedo.disabled = redoStack.length === 0;
    }
    if (DOM.redoSubtext) {
        if (redoStack.length > 0) {
            const last = redoStack[redoStack.length - 1];
            DOM.redoSubtext.textContent = `${last.title} (${redoStack.length})`;
        } else {
            DOM.redoSubtext.textContent = "No actions";
        }
    }
}

export async function performUndo() {
    if (undoStack.length === 0) {
        showToast("Nothing to undo");
        return;
    }
    
    const action = undoStack.pop();
    redoStack.push(action);
    updateUndoRedoUI();
    
    try {
        if (action.type === 'ADD') {
            const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', action.clipId);
            await deleteDoc(docRef);
            showToast("Undone: Created clip removed");
        } else if (action.type === 'DELETE') {
            const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', action.clipId);
            await setDoc(docRef, {
                text: action.beforeState.text || '',
                timestamp: serverTimestamp(),
                userId: action.beforeState.userId || 'guest',
                imageData: action.beforeState.imageData || null,
                fileData: action.beforeState.fileData || null
            });
            showToast("Undone: Clip restored");
        } else if (action.type === 'UPDATE') {
            const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', action.clipId);
            await updateDoc(docRef, {
                text: action.beforeState.text || '',
                timestamp: serverTimestamp(),
                imageData: action.beforeState.imageData || null,
                fileData: action.beforeState.fileData || null
            });
            showToast("Undone: Clip changes reverted");
        }
    } catch (err) {
        console.error("Undo error:", err);
        showToast("Undo failed: " + (err.message || err));
    }
}

export async function performRedo() {
    if (redoStack.length === 0) {
        showToast("Nothing to redo");
        return;
    }
    
    const action = redoStack.pop();
    undoStack.push(action);
    updateUndoRedoUI();
    
    try {
        if (action.type === 'ADD') {
            const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', action.clipId);
            await setDoc(docRef, {
                text: action.afterState.text || '',
                timestamp: serverTimestamp(),
                userId: action.afterState.userId || 'guest',
                imageData: action.afterState.imageData || null,
                fileData: action.afterState.fileData || null
            });
            showToast("Redone: Clip re-added");
        } else if (action.type === 'DELETE') {
            const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', action.clipId);
            await deleteDoc(docRef);
            showToast("Redone: Clip deleted again");
        } else if (action.type === 'UPDATE') {
            const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', action.clipId);
            await updateDoc(docRef, {
                text: action.afterState.text || '',
                timestamp: serverTimestamp(),
                imageData: action.afterState.imageData || null,
                fileData: action.afterState.fileData || null
            });
            showToast("Redone: Clip updated");
        }
    } catch (err) {
        console.error("Redo error:", err);
        showToast("Redo failed: " + (err.message || err));
    }
}

// Global Keyboard Shortcut Listener
document.addEventListener('keydown', (e) => {
    if (isAppLocked) return;
    
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;
    
    const activeElem = document.activeElement;
    const isTypingInTextarea = activeElem && (activeElem.tagName === 'TEXTAREA' || activeElem.tagName === 'INPUT');
    const key = e.key.toLowerCase();
    
    if ((key === 'z' && e.shiftKey) || key === 'y') {
        if (!isTypingInTextarea) {
            e.preventDefault();
            performRedo();
        }
    } else if (key === 'z' && !e.shiftKey) {
        if (!isTypingInTextarea) {
            e.preventDefault();
            performUndo();
        }
    }
});

// ==========================================
// 🔒 LOCK & SCREEN MANAGEMENT
// ==========================================
export function lockApp() {
    isAppLocked = true;
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (unsubscribeClips) {
        unsubscribeClips();
        unsubscribeClips = null;
    }
    if (unsubscribeRoomRequests) {
        unsubscribeRoomRequests();
        unsubscribeRoomRequests = null;
    }
    if (unsubscribeMyRequest) {
        unsubscribeMyRequest();
        unsubscribeMyRequest = null;
    }
    
    if (DOM.appScreen) DOM.appScreen.classList.add('hidden');
    if (DOM.authScreen) DOM.authScreen.classList.remove('hidden');
    
    renderSavedGoogleUser();
}

export function unlockApp() {
    isAppLocked = false;
    if (DOM.authScreen) DOM.authScreen.classList.add('hidden');
    if (DOM.appScreen) DOM.appScreen.classList.remove('hidden');
    
    startClipsRealtimeSync();
    if (isGuestRoom) {
        listenForIncomingAccessRequests();
        startDeviceHeartbeat();
    }
}

function renderSavedGoogleUser() {
    const savedStr = localStorage.getItem('last_google_user');
    if (savedStr) {
        try {
            const savedUser = JSON.parse(savedStr);
            if (DOM.quickGoogleUserContainer) DOM.quickGoogleUserContainer.classList.remove('hidden');
            if (DOM.quickUserAvatar) DOM.quickUserAvatar.src = savedUser.photoURL || 'https://via.placeholder.com/40';
            if (DOM.quickUserName) DOM.quickUserName.textContent = savedUser.displayName || 'Google User';
            if (DOM.quickUserEmail) DOM.quickUserEmail.textContent = savedUser.email || '';
            if (DOM.quickUserShortName) DOM.quickUserShortName.textContent = (savedUser.displayName || 'User').split(' ')[0];
            if (DOM.btnGoogleLoginText) DOM.btnGoogleLoginText.textContent = "Sign in with Another Google Account";
        } catch (e) {
            console.error("Error parsing saved Google user:", e);
        }
    } else {
        if (DOM.quickGoogleUserContainer) DOM.quickGoogleUserContainer.classList.add('hidden');
        if (DOM.btnGoogleLoginText) DOM.btnGoogleLoginText.textContent = "Sign in with Google";
    }
}

// Device Heartbeat for Guest Room active status
function startDeviceHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
        if (!isAppLocked && isGuestRoom && currentRoomHash) {
            try {
                const roomRef = doc(db, 'guestRooms', currentRoomHash);
                await setDoc(roomRef, {
                    activeDeviceId: currentDeviceId,
                    lastActiveTime: serverTimestamp()
                }, { merge: true });
            } catch (e) {}
        }
    }, 2 * 60 * 1000);
}

// ==========================================
// 🤝 GUEST ROOM REALTIME MULTI-DEVICE AUTHORIZATION
// ==========================================

async function handleGuestRoomLogin(rawCode) {
    const roomCode = (rawCode || '').trim();
    if (!roomCode) {
        showToast("Please enter a Room Code!");
        return;
    }
    
    isGuestRoom = true;
    currentRoomHash = await hashPassword('guest_room_' + roomCode.toLowerCase());
    
    if (DOM.headerTitleText) DOM.headerTitleText.textContent = `Room: ${roomCode}`;
    
    if (!auth.currentUser) {
        try {
            const cred = await signInAnonymously(auth);
            currentUser = cred.user;
        } catch (err) {
            console.error("Anonymous auth error:", err);
            showToast("Failed to authenticate: " + err.message);
            return;
        }
    }
    
    const roomRef = doc(db, 'guestRooms', currentRoomHash);
    
    try {
        const roomDocSnap = await getDoc(roomRef);
        const nowMs = Date.now();
        
        // If room does NOT exist OR Device B is already registered active device -> Grant access immediately!
        if (!roomDocSnap.exists() || (roomDocSnap.data().activeDeviceId === currentDeviceId)) {
            await setDoc(roomRef, {
                roomCode: roomCode,
                activeDeviceId: currentDeviceId,
                activeDeviceName: getDeviceName(),
                lastActiveTime: serverTimestamp()
            }, { merge: true });
            unlockApp();
            return;
        }
        
        const roomData = roomDocSnap.data();
        const lastActiveMs = getTimeMs(roomData.lastActiveTime);
        const isDeviceAActive = (nowMs - lastActiveMs) < (5 * 60 * 1000); // 5 minutes activity window
        
        if (!isDeviceAActive) {
            // Device A went offline -> Device B takes over
            await setDoc(roomRef, {
                roomCode: roomCode,
                activeDeviceId: currentDeviceId,
                activeDeviceName: getDeviceName(),
                lastActiveTime: serverTimestamp()
            }, { merge: true });
            unlockApp();
            return;
        }
        
        // Device A is actively online -> Create access request for Device A
        const requestRef = doc(db, 'guestRooms', currentRoomHash, 'requests', currentDeviceId);
        await setDoc(requestRef, {
            deviceId: currentDeviceId,
            deviceName: getDeviceName(),
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        if (DOM.waitingRoomName) DOM.waitingRoomName.textContent = roomCode;
        if (DOM.waitingApprovalModal) DOM.waitingApprovalModal.classList.remove('hidden');
        
        if (unsubscribeMyRequest) unsubscribeMyRequest();
        unsubscribeMyRequest = onSnapshot(requestRef, async (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            
            if (data.status === 'approved') {
                if (DOM.waitingApprovalModal) DOM.waitingApprovalModal.classList.add('hidden');
                if (unsubscribeMyRequest) unsubscribeMyRequest();
                
                await setDoc(roomRef, {
                    roomCode: roomCode,
                    activeDeviceId: currentDeviceId,
                    activeDeviceName: getDeviceName(),
                    lastActiveTime: serverTimestamp()
                }, { merge: true });
                
                showToast("Access granted by active device!");
                unlockApp();
            } else if (data.status === 'denied') {
                if (DOM.waitingApprovalModal) DOM.waitingApprovalModal.classList.add('hidden');
                if (unsubscribeMyRequest) unsubscribeMyRequest();
                showToast("Access denied by active device.");
            }
        });
        
    } catch (err) {
        console.error("Guest room authorization error:", err);
        unlockApp();
    }
}

function listenForIncomingAccessRequests() {
    if (!currentRoomHash || !isGuestRoom) return;
    
    const requestsRef = collection(db, 'guestRooms', currentRoomHash, 'requests');
    if (unsubscribeRoomRequests) unsubscribeRoomRequests();
    
    unsubscribeRoomRequests = onSnapshot(requestsRef, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            if (data.status === 'pending' && data.deviceId !== currentDeviceId) {
                activePendingRequestId = change.doc.id;
                if (DOM.requestingDeviceName) DOM.requestingDeviceName.textContent = data.deviceName || 'Device';
                if (DOM.accessRequestModal) DOM.accessRequestModal.classList.remove('hidden');
            }
        });
    });
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
        const startOfTodayWib = getStartOfTodayWibMs();
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const clipTs = getTimeMs(data.timestamp);
            
            if (isGuestRoom && clipTs < startOfTodayWib) {
                return;
            }
            
            clipsArray.push({
                id: docSnap.id,
                text: data.text || data.content || '',
                timestamp: data.timestamp,
                imageData: data.imageData || null,
                fileData: data.fileData || null,
                userId: data.userId || 'guest'
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

// GBOARD-STYLE DISCRETE CLIP CREATION:
// Each clip is strictly ONE item type: Text OR Image OR File.
async function createNewClip(text, attachment = null, trackHistory = true) {
    if (!currentRoomHash) {
        showToast("Room is required!");
        return;
    }
    
    const payload = {
        timestamp: serverTimestamp(),
        userId: auth.currentUser ? auth.currentUser.uid : 'guest',
        text: '',
        imageData: null,
        fileData: null
    };

    if (attachment && (attachment.kind === 'image' || attachment.type === 'image')) {
        payload.imageData = attachment.data;
    } else if (attachment && (attachment.kind === 'file' || attachment.type === 'file')) {
        payload.fileData = {
            name: attachment.fileName || attachment.name || 'file',
            size: attachment.fileSize || attachment.size || 0,
            type: attachment.mimeType || attachment.type || 'application/octet-stream',
            data: attachment.data
        };
    } else if (text && text.trim()) {
        payload.text = text.trim();
    } else {
        showToast("Write text or select a file first!");
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
        
        const newDocRef = await addDoc(notesRef, payload);
        
        if (trackHistory) {
            pushHistoryAction({
                type: 'ADD',
                clipId: newDocRef.id,
                afterState: payload,
                title: payload.imageData ? 'Image Clip' : (payload.fileData ? 'File Clip' : 'Text Clip')
            });
        }
        
        if (DOM.txtFullPageEditor) {
            DOM.txtFullPageEditor.value = '';
        }
        editorAttachment = null;
        renderEditorAttachment();
        
        showToast(payload.imageData ? "Image clip saved!" : (payload.fileData ? "File clip saved!" : "Text clip saved!"));
    } catch (err) {
        console.error("Failed to save clip:", err);
        showToast("Failed to save clip: " + (err.message || err));
    } finally {
        if (DOM.syncIndicator) DOM.syncIndicator.classList.remove('saving');
    }
}

async function updateClip(clipId, newText, attachment = null, trackHistory = true) {
    if (!clipId) return;
    try {
        const docRef = doc(db, 'clipboards', currentRoomHash, 'notes', clipId);
        
        const payload = {
            timestamp: serverTimestamp(),
            text: '',
            imageData: null,
            fileData: null
        };
        
        if (attachment === 'DELETE') {
            payload.text = (newText || '').trim();
        } else if (attachment && (attachment.kind === 'image' || attachment.type === 'image')) {
            payload.imageData = attachment.data;
        } else if (attachment && (attachment.kind === 'file' || attachment.type === 'file')) {
            payload.fileData = {
                name: attachment.fileName || attachment.name || 'file',
                size: attachment.fileSize || attachment.size || 0,
                type: attachment.mimeType || attachment.type || 'application/octet-stream',
                data: attachment.data
            };
        } else if (newText && newText.trim()) {
            payload.text = newText.trim();
        }
        
        if (trackHistory) {
            const existingClip = clipsArray.find(c => c.id === clipId);
            if (existingClip) {
                pushHistoryAction({
                    type: 'UPDATE',
                    clipId: clipId,
                    beforeState: {
                        text: existingClip.text,
                        imageData: existingClip.imageData,
                        fileData: existingClip.fileData
                    },
                    afterState: payload,
                    title: 'Edit Clip'
                });
            }
        }
        
        await updateDoc(docRef, payload);
        showToast("Clip updated!");
    } catch (err) {
        console.error("Failed to update clip:", err);
        showToast("Failed to update clip: " + (err.message || err));
    }
}

async function deleteClip(clipId, trackHistory = true) {
    try {
        if (trackHistory) {
            const targetClip = clipsArray.find(c => c.id === clipId);
            if (targetClip) {
                pushHistoryAction({
                    type: 'DELETE',
                    clipId: clipId,
                    beforeState: {
                        text: targetClip.text,
                        imageData: targetClip.imageData,
                        fileData: targetClip.fileData,
                        userId: targetClip.userId
                    },
                    title: 'Delete Clip'
                });
            }
        }
        
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
                    fileData: data.fileData || null,
                    userId: data.userId || 'guest'
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
    if (DOM.fabContainer) DOM.fabContainer.classList.remove('hidden');
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
                    : "Use the (+) button at bottom right to add a text/image/file clip, or tap the Paste button to save directly from system clipboard.";
            }
        }
        return;
    }
    
    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');
    
    clipsList.forEach(clip => {
        const card = document.createElement('div');
        card.className = 'clip-card';
        
        const timeStr = formatTime(clip.timestamp);
        
        let contentHtml = '';
        if (clip.imageData) {
            contentHtml = `<img src="${clip.imageData}" class="clip-card-attachment-thumb" alt="Image Clip">`;
        } else if (clip.fileData) {
            const kbSize = Math.round((clip.fileData.size || 0) / 1024);
            contentHtml = `
                <div class="clip-card-attachment-file">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    <span>${escapeHtml(clip.fileData.name)} (${kbSize} KB)</span>
                </div>
            `;
        } else {
            contentHtml = `<div class="clip-text">${escapeHtml(clip.text || '(Empty Clip)')}</div>`;
        }
        
        card.innerHTML = `
            <div class="clip-body" title="Click to view full clip">
                ${contentHtml}
                <div class="clip-meta">${timeStr}</div>
            </div>
            <div class="clip-actions">
                <button class="btn-copy" aria-label="Copy clip content">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy
                </button>
                <button class="btn-delete-clip" title="Delete clip" aria-label="Delete clip">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-copy') || e.target.closest('.btn-delete-clip')) {
                return;
            }
            openPreviewModal(clip);
        });
        
        const copyBtn = card.querySelector('.btn-copy');
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                let textToCopy = clip.text;
                if (clip.imageData) textToCopy = clip.imageData;
                else if (clip.fileData) textToCopy = clip.fileData.data || clip.fileData.name;
                
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
        
        const delBtn = card.querySelector('.btn-delete-clip');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteClip(clip.id);
        });
        
        DOM.clipGrid.appendChild(card);
    });
}

// Gboard Tab Switcher Handler (Text vs Image vs File)
function setEditorTab(tabType) {
    currentEditorTab = tabType;
    
    if (DOM.tabTypeText) DOM.tabTypeText.classList.toggle('active', tabType === 'text');
    if (DOM.tabTypeImage) DOM.tabTypeImage.classList.toggle('active', tabType === 'image');
    if (DOM.tabTypeFile) DOM.tabTypeFile.classList.toggle('active', tabType === 'file');
    
    if (tabType === 'text') {
        if (DOM.panelTypeText) DOM.panelTypeText.classList.remove('hidden');
        if (DOM.editorAttachmentPreview) DOM.editorAttachmentPreview.classList.add('hidden');
        editorAttachment = null;
        if (DOM.txtFullPageEditor) DOM.txtFullPageEditor.focus();
    } else if (tabType === 'image') {
        if (DOM.panelTypeText) DOM.panelTypeText.classList.add('hidden');
        if (DOM.txtFullPageEditor) DOM.txtFullPageEditor.value = '';
        if (!editorAttachment || (editorAttachment.kind !== 'image' && editorAttachment.type !== 'image')) {
            DOM.inputEditorImage?.click();
        }
    } else if (tabType === 'file') {
        if (DOM.panelTypeText) DOM.panelTypeText.classList.add('hidden');
        if (DOM.txtFullPageEditor) DOM.txtFullPageEditor.value = '';
        if (!editorAttachment || (editorAttachment.kind !== 'file' && editorAttachment.type !== 'file')) {
            DOM.inputEditorFile?.click();
        }
    }
}

// Render Attachment Preview inside Editor Modal
function renderEditorAttachment() {
    if (!DOM.editorAttachmentPreview) return;
    
    if (!editorAttachment) {
        DOM.editorAttachmentPreview.classList.add('hidden');
        DOM.editorAttachmentPreview.innerHTML = '';
        return;
    }
    
    DOM.editorAttachmentPreview.classList.remove('hidden');
    if (DOM.panelTypeText) DOM.panelTypeText.classList.add('hidden');
    
    const attKind = editorAttachment.kind || editorAttachment.type;
    
    if (attKind === 'image') {
        DOM.editorAttachmentPreview.innerHTML = `
            <img src="${editorAttachment.data}" class="attachment-image-display" alt="Attached Image">
            <button id="btnRemoveEditorAttachment" class="btn-detach" title="Remove attachment">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Remove Image
            </button>
        `;
    } else if (attKind === 'file') {
        const name = editorAttachment.fileName || editorAttachment.name || 'document';
        const size = editorAttachment.fileSize || editorAttachment.size || 0;
        const kbSize = Math.round(size / 1024);
        DOM.editorAttachmentPreview.innerHTML = `
            <div class="attachment-file-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                <span class="attachment-file-name">${escapeHtml(name)} (${kbSize} KB)</span>
            </div>
            <button id="btnRemoveEditorAttachment" class="btn-detach" title="Remove attachment">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Remove File
            </button>
        `;
    }
    
    const removeBtn = document.getElementById('btnRemoveEditorAttachment');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            editorAttachment = null;
            renderEditorAttachment();
            setEditorTab('text');
        });
    }
}

// Render Attachment Preview inside Preview Modal
function renderPreviewAttachment() {
    if (!DOM.previewAttachmentDisplay) return;
    
    if (!previewAttachment || previewAttachment === 'DELETE') {
        DOM.previewAttachmentDisplay.classList.add('hidden');
        DOM.previewAttachmentDisplay.innerHTML = '';
        if (DOM.txtPreviewText) DOM.txtPreviewText.classList.remove('hidden');
        return;
    }
    
    DOM.previewAttachmentDisplay.classList.remove('hidden');
    if (DOM.txtPreviewText) DOM.txtPreviewText.classList.add('hidden');
    
    const attKind = previewAttachment.kind || previewAttachment.type;
    
    if (attKind === 'image') {
        DOM.previewAttachmentDisplay.innerHTML = `
            <img src="${previewAttachment.data}" class="attachment-image-display" alt="Attached Image">
            <div style="display: flex; gap: 8px; align-items: center;">
                <a href="${previewAttachment.data}" download="image-clip.jpg" class="btn" style="padding: 6px 12px; font-size: 0.82rem;" title="Download image">Download Image</a>
            </div>
        `;
    } else if (attKind === 'file') {
        const name = previewAttachment.fileName || previewAttachment.name || 'file';
        const size = previewAttachment.fileSize || previewAttachment.size || 0;
        const kbSize = Math.round(size / 1024);
        DOM.previewAttachmentDisplay.innerHTML = `
            <div class="attachment-file-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                <span class="attachment-file-name">${escapeHtml(name)} (${kbSize} KB)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <a href="${previewAttachment.data}" download="${escapeHtml(name)}" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.82rem;" title="Download file">Download File</a>
            </div>
        `;
    }
}

function openPreviewModal(clip) {
    activePreviewClipId = clip.id;
    
    if (clip.imageData) {
        previewAttachment = { kind: 'image', data: clip.imageData };
    } else if (clip.fileData) {
        previewAttachment = { kind: 'file', fileName: clip.fileData.name, fileSize: clip.fileData.size, mimeType: clip.fileData.type, data: clip.fileData.data };
    } else {
        previewAttachment = null;
        if (DOM.txtPreviewText) {
            DOM.txtPreviewText.value = clip.text || '';
        }
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

// Gboard Style Clip Type Tab Listeners
if (DOM.tabTypeText) DOM.tabTypeText.addEventListener('click', () => setEditorTab('text'));
if (DOM.tabTypeImage) DOM.tabTypeImage.addEventListener('click', () => setEditorTab('image'));
if (DOM.tabTypeFile) DOM.tabTypeFile.addEventListener('click', () => setEditorTab('file'));

// Image & File Input change handlers
if (DOM.inputEditorImage) {
    DOM.inputEditorImage.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                showToast("Compressing image...");
                const compressedDataUrl = await compressImageToDataUrl(file, 128);
                editorAttachment = { kind: 'image', data: compressedDataUrl };
                renderEditorAttachment();
                showToast("Image clip selected (<128KB)");
            } catch (err) {
                console.error("Image error:", err);
                showToast("Failed to process image");
                setEditorTab('text');
            }
        }
        e.target.value = '';
    });
}

if (DOM.inputEditorFile) {
    DOM.inputEditorFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const fileObj = await readDocumentFile(file, 128);
                editorAttachment = { kind: 'file', ...fileObj };
                renderEditorAttachment();
                showToast("File clip selected (" + Math.round((fileObj.fileSize || file.size) / 1024) + " KB)");
            } catch (err) {
                console.error("File error:", err);
                showToast(err.message || "File size exceeds 128KB limit!");
                setEditorTab('text');
            }
        }
        e.target.value = '';
    });
}

// Global Paste Event Listener
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
                    editorAttachment = { kind: 'image', data: compressedDataUrl };
                    renderEditorAttachment();
                    if (DOM.tabTypeImage) setEditorTab('image');
                    showToast("Pasted image clip");
                } else {
                    await createNewClip('', { kind: 'image', data: compressedDataUrl });
                    showToast("Pasted image saved to clipboard!");
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
                    editorAttachment = { kind: 'file', ...fileObj };
                    renderEditorAttachment();
                    if (DOM.tabTypeFile) setEditorTab('file');
                    showToast("Pasted file clip");
                } else {
                    await createNewClip('', { kind: 'file', ...fileObj });
                    showToast("Pasted file saved to clipboard!");
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

// Guest Room Login Handler
if (DOM.loginBtn) {
    DOM.loginBtn.addEventListener('click', async () => {
        const roomCode = (DOM.roomNameInput?.value || '').trim();
        await handleGuestRoomLogin(roomCode);
    });
}

// Google Sign In Handler
if (DOM.btnGoogleLogin) {
    DOM.btnGoogleLogin.addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            currentUser = result.user;
            isGuestRoom = false;
            
            currentRoomHash = await hashPassword('google_user_' + currentUser.uid);
            
            const userObj = {
                displayName: currentUser.displayName,
                email: currentUser.email,
                photoURL: currentUser.photoURL,
                uid: currentUser.uid
            };
            localStorage.setItem('last_google_user', JSON.stringify(userObj));
            
            if (DOM.headerTitleText) DOM.headerTitleText.textContent = currentUser.displayName || 'Google Clipboard';
            unlockApp();
        } catch (err) {
            console.error("Google sign in error:", err);
            showToast("Google sign in error: " + (err.message || err));
        }
    });
}

// Quick Resume Previous Google Account Button
if (DOM.btnQuickContinueGoogle) {
    DOM.btnQuickContinueGoogle.addEventListener('click', async () => {
        const savedStr = localStorage.getItem('last_google_user');
        if (!savedStr) return;
        try {
            const savedUser = JSON.parse(savedStr);
            isGuestRoom = false;
            currentRoomHash = await hashPassword('google_user_' + savedUser.uid);
            
            if (!auth.currentUser) {
                try {
                    const cred = await signInAnonymously(auth);
                    currentUser = cred.user;
                } catch (e) {}
            }
            
            if (DOM.headerTitleText) DOM.headerTitleText.textContent = savedUser.displayName || 'Google Clipboard';
            unlockApp();
        } catch (e) {
            console.error("Quick continue error:", e);
        }
    });
}

// Access Request Response Handlers
if (DOM.btnApproveAccessRequest) {
    DOM.btnApproveAccessRequest.addEventListener('click', async () => {
        if (activePendingRequestId && currentRoomHash) {
            const reqRef = doc(db, 'guestRooms', currentRoomHash, 'requests', activePendingRequestId);
            await updateDoc(reqRef, { status: 'approved' });
            if (DOM.accessRequestModal) DOM.accessRequestModal.classList.add('hidden');
            showToast("Device access approved!");
        }
    });
}

if (DOM.btnDenyAccessRequest) {
    DOM.btnDenyAccessRequest.addEventListener('click', async () => {
        if (activePendingRequestId && currentRoomHash) {
            const reqRef = doc(db, 'guestRooms', currentRoomHash, 'requests', activePendingRequestId);
            await updateDoc(reqRef, { status: 'denied' });
            if (DOM.accessRequestModal) DOM.accessRequestModal.classList.add('hidden');
            showToast("Device access denied.");
        }
    });
}

if (DOM.btnCancelWaitingRequest) {
    DOM.btnCancelWaitingRequest.addEventListener('click', () => {
        if (DOM.waitingApprovalModal) DOM.waitingApprovalModal.classList.add('hidden');
        if (unsubscribeMyRequest) unsubscribeMyRequest();
    });
}

// Lock button
if (DOM.btnLock) {
    DOM.btnLock.addEventListener('click', () => {
        closeSearchOverlay();
        if (DOM.undoRedoPopup) DOM.undoRedoPopup.classList.add('hidden');
        lockApp();
    });
}

// ==========================================
// 🔍 UNDO / REDO POPUP MENU LISTENERS
// ==========================================
if (DOM.btnToggleUndoRedo) {
    DOM.btnToggleUndoRedo.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSearchOverlay();
        if (DOM.undoRedoPopup) {
            DOM.undoRedoPopup.classList.toggle('hidden');
            updateUndoRedoUI();
        }
    });
}

if (DOM.btnDoUndo) {
    DOM.btnDoUndo.addEventListener('click', async (e) => {
        e.stopPropagation();
        await performUndo();
        if (DOM.undoRedoPopup) DOM.undoRedoPopup.classList.add('hidden');
    });
}

if (DOM.btnDoRedo) {
    DOM.btnDoRedo.addEventListener('click', async (e) => {
        e.stopPropagation();
        await performRedo();
        if (DOM.undoRedoPopup) DOM.undoRedoPopup.classList.add('hidden');
    });
}

// ==========================================
// 🔍 EXPANDABLE TOP BAR SEARCH LISTENERS
// ==========================================
if (DOM.btnOpenSearch) {
    DOM.btnOpenSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        if (DOM.undoRedoPopup) DOM.undoRedoPopup.classList.add('hidden');
        if (DOM.headerNormalView) DOM.headerNormalView.classList.add('hidden');
        if (DOM.headerSearchOverlay) DOM.headerSearchOverlay.classList.remove('hidden');
        if (DOM.fabContainer) DOM.fabContainer.classList.add('hidden');
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

// Global click listener to auto-close search bar, undo/redo popup
document.addEventListener('click', (e) => {
    if (DOM.headerSearchOverlay && !DOM.headerSearchOverlay.classList.contains('hidden')) {
        const isClickInsideSearch = DOM.headerSearchOverlay.contains(e.target);
        const isClickOpenSearchBtn = DOM.btnOpenSearch?.contains(e.target);
        if (!isClickInsideSearch && !isClickOpenSearchBtn) {
            closeSearchOverlay();
        }
    }
    
    if (DOM.undoRedoPopup && !DOM.undoRedoPopup.classList.contains('hidden')) {
        const isClickInsidePopup = DOM.undoRedoPopup.contains(e.target);
        const isClickToggleBtn = DOM.btnToggleUndoRedo?.contains(e.target);
        if (!isClickInsidePopup && !isClickToggleBtn) {
            DOM.undoRedoPopup.classList.add('hidden');
        }
    }
});

// ==========================================
// 🔘 2 FABs MECHANISM LISTENERS
// ==========================================

// FAB Top (+ Plus): Open Add Clip Modal (Default to Text Tab)
if (DOM.btnFabEditor) {
    DOM.btnFabEditor.addEventListener('click', () => {
        closeSearchOverlay();
        if (DOM.undoRedoPopup) DOM.undoRedoPopup.classList.add('hidden');
        editorAttachment = null;
        renderEditorAttachment();
        if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.remove('hidden');
        setEditorTab('text');
        if (DOM.txtFullPageEditor) {
            DOM.txtFullPageEditor.value = '';
            DOM.txtFullPageEditor.focus();
        }
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

// Full Page Editor: Paste Button
if (DOM.btnFullEditorPaste) {
    DOM.btnFullEditorPaste.addEventListener('click', async () => {
        try {
            const content = await readClipboardContent();
            if (content) {
                const kind = content.kind || content.type;
                if (kind === 'image') {
                    editorAttachment = { kind: 'image', data: content.data };
                    renderEditorAttachment();
                    setEditorTab('image');
                    showToast("Pasted image clip!");
                } else if (kind === 'file') {
                    editorAttachment = { kind: 'file', ...content };
                    renderEditorAttachment();
                    setEditorTab('file');
                    showToast("Pasted file clip!");
                } else if (kind === 'text') {
                    editorAttachment = null;
                    renderEditorAttachment();
                    setEditorTab('text');
                    if (DOM.txtFullPageEditor) {
                        DOM.txtFullPageEditor.value = content.text;
                    }
                    showToast("Pasted text clip!");
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

// Full Page Editor: Save Button
if (DOM.btnFullEditorSend) {
    DOM.btnFullEditorSend.addEventListener('click', async () => {
        const text = (DOM.txtFullPageEditor?.value || '').trim();
        if (editorAttachment || text) {
            await createNewClip(text, editorAttachment);
            if (DOM.fullPageEditorModal) DOM.fullPageEditorModal.classList.add('hidden');
        } else {
            showToast("Write text or select a file first");
        }
    });
}

// FAB Bottom (Paste Icon): 1-Tap Automatic Paste & Immediate Save
if (DOM.btnFabQuickPaste) {
    DOM.btnFabQuickPaste.addEventListener('click', async () => {
        closeSearchOverlay();
        if (DOM.undoRedoPopup) DOM.undoRedoPopup.classList.add('hidden');
        try {
            const content = await readClipboardContent();
            if (content) {
                const kind = content.kind || content.type;
                if (kind === 'image') {
                    await createNewClip('', { kind: 'image', data: content.data });
                    showToast("Pasted image saved to clipboard!");
                } else if (kind === 'file') {
                    await createNewClip('', { kind: 'file', ...content });
                    showToast("Pasted file saved to clipboard!");
                } else if (kind === 'text') {
                    await createNewClip(content.text);
                    showToast("Pasted text saved to clipboard!");
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

if (DOM.btnClosePreviewModal) {
    DOM.btnClosePreviewModal.addEventListener('click', () => {
        closePreviewModal();
    });
}

if (DOM.btnPreviewCopy) {
    DOM.btnPreviewCopy.addEventListener('click', async () => {
        let textToCopy = DOM.txtPreviewText?.value || '';
        if (previewAttachment && (previewAttachment.kind === 'image' || previewAttachment.type === 'image')) textToCopy = previewAttachment.data;
        else if (previewAttachment && (previewAttachment.kind === 'file' || previewAttachment.type === 'file')) textToCopy = previewAttachment.data || previewAttachment.fileName || previewAttachment.name;
        
        try {
            await navigator.clipboard.writeText(textToCopy);
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

// Initial Auth State Check
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    }
    renderSavedGoogleUser();
});
