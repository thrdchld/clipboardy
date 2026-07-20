import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp, collection, query, where, deleteDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let appLockPasswordHash = null;

let folders = [{ id: 'default', name: 'General' }];
let currentFolderId = 'default';
let notesArray = []; 
let editingFolderId = null;
let isSelectingFolders = false;
let selectedFoldersForDeletion = new Set();

let unsubscribeNotes = null;
let unsubscribeFolders = null;

let isAppLocked = true;
let viewMode = 'active'; // 'active' atau 'trash'
let isPinnedCollapsed = localStorage.getItem('isPinnedCollapsed') === 'true';
let searchQuery = '';
let ignoreBlur = false;

let autoLockTimer = null;
let strictLockEnabled = localStorage.getItem('strictLockEnabled') !== 'false';
let idleLockEnabled = localStorage.getItem('idleLockEnabled') === 'true';
let idleLockMinutes = parseInt(localStorage.getItem('idleLockMinutes')) || 5;

// URL parameters parsing for resetLockPassword
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') === 'resetLockPassword') {
    localStorage.setItem('resetLockPasswordPending', 'true');
    window.history.replaceState({}, document.title, window.location.pathname);
}

const saveTimeouts = new Map(); // Debounce map per note ID

// DOM Elements
const DOM = {
    authScreen: document.getElementById('authScreen'),
    appScreen: document.getElementById('appScreen'),
    roomNameInput: document.getElementById('roomNameInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginBtn: document.getElementById('loginBtn'),
    
    sidebar: document.querySelector('.sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    btnMobileMenu: document.getElementById('btnMobileMenu'),
    btnToggleLayout: document.getElementById('btnToggleLayout'),
    layoutIconList: document.getElementById('layoutIconList'),
    layoutIconGrid: document.getElementById('layoutIconGrid'),
    mobileEditorTitle: document.getElementById('mobileEditorTitle'),
    

    strictLockToggle: document.getElementById('strictLockToggle'),
    idleLockToggle: document.getElementById('idleLockToggle'),
    btnIdleTimeout: document.getElementById('btnSettingsIdleTimeout'),
    timeoutDropdown: document.getElementById('timeoutDropdown'),
    btnOpenLockSettings: document.getElementById('btnOpenLockSettings'),
    appLockSettingsModal: document.getElementById('appLockSettingsModal'),
    btnCloseLockSettings: document.getElementById('btnCloseLockSettings'),

    settingsIdleTimeoutText: document.getElementById('settingsIdleTimeoutText'),
    clipGrid: document.getElementById('clipGrid'),
    emptyState: document.getElementById('emptyState'),
    folderList: document.getElementById('folderList'),
    btnAddFolder: document.getElementById('btnAddFolder'),
    btnSelectFolders: document.getElementById('btnSelectFolders'),
    
    btnAddNote: document.getElementById('btnAddNote'),
    btnAddNoteMobile: document.getElementById('btnAddNoteMobile'),
    btnAddNoteHeader: document.getElementById('btnAddNoteHeader'),
    btnEmptyTrashMobile: document.getElementById('btnEmptyTrashMobile'),
    btnGoogleLogin: document.getElementById('btnGoogleLogin'),
    initialAuthContainer: document.getElementById('initialAuthContainer'),
    googleLockedContainer: document.getElementById('googleLockedContainer'),
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
    
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    btnLock: document.getElementById('btnLock'),
    btnOpenChangePassword: document.getElementById('btnOpenChangePassword'),
    changeLockPasswordModal: document.getElementById('changeLockPasswordModal'),
    btnCancelChangePassword: document.getElementById('btnCancelChangePassword'),
    changeConfirmPassword: document.getElementById('changeConfirmPassword'),
    sidebarGuestWarning: document.getElementById('sidebarGuestWarning'),
    btnForgotPassword: document.getElementById('btnForgotPassword'),
    btnChangeModalForgotPassword: document.getElementById('btnChangeModalForgotPassword'),
    btnResetData: document.getElementById('btnResetData'),
    changeOldPassword: document.getElementById('changeOldPassword'),
    changeNewPassword: document.getElementById('changeNewPassword'),
    btnSubmitChangePassword: document.getElementById('btnSubmitChangePassword'),

    sidebarProfileCard: document.getElementById('sidebarProfileCard'),
    sidebarAvatar: document.getElementById('sidebarAvatar'),
    sidebarUserName: document.getElementById('sidebarUserName'),
    sidebarUserEmail: document.getElementById('sidebarUserEmail'),
    profileModal: document.getElementById('profileModal'),
    profileModalAvatar: document.getElementById('profileModalAvatar'),
    profileModalName: document.getElementById('profileModalName'),
    profileModalEmail: document.getElementById('profileModalEmail'),
    profileModalBadge: document.getElementById('profileModalBadge'),
    profileModalRoomId: document.getElementById('profileModalRoomId'),
    profileModalAuthType: document.getElementById('profileModalAuthType'),
    btnSignOut: document.getElementById('btnSignOut'),
    btnCloseProfile: document.getElementById('btnCloseProfile'),
    btnToggleTrash: document.getElementById('btnToggleTrash'),
    btnEmptyTrash: document.getElementById('btnEmptyTrash'),
    btnToggleTrashText: document.getElementById('btnToggleTrashText'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    syncIndicator: document.getElementById('syncIndicator'),
    
    toast: document.getElementById('toast'),
    btnQuickPaste: document.getElementById('btnQuickPaste'),
    tabNotes: document.getElementById('tabNotes'),
    tabFolders: document.getElementById('tabFolders'),
    tabTrash: document.getElementById('tabTrash'),
    tabSettings: document.getElementById('tabSettings'),
    quickInputContainer: document.getElementById('quickInputContainer'),
    btnQuickInputPaste: document.getElementById('btnQuickInputPaste'),
    txtQuickInput: document.getElementById('txtQuickInput'),
    btnQuickInputAttach: document.getElementById('btnQuickInputAttach'),
    btnQuickInputSend: document.getElementById('btnQuickInputSend'),
    quickInputAttachDropdown: document.getElementById('quickInputAttachDropdown'),
    btnQuickAttachImage: document.getElementById('btnQuickAttachImage'),
    btnQuickAttachDoc: document.getElementById('btnQuickAttachDoc'),
    quickInputImageFile: document.getElementById('quickInputImageFile'),
    quickInputDocFile: document.getElementById('quickInputDocFile'),
    mobileFolderSelectorBackdrop: document.getElementById('mobileFolderSelectorBackdrop'),
    mobileFolderSelectorSheet: document.getElementById('mobileFolderSelectorSheet'),
    mobileFolderSelectorList: document.getElementById('mobileFolderSelectorList'),
    btnAddNewFolderMobile: document.getElementById('btnAddNewFolderMobile'),
    mobileSettingsBackdrop: document.getElementById('mobileSettingsBackdrop'),
    mobileSettingsSheet: document.getElementById('mobileSettingsSheet'),
    mobileSettingsAvatar: document.getElementById('mobileSettingsAvatar'),
    mobileSettingsName: document.getElementById('mobileSettingsName'),
    mobileSettingsEmail: document.getElementById('mobileSettingsEmail'),
    btnMobileSettingsLock: document.getElementById('btnMobileSettingsLock'),
    btnMobileSettingsChangePwd: document.getElementById('btnMobileSettingsChangePwd'),
    btnMobileSettingsReset: document.getElementById('btnMobileSettingsReset'),
    btnMobileSettingsTheme: document.getElementById('btnMobileSettingsTheme'),
    btnMobileSettingsSignOut: document.getElementById('btnMobileSettingsSignOut'),
    
    folderModal: document.getElementById('folderModal'),
    folderNameInput: document.getElementById('folderNameInput'),
    btnCancelFolder: document.getElementById('btnCancelFolder'),
    btnSaveFolder: document.getElementById('btnSaveFolder'),
    
    lightboxModal: document.getElementById('lightboxModal'),
    lightboxImage: document.getElementById('lightboxImage'),
    closeLightbox: document.getElementById('closeLightbox'),
    btnDownloadLightbox: document.getElementById('btnDownloadLightbox')
};

// Initialize settings state in DOM
DOM.strictLockToggle.checked = strictLockEnabled;
DOM.idleLockToggle.checked = idleLockEnabled;
updateIdleTimeoutVisibility();

// Initialize theme from localStorage on load
const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme === 'light') {
    document.documentElement.classList.add('light');
    if (DOM.themeIconSun) DOM.themeIconSun.classList.add('hidden');
    if (DOM.themeIconMoon) DOM.themeIconMoon.classList.remove('hidden');
} else {
    document.documentElement.classList.remove('light');
    if (DOM.themeIconSun) DOM.themeIconSun.classList.remove('hidden');
    if (DOM.themeIconMoon) DOM.themeIconMoon.classList.add('hidden');
}

if (DOM.btnThemeToggle) {
    DOM.btnThemeToggle.addEventListener('click', () => {
        const isLight = document.documentElement.classList.toggle('light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        if (isLight) {
            DOM.themeIconSun.classList.add('hidden');
            DOM.themeIconMoon.classList.remove('hidden');
        } else {
            DOM.themeIconSun.classList.remove('hidden');
            DOM.themeIconMoon.classList.add('hidden');
        }
    });
}

// Initialize layout mode from localStorage on load
let layoutMode = localStorage.getItem('layoutMode') || 'grid';
function updateLayoutModeUI() {
    if (!DOM.layoutIconList || !DOM.layoutIconGrid) return;
    if (layoutMode === 'grid') {
        DOM.layoutIconList.classList.remove('hidden');
        DOM.layoutIconGrid.classList.add('hidden');
    } else {
        DOM.layoutIconList.classList.add('hidden');
        DOM.layoutIconGrid.classList.remove('hidden');
    }
}
updateLayoutModeUI();

if (DOM.btnToggleLayout) {
    DOM.btnToggleLayout.addEventListener('click', () => {
        layoutMode = layoutMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('layoutMode', layoutMode);
        updateLayoutModeUI();
        renderGrid();
    });
}

function updateIdleTimeoutVisibility() {
    if (DOM.settingsIdleTimeoutText) {
        DOM.settingsIdleTimeoutText.textContent = idleLockMinutes >= 60 
            ? Math.floor(idleLockMinutes / 60) + " Hour" 
            : idleLockMinutes + " Min";
    }
    const durationSetting = document.getElementById('idleLockDurationSetting');
    if (durationSetting) {
        durationSetting.style.display = idleLockEnabled ? 'flex' : 'none';
    }
}

// ==========================================
// 🔒 AUTH & AUTO-LOCK
// ==========================================
let bypassLockChallenge = false;
let isImportingFromGuest = false;
let guestRoomHashToImport = null;

// Import guest notes/folders to Google Room
async function importGuestNotesToGoogle(googleUid) {
    if (!guestRoomHashToImport) return;
    
    try {
        const guestRoomHash = guestRoomHashToImport;
        const googleRoomHash = "google_" + googleUid;
        
        // 1. Fetch guest folders
        const guestRoomRef = doc(db, 'clipboards', guestRoomHash);
        const guestSnap = await getDoc(guestRoomRef);
        let guestFolders = [];
        if (guestSnap.exists() && guestSnap.data().folders) {
            guestFolders = guestSnap.data().folders;
        }
        
        // 2. Fetch guest notes
        const guestNotesRef = collection(db, 'clipboards', guestRoomHash, 'notes');
        const guestNotesSnap = await getDocs(guestNotesRef);
        
        if (guestFolders.length <= 1 && guestNotesSnap.empty) {
            guestRoomHashToImport = null;
            isImportingFromGuest = false;
            return;
        }
        
        const confirmImport = await showCustomConfirm(
            "Import Guest Notes",
            "We found folders/notes in your guest room. Would you like to import and merge them into your Google Account?",
            false
        );
        
        if (confirmImport) {
            showToast("Importing notes...");
            
            // 3. Merge folders
            const googleRoomRef = doc(db, 'clipboards', googleRoomHash);
            const googleSnap = await getDoc(googleRoomRef);
            let googleFolders = [{ id: 'default', name: 'General' }];
            if (googleSnap.exists() && googleSnap.data().folders) {
                googleFolders = googleSnap.data().folders;
            }
            
            guestFolders.forEach(guestFolder => {
                if (guestFolder.id === 'default') return;
                if (!googleFolders.find(f => f.name.toLowerCase() === guestFolder.name.toLowerCase())) {
                    googleFolders.push({
                        id: guestFolder.id,
                        name: guestFolder.name,
                        createdAt: guestFolder.createdAt || Date.now()
                    });
                }
            });
            
            await setDoc(googleRoomRef, { folders: googleFolders }, { merge: true });
            
            // 4. Copy notes
            for (const noteDoc of guestNotesSnap.docs) {
                const noteData = noteDoc.data();
                const newNoteRef = doc(db, 'clipboards', googleRoomHash, 'notes', noteDoc.id);
                await setDoc(newNoteRef, noteData);
            }
            
            showToast("Import successful! Notes transferred.");
        }
    } catch (err) {
        console.error("Failed to import notes", err);
        showToast("Import failed: " + err.message);
    } finally {
        guestRoomHashToImport = null;
        isImportingFromGuest = false;
    }
}

// Profile Update Logic
function updateProfileUI(user) {
    if (user && !user.isAnonymous) {
        // Google User
        if (DOM.sidebarProfileCard) DOM.sidebarProfileCard.style.display = 'flex';
        if (DOM.sidebarGuestWarning) DOM.sidebarGuestWarning.style.display = 'none';
        if (DOM.btnOpenChangePassword) DOM.btnOpenChangePassword.style.display = 'inline-flex';
        if (DOM.btnResetData) DOM.btnResetData.style.display = 'inline-flex';

        if (DOM.sidebarAvatar) DOM.sidebarAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
        if (DOM.sidebarUserName) DOM.sidebarUserName.textContent = user.displayName || 'Google User';
        if (DOM.sidebarUserEmail) DOM.sidebarUserEmail.textContent = user.email || 'Connected';
        
        if (DOM.profileModalAvatar) DOM.profileModalAvatar.src = user.photoURL || 'https://via.placeholder.com/64';
        if (DOM.profileModalName) DOM.profileModalName.textContent = user.displayName || 'Google User';
        if (DOM.profileModalEmail) DOM.profileModalEmail.textContent = user.email || 'Connected';
        if (DOM.profileModalBadge) {
            DOM.profileModalBadge.textContent = "Google Account";
            DOM.profileModalBadge.style.background = "var(--primary)";
            DOM.profileModalBadge.style.color = "white";
        }
        if (DOM.profileModalRoomId) {
            DOM.profileModalRoomId.textContent = user.uid.substring(0, 12) + "...";
            DOM.profileModalRoomId.title = user.uid;
        }
        if (DOM.profileModalAuthType) DOM.profileModalAuthType.textContent = "Google Sign-In";
    } else {
        // Guest User / Anonymous
        if (DOM.sidebarProfileCard) DOM.sidebarProfileCard.style.display = 'none';
        if (DOM.btnOpenChangePassword) DOM.btnOpenChangePassword.style.display = 'none';
        if (DOM.btnResetData) DOM.btnResetData.style.display = 'none';
        
        if (currentRoomHash && !isAppLocked) {
            if (DOM.sidebarGuestWarning) DOM.sidebarGuestWarning.style.display = 'flex';
        } else {
            if (DOM.sidebarGuestWarning) DOM.sidebarGuestWarning.style.display = 'none';
        }
    }
}

// Sign in with Google
async function loginWithGoogle() {
    if (!currentUser) return showToast("Connecting to database...");
    
    DOM.btnGoogleLogin.disabled = true;
    const originalText = DOM.btnGoogleLogin.innerHTML;
    DOM.btnGoogleLogin.textContent = "Signing in...";
    
    const provider = new GoogleAuthProvider();
    try {
        bypassLockChallenge = true;
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        currentRoomHash = "google_" + user.uid;
        
        await ensureRoomMetadata();
        
        if (isImportingFromGuest) {
            await importGuestNotesToGoogle(user.uid);
        }
        
        if (!appLockPasswordHash) {
            DOM.setupLockPasswordModal.classList.remove('hidden');
        } else {
            startFoldersSync();
            startNotesSync();
            
            isAppLocked = false;
            DOM.authScreen.classList.add('hidden');
            DOM.appScreen.classList.remove('hidden');
            
            updateProfileUI(user);
            resetAutoLockTimer();
            showToast("Logged in as " + user.displayName);
        }
    } catch (err) {
        console.error(err);
        bypassLockChallenge = false;
        showToast("Google login failed: " + err.message);
    } finally {
        DOM.btnGoogleLogin.disabled = false;
        DOM.btnGoogleLogin.innerHTML = originalText;
    }
}

// Log out and lock
async function handleSignOut() {
    if (currentUser && !currentUser.isAnonymous) {
        try {
            await signOut(auth);
            currentRoomHash = null;
            appLockPasswordHash = null;
            lockApp();
            updateProfileUI(null);
        } catch (err) {
            console.error(err);
            showToast("Sign out failed: " + err.message);
        }
    } else {
        currentRoomHash = null;
        lockApp();
        updateProfileUI(null);
        showToast("Guest session closed & locked");
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentUser = null;
        appLockPasswordHash = null;
        signInAnonymously(auth).catch(err => console.error("Anonymous authentication failed", err));
        updateProfileUI(null);
        return;
    }
    
    currentUser = user;
    if (!user.isAnonymous) {
        currentRoomHash = "google_" + user.uid;
        try {
            await ensureRoomMetadata();
            
            if (isImportingFromGuest) {
                await importGuestNotesToGoogle(user.uid);
            }
            
            if (bypassLockChallenge) {
                bypassLockChallenge = false;
                if (appLockPasswordHash) {
                    isAppLocked = false;
                    DOM.authScreen.classList.add('hidden');
                    DOM.appScreen.classList.remove('hidden');
                    startFoldersSync();
                    startNotesSync();
                    updateProfileUI(user);
                    resetAutoLockTimer();
                }
            } else {
                isAppLocked = true;
                DOM.initialAuthContainer.classList.add('hidden');
                DOM.googleLockedContainer.classList.remove('hidden');
                
                if (DOM.lockedUserAvatar) DOM.lockedUserAvatar.src = user.photoURL || 'https://via.placeholder.com/64';
                if (DOM.lockedUserName) DOM.lockedUserName.textContent = user.displayName || 'Google User';
                if (DOM.lockedUserEmail) DOM.lockedUserEmail.textContent = user.email || '';
                
                DOM.authScreen.classList.remove('hidden');
                DOM.appScreen.classList.add('hidden');
                updateProfileUI(user);
                
                if (!appLockPasswordHash) {
                    DOM.setupLockPasswordModal.classList.remove('hidden');
                } else {
                    DOM.lockPasswordInput.focus();
                }
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to load user space: " + err.message);
        }

    } else {
        updateProfileUI(null);
        if (isAppLocked || !currentRoomHash) {
            DOM.initialAuthContainer.classList.remove('hidden');
            DOM.googleLockedContainer.classList.add('hidden');
            DOM.authScreen.classList.remove('hidden');
            DOM.appScreen.classList.add('hidden');
        }
    }
});

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

// Strict lock with Grace Period (10 seconds)
let strictLockTimer = null;
const GRACE_PERIOD_MS = 10000;

function checkStrictLock() {
    if (ignoreBlur) return;
    if (!isAppLocked && strictLockEnabled) {
        clearTimeout(strictLockTimer);
        strictLockTimer = setTimeout(() => {
            lockApp();
        }, GRACE_PERIOD_MS);
    }
}

function cancelStrictLockTimer() {
    clearTimeout(strictLockTimer);
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        checkStrictLock();
    } else {
        cancelStrictLockTimer();
    }
});
window.addEventListener("pagehide", checkStrictLock);
window.addEventListener("pageshow", cancelStrictLockTimer);


function showCustomConfirm(title, message, isDangerous = false) {
    ignoreBlur = true;
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const confirmBtn = document.getElementById('confirmConfirmBtn');
        const iconEl = document.getElementById('confirmIcon');
        
        titleEl.textContent = title;
        msgEl.textContent = message;
        
        if (isDangerous) {
            confirmBtn.className = 'btn btn-primary btn-danger-confirm';
            iconEl.style.color = 'var(--danger)';
        } else {
            confirmBtn.className = 'btn btn-primary';
            iconEl.style.color = 'var(--primary)';
        }
        
        const cleanUp = () => {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            document.removeEventListener('keydown', onKeyDown);
            setTimeout(() => { ignoreBlur = false; }, 300);
        };
        const onCancel = () => { cleanUp(); resolve(false); };
        const onConfirm = () => { cleanUp(); resolve(true); };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        document.addEventListener('keydown', onKeyDown);
        modal.classList.remove('hidden');
    });
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
        
        if (currentUser && !currentUser.isAnonymous) {
            DOM.initialAuthContainer.classList.add('hidden');
            DOM.googleLockedContainer.classList.remove('hidden');
            
            if (DOM.lockedUserAvatar) DOM.lockedUserAvatar.src = currentUser.photoURL || 'https://via.placeholder.com/64';
            if (DOM.lockedUserName) DOM.lockedUserName.textContent = currentUser.displayName || 'Google User';
            if (DOM.lockedUserEmail) DOM.lockedUserEmail.textContent = currentUser.email || '';
            
            DOM.lockPasswordInput.value = '';
        } else {
            currentRoomHash = null;
            DOM.initialAuthContainer.classList.remove('hidden');
            DOM.googleLockedContainer.classList.add('hidden');
            DOM.passwordInput.value = '';
        }
        
        DOM.authScreen.classList.remove('hidden');
        updateProfileUI(currentUser);
    }, 100);
    
    showToast("Application locked");
    closeMobileSidebar();
}

async function login() {
    const roomName = DOM.roomNameInput ? DOM.roomNameInput.value.trim().toLowerCase().replace(/\s+/g, '') : '';
    const pwd = DOM.passwordInput.value.trim();
    
    if (!roomName) return showToast("Please enter a room name");
    if (!pwd) return showToast("Please enter a PIN");
    if (pwd.length !== 4) return showToast("PIN must be 4 digits");
    if (!currentUser) return showToast("Waiting for server connection...");

    DOM.loginBtn.textContent = "Joining...";
    DOM.loginBtn.disabled = true;

    try {
        currentRoomHash = await hashPassword(roomName + "_" + pwd);
        
        await ensureRoomMetadata();
        
        startFoldersSync();
        startNotesSync();
        
        isAppLocked = false;
        DOM.authScreen.classList.add('hidden');
        DOM.appScreen.classList.remove('hidden');
        DOM.passwordInput.value = ''; 
        if (DOM.roomNameInput) DOM.roomNameInput.value = '';
        
        updateProfileUI(currentUser);
        resetAutoLockTimer();
        showToast("Joined guest room: " + roomName);
    } catch (err) {
        console.error(err);
        showToast("Error: " + err.message);
    } finally {
        DOM.loginBtn.textContent = "Join Room";
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

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        DOM.sidebar.classList.remove('open');
        DOM.sidebarBackdrop.classList.add('hidden');
    }
});

// ==========================================
// 📡 DATABASE SYNC
// ==========================================

async function ensureRoomMetadata() {
    const roomRef = doc(db, 'clipboards', currentRoomHash);
    
    // Handle pending lock password reset
    if (localStorage.getItem('resetLockPasswordPending') === 'true') {
        try {
            await setDoc(roomRef, { lockPasswordHash: null }, { merge: true });
            localStorage.removeItem('resetLockPasswordPending');
            showToast("Lock password reset triggered");
        } catch (err) {
            console.error("Failed to reset lock password in Firestore:", err);
        }
    }
    
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
        const initialData = {
            folders: [{ id: 'default', name: 'General' }],
            createdAt: serverTimestamp()
        };
        await setDoc(roomRef, initialData);
        appLockPasswordHash = null;
    } else {
        const data = snap.data();
        appLockPasswordHash = data.lockPasswordHash || null;
    }
}

async function cleanupExpiredFolders() {
    const isGuest = !currentUser || currentUser.isAnonymous;
    const expirationPeriod = isGuest ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - expirationPeriod;
    
    let updatedFolders = [...folders];
    let changed = false;
    updatedFolders = updatedFolders.filter(f => {
        if (f.deleted && f.deletedAt && f.deletedAt < cutoffTime) {
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

async function cleanupExpiredNotes() {
    const isGuest = !currentUser || currentUser.isAnonymous;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    let expiredNotes = [];
    if (isGuest) {
        expiredNotes = notesArray.filter(n => n.updatedAt < oneDayAgo);
    } else {
        expiredNotes = notesArray.filter(n => n.deleted && n.deletedAt && n.deletedAt < thirtyDaysAgo);
    }

    for (const note of expiredNotes) {
        const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
        try {
            await deleteDoc(noteRef);
        } catch (err) {
            console.error("Failed to delete expired note", note.id, err);
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
            updateViewArchiveUI();
        }
    });
}


function startNotesSync() {
    if (unsubscribeNotes) unsubscribeNotes();
    
    const notesRef = collection(db, 'clipboards', currentRoomHash, 'notes');
    const q = viewMode === 'trash'
        ? query(notesRef)
        : query(notesRef, where('folderId', '==', currentFolderId));
    
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
    if (DOM.btnToggleTrash) DOM.btnToggleTrash.classList.remove('active');
    setActiveTab(viewMode === 'trash' ? 'tabTrash' : 'tabNotes');
    
    // Update dynamic header title
    const headerTitleEl = document.getElementById('headerTitleText');
    if (headerTitleEl) {
        if (viewMode === 'trash') {
            headerTitleEl.textContent = "Trash";
        } else {
            const currentFolder = folders.find(f => f.id === currentFolderId);
            headerTitleEl.textContent = currentFolder ? currentFolder.name : "Notes";
        }
    }
    
    if (viewMode === 'trash') {
        if (DOM.btnToggleTrash) {
            DOM.btnToggleTrashText.textContent = "Back to Last Folder";
            DOM.btnToggleTrash.classList.add('active');
        }
    } else {
        if (DOM.btnToggleTrash) {
            DOM.btnToggleTrashText.textContent = "Trash";
        }
    }

    if (DOM.btnEmptyTrash) {
        if (viewMode === 'trash') {
            DOM.btnEmptyTrash.classList.remove('hidden');
            DOM.btnEmptyTrash.style.display = 'inline-flex';
            if (DOM.btnAddNoteHeader) DOM.btnAddNoteHeader.style.display = 'none';
            if (DOM.btnAddNoteMobile) DOM.btnAddNoteMobile.style.display = 'none';
            if (DOM.btnEmptyTrashMobile) {
                DOM.btnEmptyTrashMobile.classList.remove('hidden');
                DOM.btnEmptyTrashMobile.style.display = '';
            }
        } else {
            DOM.btnEmptyTrash.classList.add('hidden');
            DOM.btnEmptyTrash.style.display = 'none';
            if (DOM.btnAddNoteHeader) DOM.btnAddNoteHeader.style.display = '';
            if (DOM.btnAddNoteMobile) DOM.btnAddNoteMobile.style.display = '';
            if (DOM.btnEmptyTrashMobile) {
                DOM.btnEmptyTrashMobile.classList.add('hidden');
                DOM.btnEmptyTrashMobile.style.display = 'none';
            }
        }
    }

    renderFolders();
}

function switchFolder(folderId) {
    currentFolderId = folderId;
    viewMode = 'active';
    setActiveTab('tabNotes');
    updateViewArchiveUI();
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
    const activeFolders = folders.filter(f => !f.deleted);
    if (activeFolders.length <= 1) {
        isSelectingFolders = false;
        if (DOM.btnSelectFolders) {
            DOM.btnSelectFolders.style.color = 'var(--text-muted)';
            DOM.btnSelectFolders.style.display = 'none';
        }
        if (DOM.btnAddFolder) {
            DOM.btnAddFolder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
            DOM.btnAddFolder.style.color = '';
            DOM.btnAddFolder.setAttribute('title', 'Add New Folder');
        }
    } else {
        if (DOM.btnSelectFolders) {
            DOM.btnSelectFolders.style.display = 'inline-flex';
        }
    }

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
        
        if (isSelectingFolders && f.id !== 'default') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedFoldersForDeletion.has(f.id);
            checkbox.style.pointerEvents = 'none'; // let the li handle click
            checkbox.style.marginRight = '8px';
            folderNameWrapper.prepend(checkbox);
            folderIcon.style.display = 'none';
        }

        if (f.id !== 'default' && !isSelectingFolders) {
            const actions = document.createElement('div');
            actions.className = 'folder-actions';
            
            const btnOptions = document.createElement('button');
            btnOptions.className = 'btn-folder-options';
            btnOptions.setAttribute('title', 'Folder Options');
            btnOptions.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
            
            const dropdown = document.createElement('div');
            dropdown.className = 'folder-dropdown';
            
            const btnEdit = document.createElement('button');
            btnEdit.className = 'folder-dropdown-item';
            btnEdit.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Rename`;
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                actions.classList.remove('open');
                editFolder(f.id, f.name);
            };
            
            const btnDel = document.createElement('button');
            btnDel.className = 'folder-dropdown-item danger';
            btnDel.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete`;
            btnDel.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                actions.classList.remove('open');
                deleteFolder(f.id);
            };
            
            dropdown.appendChild(btnEdit);
            dropdown.appendChild(btnDel);
            
            btnOptions.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.folder-dropdown.show').forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('show');
                        if (d.parentElement) d.parentElement.classList.remove('open');
                    }
                });
                const isShowing = dropdown.classList.toggle('show');
                actions.classList.toggle('open', isShowing);
            };
            
            actions.appendChild(btnOptions);
            actions.appendChild(dropdown);
            li.appendChild(actions);

            // Touch-and-hold (long press) logic
            let pressTimer;
            const clearTimer = () => clearTimeout(pressTimer);
            li.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    if (isMobile()) {
                        if (navigator.vibrate) navigator.vibrate(15);
                        closeMobileSidebar();
                        setTimeout(() => {
                            openMobileFolderActions(f);
                        }, 250);
                    } else {
                        document.querySelectorAll('.folder-dropdown.show').forEach(d => {
                            d.classList.remove('show');
                            if (d.parentElement) d.parentElement.classList.remove('open');
                        });
                        dropdown.classList.add('show');
                        actions.classList.add('open');
                    }
                }, 550); // 550ms long press
            });
            li.addEventListener('touchend', clearTimer);
            li.addEventListener('touchmove', clearTimer);
            li.addEventListener('touchcancel', clearTimer);
        }
        
        if (f.id === 'default' && !isSelectingFolders) {
            let pressTimer;
            const clearTimer = () => clearTimeout(pressTimer);
            li.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    showToast("General folder cannot be renamed or deleted");
                }, 500);
            });
            li.addEventListener('touchend', clearTimer);
            li.addEventListener('touchmove', clearTimer);
            li.addEventListener('touchcancel', clearTimer);
        }
        
        if (isSelectingFolders && f.id !== 'default') {
            li.onclick = (e) => {
                e.preventDefault();
                if (selectedFoldersForDeletion.has(f.id)) selectedFoldersForDeletion.delete(f.id);
                else selectedFoldersForDeletion.add(f.id);
                renderFolders();
            };
        } else {
            li.onclick = () => switchFolder(f.id);
        }
        
        li.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchFolder(f.id);
            }
        };
        DOM.folderList.appendChild(li);
    });
}

function editFolder(folderId, currentName) {
    editingFolderId = folderId;
    DOM.folderModal.querySelector('h3').textContent = "Edit Folder";
    DOM.folderModal.classList.remove('hidden');
    DOM.folderNameInput.value = currentName;
    DOM.folderNameInput.focus();
}

async function saveNewFolder() {
    const name = DOM.folderNameInput.value.trim();
    if (!name) return;
    
    if (editingFolderId) {
        folders = folders.map(f => f.id === editingFolderId ? { ...f, name } : f);
        DOM.folderModal.classList.add('hidden');
        DOM.folderNameInput.value = '';
        
        try {
            const roomRef = doc(db, 'clipboards', currentRoomHash);
            await setDoc(roomRef, { folders }, { merge: true });
            if (currentFolderId === editingFolderId) updateViewArchiveUI();
            else renderFolders();
        } catch(err) {
            showToast("Failed to edit folder");
        }
        editingFolderId = null;
    } else {
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
}

async function deleteFolder(folderId) {
    if (!await showCustomConfirm("Move Folder to Trash", "Move this folder and its notes to Trash?", true)) return;
    
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
    if (!textarea) return;
    textarea.style.height = '100%';
    textarea.style.overflowY = 'auto';
}

function renderGrid() {
    if (isAppLocked) return;
    
    // Save active note textarea focus & caret state
    let activeNoteId = null;
    let caretStart = 0;
    let caretEnd = 0;
    if (document.activeElement && 
        document.activeElement.classList.contains('card-body') && 
        document.activeElement.dataset.noteId) {
        activeNoteId = document.activeElement.dataset.noteId;
        caretStart = document.activeElement.selectionStart;
        caretEnd = document.activeElement.selectionEnd;
    }
    
    DOM.clipGrid.innerHTML = "";
    
    if (viewMode === 'trash') {
        const trashFolders = folders.filter(f => f.deleted && f.name.toLowerCase().includes(searchQuery));
        const trashNotes = notesArray.filter(n => n.deleted && n.text.toLowerCase().includes(searchQuery));
        
        if (trashFolders.length === 0 && trashNotes.length === 0) {
            DOM.emptyState.classList.remove('hidden');
            DOM.emptyState.querySelector('h3').textContent = "Trash is empty";
            DOM.emptyState.querySelector('p').textContent = "Deleted notes and folders will appear here for 30 days.";
            DOM.clipGrid.innerHTML = "";
            return;
        } else {
            DOM.emptyState.classList.add('hidden');
        }
        
        DOM.clipGrid.innerHTML = `<div id="trashGrid" class="grid"></div>`;
        const trashGrid = DOM.clipGrid.querySelector('#trashGrid');
        
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
                            Delete
                        </button>
                    </div>
                </div>
            `;
            
            card.querySelector('.restore-folder-btn').onclick = () => restoreFolder(f.id);
            card.querySelector('.delete-folder-perm-btn').onclick = () => deleteFolderPermanently(f.id);
            trashGrid.appendChild(card);
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
            
            const documentHtml = item.document ? `
                <div class="card-document-wrapper" style="margin-top: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-base); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.85em; font-weight: 500;">
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex-grow: 1;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span class="document-name" style="overflow: hidden; text-overflow: ellipsis; opacity: 0.8;" title="${item.documentName}">${item.documentName || 'Document'}</span>
                    </div>
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
                ${documentHtml}
                <textarea class="card-body" readonly aria-label="Note Content" style="opacity: 0.8; cursor: not-allowed;">${item.text}</textarea>
                <div class="card-footer">
                    <div class="card-actions" style="justify-content: space-between; width: 100%;">
                        <button class="action-btn restore-note-btn" style="display:inline-flex; align-items:center; gap:4px; font-weight: 600;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            Restore
                        </button>
                        <button class="action-btn del delete-note-perm-btn" style="display:inline-flex; align-items:center; gap:4px;">
                            Delete
                        </button>
                    </div>
                </div>
            `;
            
            const textInput = card.querySelector('.card-body');
            setTimeout(() => resizeTextarea(textInput), 0);
            
            card.querySelector('.restore-note-btn').onclick = () => restoreNote(item.id);
            card.querySelector('.delete-note-perm-btn').onclick = () => deleteNotePermanently(item.id);
            trashGrid.appendChild(card);
        });
        
        return;
    }
    
    DOM.emptyState.querySelector('h3').textContent = "No notes yet";
    DOM.emptyState.querySelector('p').textContent = 'Click "+ New Note" to start writing in this folder.';
    
    // Filter active notes
    let filtered = notesArray.filter(n => {
        const matchesFolder = n.folderId === currentFolderId;
        const matchesView = !n.deleted;
        const matchesSearch = n.text.toLowerCase().includes(searchQuery) || (n.title && n.title.toLowerCase().includes(searchQuery));
        return matchesFolder && matchesView && matchesSearch;
    });

    filtered.sort((a, b) => {
        if (a.pinned === b.pinned) return (b.updatedAt || 0) - (a.updatedAt || 0);
        return a.pinned ? -1 : 1;
    });

    if (filtered.length === 0) {
        DOM.emptyState.classList.remove('hidden');
        DOM.clipGrid.innerHTML = "";
        return;
    } else {
        DOM.emptyState.classList.add('hidden');
    }

    const pinnedNotes = filtered.filter(n => n.pinned);
    const otherNotes = filtered.filter(n => !n.pinned);

    let pinnedGrid, othersGrid;

    if (pinnedNotes.length > 0) {
        DOM.clipGrid.innerHTML = `
            <div class="section-container" style="width: 100%; margin-bottom: 24px;">
                <div class="section-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">
                    <span style="font-size: 0.8rem; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted);">PINNED</span>
                    <button class="btn-accordion-toggle" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; padding: 4px 8px; border-radius: var(--radius-sm); transition: background 0.2s;">
                        <span>${isPinnedCollapsed ? 'Show' : 'Hide'}</span>
                        <svg class="toggle-icon" style="transition: transform 0.2s; ${isPinnedCollapsed ? 'transform: rotate(-90deg);' : ''}" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <div id="pinnedGrid" class="grid ${isPinnedCollapsed ? 'hidden' : ''} ${layoutMode === 'list' ? 'list-view' : 'grid-view'}"></div>
            </div>
            <div class="section-container" style="width: 100%;">
                <div class="section-header" style="margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px;">
                    <span style="font-size: 0.8rem; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted);">OTHERS</span>
                </div>
                <div id="othersGrid" class="grid ${layoutMode === 'list' ? 'list-view' : 'grid-view'}"></div>
            </div>
        `;
        pinnedGrid = DOM.clipGrid.querySelector('#pinnedGrid');
        othersGrid = DOM.clipGrid.querySelector('#othersGrid');

        const toggleBtn = DOM.clipGrid.querySelector('.btn-accordion-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isPinnedCollapsed = !isPinnedCollapsed;
                localStorage.setItem('isPinnedCollapsed', isPinnedCollapsed);
                renderGrid();
            });
        }
    } else {
        DOM.clipGrid.innerHTML = `
            <div id="othersGrid" class="grid ${layoutMode === 'list' ? 'list-view' : 'grid-view'}" style="width: 100%;"></div>
        `;
        othersGrid = DOM.clipGrid.querySelector('#othersGrid');
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = `card ${item.pinned ? 'pinned' : ''} color-${item.color || 'default'}`;
        
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

        const documentHtml = item.document ? `
            <div class="card-document-wrapper" style="margin-top: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-base); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.85em; font-weight: 500;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex-grow: 1;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary); flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <span class="document-name" style="overflow: hidden; text-overflow: ellipsis;" title="${item.documentName}">${item.documentName || 'Document'}</span>
                </div>
                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                    <button class="btn-download-document" title="Download Document" aria-label="Download Document" style="background: none; border: none; cursor: pointer; color: var(--text-muted); display: inline-flex; align-items: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button class="btn-remove-document" title="Delete Document" aria-label="Delete Document" style="background: none; border: none; cursor: pointer; color: var(--danger); display: inline-flex; align-items: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
        ` : '';

        const hasAttachment = item.image || item.document;
        const attachmentBtnHtml = hasAttachment ? '' : `
            <div class="attachment-btn-container" style="position: relative; display: inline-block;">
                <button class="action-btn attachment-btn" title="Add Attachment" aria-label="Add Attachment" style="display:inline-flex; align-items:center; justify-content:center; padding: 6px 10px; gap: 6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    Attachment
                </button>
                <div class="attachment-dropdown hidden" style="position: absolute; bottom: 100%; right: 0; margin-bottom: 6px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-md); z-index: 100; min-width: 140px; display: flex; flex-direction: column; overflow: hidden; padding: 4px 0;">
                    <button class="dropdown-item opt-add-image" style="background: none; border: none; padding: 8px 12px; font-size: 0.85em; font-weight: 500; text-align: left; cursor: pointer; color: var(--text-main); display: flex; align-items: center; gap: 8px; width: 100%;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        Media/Image
                    </button>
                    <button class="dropdown-item opt-add-document" style="background: none; border: none; padding: 8px 12px; font-size: 0.85em; font-weight: 500; text-align: left; cursor: pointer; color: var(--text-main); display: flex; align-items: center; gap: 8px; width: 100%;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        Document
                    </button>
                </div>
            </div>
            <input type="file" class="card-image-input" accept="image/*" style="display: none;" aria-label="Upload Image">
            <input type="file" class="card-document-input" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.csv" style="display: none;" aria-label="Upload Document">
        `;

        const moveDropdownItems = folders.filter(f => f.id !== currentFolderId).map(f => `
            <button class="dropdown-item opt-move-note" data-folder-id="${f.id}" style="background: none; border: none; padding: 8px 12px; font-size: 0.85em; font-weight: 500; text-align: left; cursor: pointer; color: var(--text-main); width: 100%; transition: background 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${f.name}
            </button>
        `).join('');

        const moveSelectHtml = folders.length > 1 ? `
            <div class="move-dropdown-container" style="position: relative; display: inline-block;">
                <span class="badge move-btn" role="button" tabindex="0" aria-label="Move Note" style="display:inline-flex; align-items:center; gap:4px;">
                    Move...
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
                <div class="move-dropdown hidden" style="position: absolute; top: 100%; left: 0; margin-top: 6px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-md); z-index: 110; min-width: 140px; display: flex; flex-direction: column; overflow: hidden; padding: 4px 0;">
                    <div style="padding: 6px 12px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); border-bottom: 1px solid var(--border); margin-bottom: 4px; letter-spacing: 0.5px; text-transform: uppercase;">Move to...</div>
                    ${moveDropdownItems}
                </div>
            </div>
        ` : '';

        const titleHtml = `
            <div class="card-title-container">
                <input type="text" class="card-title-field" data-note-id="${item.id}" placeholder="Title" value="${item.title || ''}">
            </div>
        `;

        const colorPickerHtml = `
            <div class="color-palette-container">
                <button class="action-btn color-btn" title="Change Color" aria-label="Change Color" style="display:inline-flex; align-items:center; justify-content:center; padding: 6px 10px; gap: 6px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a7 7 0 0 0-7 7c0 2.38 2 6 7 13 5-7 7-10.62 7-13a7 7 0 0 0-7-7z"></path></svg>
                    Color
                </button>
                <div class="color-palette-dropdown hidden">
                    <button class="color-dot default" data-color="default" title="Default"></button>
                    <button class="color-dot red" data-color="red" title="Red"></button>
                    <button class="color-dot orange" data-color="orange" title="Orange"></button>
                    <button class="color-dot yellow" data-color="yellow" title="Yellow"></button>
                    <button class="color-dot green" data-color="green" title="Green"></button>
                    <button class="color-dot teal" data-color="teal" title="Teal"></button>
                    <button class="color-dot blue" data-color="blue" title="Blue"></button>
                    <button class="color-dot darkblue" data-color="darkblue" title="Dark Blue"></button>
                    <button class="color-dot purple" data-color="purple" title="Purple"></button>
                    <button class="color-dot pink" data-color="pink" title="Pink"></button>
                    <button class="color-dot brown" data-color="brown" title="Brown"></button>
                    <button class="color-dot gray" data-color="gray" title="Gray"></button>
                </div>
            </div>
        `;

        card.innerHTML = `
            <div class="card-header">
                <div class="card-badges">
                    <span class="badge pin-btn ${item.pinned ? 'active-pin' : ''}" role="button" tabindex="0" aria-label="${item.pinned ? 'Unpin Note' : 'Pin Note'}" style="display:inline-flex; align-items:center; gap:4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.89A.5.5 0 0 0 6.36 14h11.28a.5.5 0 0 0 .25-.56l-1.78-.89a2 2 0 0 1-1.11-1.79V4H9v6.76zM8 4h8M10 2h4"/></svg>
                        ${item.pinned ? 'Pinned' : 'Pin'}
                    </span>
                    ${moveSelectHtml}
                </div>
            </div>
            ${titleHtml}
            ${imageHtml}
            ${documentHtml}
            <textarea class="card-body" data-note-id="${item.id}" placeholder="Note" aria-label="Note Content">${item.text}</textarea>
            <div class="card-footer">
                <div class="card-stats">
                    <span class="card-date">${dateStr}</span>
                    <span class="word-count">${countWordsAndChars(item.text)}</span>
                </div>
                <div class="card-actions">
                    ${colorPickerHtml}
                    ${attachmentBtnHtml}
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
        
        const titleInput = card.querySelector('.card-title-field');
        const textInput = card.querySelector('.card-body');
        const wordCountDisplay = card.querySelector('.word-count');
        
        if (isMobile()) {
            titleInput.setAttribute('readonly', 'true');
            titleInput.style.cursor = 'pointer';
            textInput.setAttribute('readonly', 'true');
            textInput.style.cursor = 'pointer';
        } else {
            titleInput.addEventListener('input', (e) => {
                item.title = e.target.value;
                item.updatedAt = Date.now();
                triggerNoteAutoSave(item);
            });
        }
        
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

        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
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

        card.querySelector('.del-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (await showCustomConfirm("Move to Trash", "Move this note to Trash? It will be automatically deleted after 30 days.", false)) {
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
            const moveBtn = card.querySelector('.move-btn');
            const moveDropdown = card.querySelector('.move-dropdown');
            
            moveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns
                document.querySelectorAll('.move-dropdown, .attachment-dropdown, .color-palette-dropdown').forEach(d => {
                    if (d !== moveDropdown) d.classList.add('hidden');
                });
                moveDropdown.classList.toggle('hidden');
            });

            card.querySelectorAll('.opt-move-note').forEach(opt => {
                opt.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const targetFolderId = opt.getAttribute('data-folder-id');
                    if (targetFolderId) {
                        item.folderId = targetFolderId;
                        item.updatedAt = Date.now();
                        await forceSaveNoteToServer(item);
                        renderGrid();
                        showToast("Note moved!");
                    }
                });
            });
        }

        // Color Picker events
        const colorBtn = card.querySelector('.color-btn');
        const colorDropdown = card.querySelector('.color-palette-dropdown');
        if (colorBtn && colorDropdown) {
            colorBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns
                document.querySelectorAll('.move-dropdown, .attachment-dropdown, .color-palette-dropdown').forEach(d => {
                    if (d !== colorDropdown) d.classList.add('hidden');
                });
                colorDropdown.classList.toggle('hidden');
            });
            
            colorDropdown.querySelectorAll('.color-dot').forEach(dot => {
                dot.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const chosenColor = dot.getAttribute('data-color');
                    item.color = chosenColor;
                    item.updatedAt = Date.now();
                    
                    // Instantly update card class for visual feedback
                    card.className = `card ${item.pinned ? 'pinned' : ''} color-${chosenColor}`;
                    
                    await forceSaveNoteToServer(item);
                    colorDropdown.classList.add('hidden');
                    showToast("Color updated!");
                });
            });
        }

        if (item.image) {
            // Lightbox viewer
            card.querySelector('.card-image').addEventListener('click', (e) => {
                if (!isMobile()) {
                    e.stopPropagation();
                    DOM.lightboxImage.src = item.image;
                    DOM.lightboxModal.classList.remove('hidden');
                }
            });

            // Remove image
            card.querySelector('.btn-remove-image').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showCustomConfirm("Delete Image", "Remove this image from the note permanently?", true)) {
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
        }
        
        if (item.document) {
            // Download document handler
            card.querySelector('.btn-download-document').addEventListener('click', (e) => {
                e.stopPropagation();
                downloadFile(item.document, item.documentName);
            });

            // Remove document
            card.querySelector('.btn-remove-document').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showCustomConfirm("Delete Document", "Remove this document from the note permanently?", true)) {
                    item.document = null;
                    item.documentName = null;
                    item.documentType = null;
                    item.updatedAt = Date.now();
                    forceSaveNoteToServer(item);
                    renderGrid();
                }
            });
        }

        if (!hasAttachment) {
            // Attachment dropdown toggle
            const attachmentBtn = card.querySelector('.attachment-btn');
            const attachmentDropdown = card.querySelector('.attachment-dropdown');
            const fileImageInput = card.querySelector('.card-image-input');
            const fileDocInput = card.querySelector('.card-document-input');
            const optAddImage = card.querySelector('.opt-add-image');
            const optAddDoc = card.querySelector('.opt-add-document');

            attachmentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.attachment-dropdown, .move-dropdown, .color-palette-dropdown').forEach(d => {
                    if (d !== attachmentDropdown) d.classList.add('hidden');
                });
                attachmentDropdown.classList.toggle('hidden');
            });

            // Upload Image choice
            optAddImage.addEventListener('click', () => {
                attachmentDropdown.classList.add('hidden');
                ignoreBlur = true;
                fileImageInput.click();
            });

            fileImageInput.addEventListener('cancel', () => {
                setTimeout(() => { ignoreBlur = false; }, 300);
            });

            fileImageInput.addEventListener('change', async (e) => {
                setTimeout(() => { ignoreBlur = false; }, 300);
                const file = e.target.files[0];
                if (!file) return;

                attachmentBtn.innerHTML = `Loading...`;
                attachmentBtn.disabled = true;

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
                    renderGrid();
                }
            });

            // Upload Document choice
            optAddDoc.addEventListener('click', () => {
                attachmentDropdown.classList.add('hidden');
                ignoreBlur = true;
                fileDocInput.click();
            });

            fileDocInput.addEventListener('cancel', () => {
                setTimeout(() => { ignoreBlur = false; }, 300);
            });

            fileDocInput.addEventListener('change', async (e) => {
                setTimeout(() => { ignoreBlur = false; }, 300);
                const file = e.target.files[0];
                if (!file) return;

                attachmentBtn.innerHTML = `Loading...`;
                attachmentBtn.disabled = true;

                try {
                    if (file.size > 2 * 1024 * 1024) {
                        throw new Error("File size cannot exceed 2MB.");
                    }

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            item.document = event.target.result;
                            item.documentName = file.name;
                            item.documentType = file.type;
                            item.updatedAt = Date.now();
                            await forceSaveNoteToServer(item);
                            renderGrid();
                            showToast("Document uploaded successfully!");
                        } catch (err) {
                            showToast(err.message || "Failed to save document.");
                            renderGrid();
                        }
                    };
                    reader.onerror = () => {
                        showToast("Failed to read document file.");
                        renderGrid();
                    };
                    reader.readAsDataURL(file);
                } catch (err) {
                    console.error(err);
                    showToast(err.message || "Failed to process document.");
                    renderGrid();
                }
            });
        }

        if (isMobile()) {
            bindMobileCardEvents(card, item);
        }

        if (item.pinned && pinnedNotes.length > 0) {
            pinnedGrid.appendChild(card);
        } else {
            othersGrid.appendChild(card);
        }
    });

    // Restore active note textarea focus & caret state
    if (activeNoteId) {
        const selector = activeFieldType === 'title' 
            ? `.card-title-field[data-note-id="${activeNoteId}"]`
            : `textarea[data-note-id="${activeNoteId}"]`;
        const textInput = DOM.clipGrid.querySelector(selector);
        if (textInput) {
            textInput.focus();
            textInput.setSelectionRange(caretStart, caretEnd);
        }
    }
}

// ==========================================
// 🎮 GLOBAL EVENTS
// ==========================================
async function unlockGoogleRoom() {
    const pwd = DOM.lockPasswordInput.value.trim();
    if (!pwd) return;
    
    const hash = await hashPassword(pwd);
    if (hash === appLockPasswordHash) {
        startFoldersSync();
        startNotesSync();
        
        isAppLocked = false;
        DOM.authScreen.classList.add('hidden');
        DOM.appScreen.classList.remove('hidden');
        DOM.lockPasswordInput.value = '';
        
        resetAutoLockTimer();
        updateProfileUI(currentUser);
        showToast("Welcome back!");
    } else {
        showToast("Incorrect Lock Password");
        DOM.lockPasswordInput.value = '';
        DOM.lockPasswordInput.focus();
    }
}

async function saveLockPassword() {
    const pwd = DOM.newLockPassword.value.trim();
    const conf = DOM.confirmLockPassword.value.trim();
    if (!pwd) return showToast("Password cannot be empty");
    if (pwd !== conf) return showToast("Passwords do not match");
    
    try {
        const hash = await hashPassword(pwd);
        
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { lockPasswordHash: hash }, { merge: true });
        
        appLockPasswordHash = hash;
        DOM.setupLockPasswordModal.classList.add('hidden');
        DOM.newLockPassword.value = '';
        DOM.confirmLockPassword.value = '';
        
        startFoldersSync();
        startNotesSync();
        
        isAppLocked = false;
        DOM.authScreen.classList.add('hidden');
        DOM.appScreen.classList.remove('hidden');
        
        resetAutoLockTimer();
        updateProfileUI(currentUser);
        showToast("Lock password set successfully!");
    } catch (err) {
        console.error(err);
        showToast("Failed to save password: " + err.message);
    }
}



async function submitChangePassword() {
    const oldPwd = DOM.changeOldPassword.value.trim();
    const newPwd = DOM.changeNewPassword.value.trim();
    const confPwd = DOM.changeConfirmPassword.value.trim();
    
    if (!oldPwd || !newPwd || !confPwd) return showToast("Fields cannot be empty");
    if (newPwd !== confPwd) return showToast("New passwords do not match");
    
    const oldHash = await hashPassword(oldPwd);
    if (oldHash !== appLockPasswordHash) {
        return showToast("Current password incorrect");
    }
    try {
        const newHash = await hashPassword(newPwd);
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { lockPasswordHash: newHash }, { merge: true });
        
        appLockPasswordHash = newHash;
        DOM.changeOldPassword.value = '';
        DOM.changeNewPassword.value = '';
        DOM.changeConfirmPassword.value = '';
        DOM.changeLockPasswordModal.classList.add('hidden');
        DOM.profileModal.classList.remove('hidden'); // Return to profile modal
        showToast("Password updated successfully!");
    } catch (err) {
        console.error(err);
        showToast("Failed to update password: " + err.message);
    }
}

async function handleForgotPassword() {
    if (!currentUser || currentUser.isAnonymous) return;
    
    const isChangePwdOpen = !DOM.changeLockPasswordModal.classList.contains('hidden');
    if (isChangePwdOpen) {
        DOM.changeLockPasswordModal.classList.add('hidden');
    }
    
    const confirmReset = await showCustomConfirm(
        "Reset Lock Password",
        "Forgot your lock password? We will send a verification email to " + currentUser.email + " to help you reset it.",
        false
    );
    
    if (confirmReset) {
        try {
            await sendPasswordResetEmail(auth, currentUser.email);
            
            // Show successful email confirmation modal before logout
            await showCustomConfirm(
                "Email Sent",
                "A recovery link has been sent to " + currentUser.email + ". Please click the link inside the email to confirm, then return here to log in and set your new code.",
                false
            );
            
            await handleSignOut();
        } catch (err) {
            console.error("Failed to send reset email:", err);
            showToast("Failed to send email: " + err.message);
            if (isChangePwdOpen) {
                DOM.changeLockPasswordModal.classList.remove('hidden');
            }
        }
    } else {
        if (isChangePwdOpen) {
            DOM.changeLockPasswordModal.classList.remove('hidden');
        }
    }
}

async function resetRoomData() {
    const confirmDelete = await showCustomConfirm(
        "Reset Room Data", 
        "Are you sure you want to delete all notes and folders? This cannot be undone.", 
        true
    );
    if (!confirmDelete) return;
    
    try {
        for (const note of notesArray) {
            const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
            await deleteDoc(noteRef);
        }
        
        const roomRef = doc(db, 'clipboards', currentRoomHash);
        await setDoc(roomRef, { 
            folders: [{ id: 'default', name: 'General' }] 
        }, { merge: true });
        
        DOM.profileModal.classList.add('hidden');
        showToast("Workspace database reset successfully");
    } catch (err) {
        console.error(err);
        showToast("Failed to reset workspace: " + err.message);
    }
}


DOM.loginBtn.addEventListener('click', login);
if (DOM.roomNameInput) {
    DOM.roomNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            DOM.passwordInput.focus();
        }
    });
}
DOM.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });
DOM.passwordInput.addEventListener('input', () => {
    if (DOM.passwordInput.value.length === 4) {
        login();
    }
});
if (DOM.btnGoogleLogin) {
    DOM.btnGoogleLogin.addEventListener('click', loginWithGoogle);
}
if (DOM.btnUnlockGoogle) {
    DOM.btnUnlockGoogle.addEventListener('click', unlockGoogleRoom);
}
if (DOM.lockPasswordInput) {
    DOM.lockPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') unlockGoogleRoom(); });
    DOM.lockPasswordInput.addEventListener('input', () => {
        if (DOM.lockPasswordInput.value.length === 4) {
            unlockGoogleRoom();
        }
    });
}
if (DOM.btnSwitchAccount) {
    DOM.btnSwitchAccount.addEventListener('click', handleSignOut);
}
if (DOM.btnSaveLockPassword) {
    DOM.btnSaveLockPassword.addEventListener('click', saveLockPassword);
}
if (DOM.confirmLockPassword) {
    DOM.confirmLockPassword.addEventListener('input', () => {
        if (DOM.confirmLockPassword.value.length === 4 && DOM.newLockPassword.value.length === 4) {
            saveLockPassword();
        }
    });
}
if (DOM.btnLock) {
    DOM.btnLock.addEventListener('click', lockApp);
}
if (DOM.btnOpenChangePassword) {
    DOM.btnOpenChangePassword.addEventListener('click', () => {
        DOM.changeOldPassword.value = '';
        DOM.changeNewPassword.value = '';
        DOM.changeConfirmPassword.value = '';
        DOM.profileModal.classList.add('hidden');
        DOM.changeLockPasswordModal.classList.remove('hidden');
    });
}
if (DOM.btnCancelChangePassword) {
    DOM.btnCancelChangePassword.addEventListener('click', () => {
        DOM.changeLockPasswordModal.classList.add('hidden');
        DOM.profileModal.classList.remove('hidden');
    });
}
if (DOM.changeLockPasswordModal) {
    DOM.changeLockPasswordModal.addEventListener('click', (e) => {
        if (e.target === DOM.changeLockPasswordModal) {
            DOM.changeLockPasswordModal.classList.add('hidden');
        }
    });
}
if (DOM.btnSubmitChangePassword) {
    DOM.btnSubmitChangePassword.addEventListener('click', submitChangePassword);
}
if (DOM.changeConfirmPassword) {
    DOM.changeConfirmPassword.addEventListener('input', () => {
        if (DOM.changeConfirmPassword.value.length === 4 && DOM.changeNewPassword.value.length === 4 && DOM.changeOldPassword.value.length === 4) {
            submitChangePassword();
        }
    });
}
if (DOM.btnResetData) {
    DOM.btnResetData.addEventListener('click', resetRoomData);
}
if (DOM.btnForgotPassword) {
    DOM.btnForgotPassword.addEventListener('click', handleForgotPassword);
}
if (DOM.btnChangeModalForgotPassword) {
    DOM.btnChangeModalForgotPassword.addEventListener('click', handleForgotPassword);
}
if (DOM.sidebarGuestWarning) {
    DOM.sidebarGuestWarning.addEventListener('click', () => {
        if (currentRoomHash && !currentRoomHash.startsWith('google_')) {
            guestRoomHashToImport = currentRoomHash;
            isImportingFromGuest = true;
        }
        loginWithGoogle();
    });
}

if (DOM.sidebarProfileCard) {
    DOM.sidebarProfileCard.addEventListener('click', () => {
        DOM.profileModal.classList.remove('hidden');
    });
}
if (DOM.btnCloseProfile) {
    DOM.btnCloseProfile.addEventListener('click', () => {
        DOM.profileModal.classList.add('hidden');
    });
}

if (DOM.profileModal) {
    DOM.profileModal.addEventListener('click', (e) => {
        if (e.target === DOM.profileModal) {
            DOM.profileModal.classList.add('hidden');
        }
    });
}
if (DOM.btnSignOut) {
    DOM.btnSignOut.addEventListener('click', () => {
        DOM.profileModal.classList.add('hidden');
        handleSignOut();
    });
}

const handleAddNote = async () => {
    if (viewMode === 'trash') {
        viewMode = 'active';
        updateViewArchiveUI();
        startNotesSync();
    }
    
    const newNoteId = 'n_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newNote = {
        id: newNoteId,
        text: "",
        folderId: currentFolderId,
        pinned: false,
        updatedAt: Date.now()
    };
    
    await forceSaveNoteToServer(newNote);
    
    if (isMobile()) {
        openMobileEditor(newNote);
    } else {
        setTimeout(() => {
            const firstInput = DOM.clipGrid.querySelector('.card-body');
            if (firstInput) {
                firstInput.focus();
                resizeTextarea(firstInput);
            }
        }, 100);
    }
};

DOM.btnAddNote.addEventListener('click', handleAddNote);
if (DOM.btnAddNoteMobile) {
    DOM.btnAddNoteMobile.addEventListener('click', handleAddNote);
}
if (DOM.btnAddNoteHeader) {
    DOM.btnAddNoteHeader.addEventListener('click', handleAddNote);
}


if (DOM.btnToggleTrash) {
    DOM.btnToggleTrash.addEventListener('click', () => {
        viewMode = viewMode === 'trash' ? 'active' : 'trash';
        updateViewArchiveUI();
        startNotesSync();
        closeMobileSidebar();
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.attachment-btn-container') && !e.target.closest('.move-dropdown-container')) {
        document.querySelectorAll('.attachment-dropdown, .move-dropdown').forEach(d => d.classList.add('hidden'));
    }
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

// App Lock Settings Modal Event Handlers
if (DOM.btnOpenLockSettings) {
    DOM.btnOpenLockSettings.addEventListener('click', () => {
        DOM.strictLockToggle.checked = strictLockEnabled;
        DOM.idleLockToggle.checked = idleLockEnabled;
        updateIdleTimeoutVisibility();
        DOM.appLockSettingsModal.classList.remove('hidden');
    });
}
if (DOM.btnCloseLockSettings) {
    DOM.btnCloseLockSettings.addEventListener('click', () => {
        DOM.appLockSettingsModal.classList.add('hidden');
    });
}
if (DOM.appLockSettingsModal) {
    DOM.appLockSettingsModal.addEventListener('click', (e) => {
        if (e.target === DOM.appLockSettingsModal) {
            DOM.appLockSettingsModal.classList.add('hidden');
        }
    });
}

DOM.btnIdleTimeout.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = DOM.timeoutDropdown.classList.contains('show');
    
    // Close other dropdowns
    document.querySelectorAll('.dropdown-menu.show, .folder-dropdown.show').forEach(d => {
        if (d !== DOM.timeoutDropdown) d.classList.remove('show');
    });
    
    if (isOpen) {
        DOM.timeoutDropdown.classList.remove('show');
    } else {
        DOM.timeoutDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            const val = parseInt(item.getAttribute('data-value'));
            if (val === idleLockMinutes) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        DOM.timeoutDropdown.classList.add('show');
    }
});

DOM.timeoutDropdown.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        idleLockMinutes = parseInt(item.getAttribute('data-value')) || 5;
        localStorage.setItem('idleLockMinutes', idleLockMinutes);
        resetAutoLockTimer();
        updateIdleTimeoutVisibility();
        DOM.timeoutDropdown.classList.remove('show');
        showToast(`Auto-lock set to ${idleLockMinutes} min`);
    });
});

// Close dropdowns on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.folder-dropdown.show').forEach(d => {
        d.classList.remove('show');
        if (d.parentElement) d.parentElement.classList.remove('open');
    });
    if (DOM.timeoutDropdown) {
        DOM.timeoutDropdown.classList.remove('show');
    }
});

// Modal Events
DOM.btnSelectFolders.addEventListener('click', () => {
    isSelectingFolders = !isSelectingFolders;
    selectedFoldersForDeletion.clear();
    
    if (isSelectingFolders) {
        DOM.btnSelectFolders.style.color = 'var(--primary)';
        DOM.btnAddFolder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        DOM.btnAddFolder.style.color = 'var(--danger)';
        DOM.btnAddFolder.setAttribute('title', 'Delete Selected Folders');
    } else {
        DOM.btnSelectFolders.style.color = 'var(--text-muted)';
        DOM.btnAddFolder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        DOM.btnAddFolder.style.color = '';
        DOM.btnAddFolder.setAttribute('title', 'Add New Folder');
    }
    renderFolders();
});

DOM.btnAddFolder.addEventListener('click', async () => {
    if (isSelectingFolders) {
        if (selectedFoldersForDeletion.size === 0) return;
        if (!await showCustomConfirm("Delete Selected Folders", `Move ${selectedFoldersForDeletion.size} folder(s) and their notes to Trash?`, true)) return;
        
        let foldersChanged = false;
        for (const folderId of selectedFoldersForDeletion) {
            folders = folders.map(f => f.id === folderId ? { ...f, deleted: true, deletedAt: Date.now() } : f);
            
            const notesInFolder = notesArray.filter(n => n.folderId === folderId);
            for (const note of notesInFolder) {
                const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
                await setDoc(noteRef, { deleted: true, deletedAt: Date.now() }, { merge: true });
            }
            foldersChanged = true;
        }
        if (foldersChanged) {
            const roomRef = doc(db, 'clipboards', currentRoomHash);
            await setDoc(roomRef, { folders }, { merge: true });
        }
        
        if (selectedFoldersForDeletion.has(currentFolderId)) {
            switchFolder('default');
        } else {
            renderFolders();
        }
        
        // Reset selection mode after deletion
        isSelectingFolders = false;
        selectedFoldersForDeletion.clear();
        DOM.btnSelectFolders.style.color = 'var(--text-muted)';
        DOM.btnAddFolder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        DOM.btnAddFolder.style.color = '';
        DOM.btnAddFolder.setAttribute('title', 'Add New Folder');
        renderFolders();
    } else {
        editingFolderId = null;
        DOM.folderModal.querySelector('h3').textContent = "Create New Folder";
        DOM.folderModal.classList.remove('hidden');
        DOM.folderNameInput.focus();
    }
});
DOM.btnCancelFolder.addEventListener('click', () => {
    editingFolderId = null;
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

function downloadFile(base64Data, filename) {
    ignoreBlur = true;
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
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
        
        // Also restore notes in this folder that are deleted
        const notesInFolder = notesArray.filter(n => n.folderId === folderId && n.deleted);
        for (const note of notesInFolder) {
            const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
            await setDoc(noteRef, {
                deleted: false,
                deletedAt: null,
                updatedAt: Date.now()
            }, { merge: true });
        }
        
        showToast("Folder restored");
        renderGrid();
    } catch(err) {
        showToast("Failed to restore folder");
    }
}

async function deleteFolderPermanently(folderId) {
    if (!await showCustomConfirm("Delete Permanently", "Delete this folder and its notes forever? This action cannot be undone.", true)) return;
    
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
    if (!await showCustomConfirm("Delete Permanently", "Delete this note forever? This action cannot be undone.", true)) return;
    
    const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', noteId);
    try {
        await deleteDoc(noteRef);
        showToast("Note permanently deleted");
    } catch(err) {
        showToast("Failed to delete note");
    }
}

async function emptyTrash() {
    if (!await showCustomConfirm("Empty Trash", "Delete all items in trash permanently? This action cannot be undone.", true)) return;
    
    try {
        const trashFolders = folders.filter(f => f.deleted);
        const trashNotes = notesArray.filter(n => n.deleted);
        
        // Delete all notes
        for (const note of trashNotes) {
            const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
            await deleteDoc(noteRef);
        }
        
        // Delete all folders
        if (trashFolders.length > 0) {
            const newFolders = folders.filter(f => !f.deleted);
            const roomRef = doc(db, 'clipboards', currentRoomHash);
            await setDoc(roomRef, { folders: newFolders }, { merge: true });
            folders = newFolders;
        }
        
        showToast("Trash emptied successfully");
    } catch(err) {
        showToast("Failed to empty trash");
    }
}

if (DOM.btnEmptyTrash) {
    DOM.btnEmptyTrash.addEventListener('click', emptyTrash);
}
if (DOM.btnEmptyTrashMobile) {
    DOM.btnEmptyTrashMobile.addEventListener('click', emptyTrash);
}

// ==========================================
// 📱 MOBILE INTERACTION & GESTURE SYSTEM (Juli 2026)
// ==========================================

function isMobile() {
    return window.innerWidth <= 768;
}

let currentEditingMobileNote = null;
let currentContextMobileNote = null;
let currentPickerMobileNote = null;

// Opens the mobile bottom sheet note editor
function openMobileEditor(note) {
    currentEditingMobileNote = note;
    
    const backdrop = document.getElementById('mobileNoteEditorBackdrop');
    const sheet = document.getElementById('mobileNoteEditorSheet');
    const textarea = document.getElementById('mobileEditorTextarea');
    const stats = document.getElementById('mobileEditorStats');
    
    if (DOM.mobileEditorTitle) {
        DOM.mobileEditorTitle.value = note.title || '';
    }
    textarea.value = note.text;
    stats.textContent = countWordsAndChars(note.text);
    
    // Set attachments state
    const imgWrapper = document.getElementById('mobileEditorImageWrapper');
    const img = document.getElementById('mobileEditorImage');
    if (note.image) {
        img.src = note.image;
        imgWrapper.style.display = 'block';
    } else {
        img.src = '';
        imgWrapper.style.display = 'none';
    }
    
    const docWrapper = document.getElementById('mobileEditorDocumentWrapper');
    const docName = document.getElementById('mobileEditorDocumentName');
    if (note.document) {
        docName.textContent = note.documentName || 'Document';
        docWrapper.style.display = 'flex';
    } else {
        docWrapper.style.display = 'none';
    }
    
    backdrop.classList.add('active');
    sheet.classList.add('active');
    
    setTimeout(() => {
        textarea.focus();
    }, 150);
}

function closeMobileEditor() {
    const backdrop = document.getElementById('mobileNoteEditorBackdrop');
    const sheet = document.getElementById('mobileNoteEditorSheet');
    
    backdrop.classList.remove('active');
    sheet.classList.remove('active');
    sheet.style.bottom = '';
    
    if (currentEditingMobileNote) {
        if (DOM.mobileEditorTitle) {
            currentEditingMobileNote.title = DOM.mobileEditorTitle.value;
        }
        triggerNoteAutoSave(currentEditingMobileNote);
    }
    currentEditingMobileNote = null;
}

// Opens the context action menu (from hold / long-press)
function openMobileContextMenu(note) {
    currentContextMobileNote = note;
    
    const backdrop = document.getElementById('mobileContextMenuBackdrop');
    const sheet = document.getElementById('mobileContextMenuSheet');
    const preview = document.getElementById('mobileMenuNotePreview');
    const pinText = document.getElementById('mobileMenuPinText');
    
    preview.textContent = note.text.trim() || "(Empty note)";
    pinText.textContent = note.pinned ? "Unpin Note" : "Pin Note";
    
    backdrop.classList.add('active');
    sheet.classList.add('active');
}

function closeMobileContextMenu() {
    const backdrop = document.getElementById('mobileContextMenuBackdrop');
    const sheet = document.getElementById('mobileContextMenuSheet');
    backdrop.classList.remove('active');
    sheet.classList.remove('active');
    currentContextMobileNote = null;
}

// Opens the folder picker sheet
function openMobileFolderPicker(note) {
    currentPickerMobileNote = note;
    
    const backdrop = document.getElementById('mobileFolderPickerBackdrop');
    const sheet = document.getElementById('mobileFolderPickerSheet');
    const folderList = document.getElementById('mobileFolderList');
    
    folderList.innerHTML = '';
    
    folders.forEach(f => {
        if (f.id === currentFolderId || f.deleted) return;
        
        const btn = document.createElement('button');
        btn.className = 'mobile-menu-item';
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            ${f.name}
        `;
        
        btn.onclick = async () => {
            note.folderId = f.id;
            note.updatedAt = Date.now();
            await forceSaveNoteToServer(note);
            showToast(`Moved to ${f.name}`);
            closeMobileFolderPicker();
            renderGrid();
        };
        
        folderList.appendChild(btn);
    });
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'mobile-menu-item';
    cancelBtn.style.color = 'var(--text-muted)';
    cancelBtn.innerHTML = `Cancel`;
    cancelBtn.onclick = () => closeMobileFolderPicker();
    folderList.appendChild(cancelBtn);
    
    backdrop.classList.add('active');
    sheet.classList.add('active');
}

function closeMobileFolderPicker() {
    const backdrop = document.getElementById('mobileFolderPickerBackdrop');
    const sheet = document.getElementById('mobileFolderPickerSheet');
    backdrop.classList.remove('active');
    sheet.classList.remove('active');
    currentPickerMobileNote = null;
}

// Helpers for swipe/context actions
async function toggleNotePin(note) {
    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    await forceSaveNoteToServer(note);
    renderGrid();
}

async function deleteNoteToTrash(note) {
    if (await showCustomConfirm("Move to Trash", "Move this note to Trash? It will be automatically deleted after 30 days.", false)) {
        const noteRef = doc(db, 'clipboards', currentRoomHash, 'notes', note.id);
        try {
            await setDoc(noteRef, {
                deleted: true,
                deletedAt: Date.now()
            }, { merge: true });
            showToast("Note moved to Trash");
            renderGrid();
        } catch(err) {
            showToast("Failed to move note to Trash");
        }
    }
}

// Bind swipe gestures and tap/long-press events
function bindMobileCardEvents(card, item) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoveX = 0;
    let touchMoveY = 0;
    let longPressTimer = null;
    let isLongPressTriggered = false;
    let isSwiping = false;
    let lastTap = 0;

    card.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchMoveX = touchStartX;
        touchMoveY = touchStartY;
        isLongPressTriggered = false;
        isSwiping = false;

        longPressTimer = setTimeout(() => {
            isLongPressTriggered = true;
            if (navigator.vibrate) navigator.vibrate(15);
            openMobileContextMenu(item);
        }, 550);
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchMoveX = touch.clientX;
        touchMoveY = touch.clientY;

        const diffX = touchMoveX - touchStartX;
        const diffY = touchMoveY - touchStartY;

        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }

        if (Math.abs(diffX) > Math.abs(diffY) * 1.5 && Math.abs(diffX) > 15) {
            isSwiping = true;
            card.style.transform = `translateX(${diffX}px) scale(0.98)`;
            
            if (diffX > 0) {
                card.className = `card swipe-action-pin ${item.pinned ? 'pinned' : ''}`;
            } else {
                card.className = `card swipe-action-delete ${item.pinned ? 'pinned' : ''}`;
            }
        }
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (isLongPressTriggered) return;

        const diffX = touchMoveX - touchStartX;
        const diffY = touchMoveY - touchStartY;

        if (isSwiping) {
            card.style.transform = '';
            card.className = `card ${item.pinned ? 'pinned' : ''}`;
            
            const threshold = window.innerWidth * 0.35;
            if (diffX > threshold) {
                if (navigator.vibrate) navigator.vibrate([10, 20]);
                toggleNotePin(item);
            } else if (diffX < -threshold) {
                if (navigator.vibrate) navigator.vibrate([20, 50]);
                deleteNoteToTrash(item);
            }
        } else {
            if (Math.abs(diffX) < 8 && Math.abs(diffY) < 8) {
                const currentTime = Date.now();
                const tapLength = currentTime - lastTap;
                if (tapLength < 250 && tapLength > 0) {
                    navigator.clipboard.writeText(item.text).then(() => {
                        showToast("Copied (Double-Tap)");
                        if (navigator.vibrate) navigator.vibrate(30);
                    });
                    lastTap = 0;
                    return;
                }
                lastTap = currentTime;
                setTimeout(() => {
                    if (lastTap === currentTime) {
                        openMobileEditor(item);
                    }
                }, 200);
            }
        }
    });

    card.addEventListener('click', (e) => {
        if (isMobile()) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
}

function setActiveTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
}

function openMobileFolderSelector() {
    const backdrop = DOM.mobileFolderSelectorBackdrop;
    const sheet = DOM.mobileFolderSelectorSheet;
    const list = DOM.mobileFolderSelectorList;
    if (!backdrop || !sheet || !list) return;
    
    list.innerHTML = '';
    
    const generalBtn = document.createElement('button');
    generalBtn.className = 'mobile-menu-item' + (currentFolderId === 'default' ? ' active' : '');
    generalBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> General`;
    generalBtn.onclick = () => {
        switchFolder('default');
        closeMobileFolderSelector();
    };
    list.appendChild(generalBtn);
    
    folders.filter(f => !f.deleted && f.id !== 'default').forEach(f => {
        const folderBtn = document.createElement('button');
        folderBtn.className = 'mobile-menu-item' + (currentFolderId === f.id ? ' active' : '');
        folderBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            ${f.name}
        `;
        folderBtn.onclick = () => {
            switchFolder(f.id);
            closeMobileFolderSelector();
        };
        list.appendChild(folderBtn);
    });
    
    backdrop.classList.add('active');
    sheet.classList.add('active');
}

function closeMobileFolderSelector() {
    if (DOM.mobileFolderSelectorBackdrop) DOM.mobileFolderSelectorBackdrop.classList.remove('active');
    if (DOM.mobileFolderSelectorSheet) DOM.mobileFolderSelectorSheet.classList.remove('active');
}

function openMobileSettings() {
    const backdrop = DOM.mobileSettingsBackdrop;
    const sheet = DOM.mobileSettingsSheet;
    if (!backdrop || !sheet) return;
    
    if (currentUser && !currentUser.isAnonymous) {
        if (DOM.mobileSettingsAvatar) DOM.mobileSettingsAvatar.src = currentUser.photoURL || 'https://via.placeholder.com/48';
        if (DOM.mobileSettingsName) DOM.mobileSettingsName.textContent = currentUser.displayName || 'Google User';
        if (DOM.mobileSettingsEmail) DOM.mobileSettingsEmail.textContent = currentUser.email || '';
        if (DOM.btnMobileSettingsChangePwd) DOM.btnMobileSettingsChangePwd.style.display = 'inline-flex';
        if (DOM.btnMobileSettingsReset) DOM.btnMobileSettingsReset.style.display = 'inline-flex';
    } else {
        if (DOM.mobileSettingsAvatar) DOM.mobileSettingsAvatar.src = 'https://via.placeholder.com/48';
        if (DOM.mobileSettingsName) DOM.mobileSettingsName.textContent = 'Guest User';
        if (DOM.mobileSettingsEmail) DOM.mobileSettingsEmail.textContent = 'Local Session';
        if (DOM.btnMobileSettingsChangePwd) DOM.btnMobileSettingsChangePwd.style.display = 'none';
        if (DOM.btnMobileSettingsReset) DOM.btnMobileSettingsReset.style.display = 'none';
    }
    
    backdrop.classList.add('active');
    sheet.classList.add('active');
}

function closeMobileSettings() {
    if (DOM.mobileSettingsBackdrop) DOM.mobileSettingsBackdrop.classList.remove('active');
    if (DOM.mobileSettingsSheet) DOM.mobileSettingsSheet.classList.remove('active');
}

async function addNoteWithAttachment(text, imageBase64, docData, docName, docType) {
    const newNoteId = 'n_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newNote = {
        id: newNoteId,
        text: text || '',
        folderId: currentFolderId,
        pinned: false,
        updatedAt: Date.now()
    };
    if (imageBase64) newNote.image = imageBase64;
    if (docData) {
        newNote.document = docData;
        newNote.documentName = docName;
        newNote.documentType = docType;
    }
    await forceSaveNoteToServer(newNote);
    showToast("Note created!");
}

// Wire up the mobile sheet control elements
function initializeMobileSheets() {
    const btnDone = document.getElementById('btnDoneMobileEditor');
    const editorBackdrop = document.getElementById('mobileNoteEditorBackdrop');
    const contextBackdrop = document.getElementById('mobileContextMenuBackdrop');
    const folderBackdrop = document.getElementById('mobileFolderPickerBackdrop');
    
    if (btnDone) btnDone.onclick = () => { closeMobileEditor(); renderGrid(); };
    if (editorBackdrop) editorBackdrop.onclick = () => { closeMobileEditor(); renderGrid(); };
    if (contextBackdrop) contextBackdrop.onclick = () => closeMobileContextMenu();
    if (folderBackdrop) folderBackdrop.onclick = () => closeMobileFolderPicker();

    
    // Mobile editor text input handler
    const mobileTextarea = document.getElementById('mobileEditorTextarea');
    if (mobileTextarea) {
        mobileTextarea.addEventListener('input', (e) => {
            if (currentEditingMobileNote) {
                currentEditingMobileNote.text = e.target.value;
                currentEditingMobileNote.updatedAt = Date.now();
                document.getElementById('mobileEditorStats').textContent = countWordsAndChars(e.target.value);
                triggerNoteAutoSave(currentEditingMobileNote);
            }
        });
    }

    // Mobile editor title input handler
    const mobileTitleInput = DOM.mobileEditorTitle;
    if (mobileTitleInput) {
        mobileTitleInput.addEventListener('input', (e) => {
            if (currentEditingMobileNote) {
                currentEditingMobileNote.title = e.target.value;
                currentEditingMobileNote.updatedAt = Date.now();
                triggerNoteAutoSave(currentEditingMobileNote);
            }
        });
    }

    // Context menu items
    const btnCopy = document.getElementById('btnMobileMenuCopy');
    const btnPin = document.getElementById('btnMobileMenuPin');
    const btnMove = document.getElementById('btnMobileMenuMove');
    const btnDelete = document.getElementById('btnMobileMenuDelete');

    if (btnCopy) btnCopy.onclick = () => {
        if (currentContextMobileNote) {
            navigator.clipboard.writeText(currentContextMobileNote.text).then(() => {
                showToast("Copied to clipboard");
            });
            closeMobileContextMenu();
        }
    };

    if (btnPin) btnPin.onclick = () => {
        if (currentContextMobileNote) {
            toggleNotePin(currentContextMobileNote);
            closeMobileContextMenu();
        }
    };

    if (btnDelete) btnDelete.onclick = () => {
        if (currentContextMobileNote) {
            deleteNoteToTrash(currentContextMobileNote);
            closeMobileContextMenu();
        }
    };

    if (btnMove) btnMove.onclick = () => {
        if (currentContextMobileNote) {
            const note = currentContextMobileNote;
            closeMobileContextMenu();
            setTimeout(() => openMobileFolderPicker(note), 200);
        }
    };

    // Attachments flow inside mobile sheet
    const btnMobileAttach = document.getElementById('btnMobileAttach');
    const mobileAttachDropdown = document.getElementById('mobileAttachDropdown');
    const mobileImageInput = document.getElementById('mobileEditorImageInput');
    const mobileDocInput = document.getElementById('mobileEditorDocumentInput');
    const optAddImage = document.getElementById('optMobileAddImage');
    const optAddDoc = document.getElementById('optMobileAddDocument');

    if (btnMobileAttach && mobileAttachDropdown) {
        btnMobileAttach.onclick = (e) => {
            e.stopPropagation();
            mobileAttachDropdown.style.display = mobileAttachDropdown.style.display === 'flex' ? 'none' : 'flex';
        };
        document.addEventListener('click', () => {
            mobileAttachDropdown.style.display = 'none';
        });
    }

    if (optAddImage) optAddImage.onclick = () => { ignoreBlur = true; mobileImageInput.click(); };
    if (optAddDoc) optAddDoc.onclick = () => { ignoreBlur = true; mobileDocInput.click(); };

    if (mobileImageInput) {
        mobileImageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentEditingMobileNote) return;
            showToast("Uploading image...");
            try {
                const compressedBase64 = await compressImage(file, 256);
                currentEditingMobileNote.image = compressedBase64;
                currentEditingMobileNote.updatedAt = Date.now();
                await forceSaveNoteToServer(currentEditingMobileNote);
                
                document.getElementById('mobileEditorImage').src = compressedBase64;
                document.getElementById('mobileEditorImageWrapper').style.display = 'block';
                showToast("Image uploaded successfully!");
            } catch (err) {
                console.error(err);
                showToast(err.message || "Failed to compress image.");
            }
        });
    }

    if (mobileDocInput) {
        mobileDocInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentEditingMobileNote) return;
            try {
                if (file.size > 2 * 1024 * 1024) throw new Error("File size cannot exceed 2MB.");
                showToast("Uploading document...");
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        currentEditingMobileNote.document = event.target.result;
                        currentEditingMobileNote.documentName = file.name;
                        currentEditingMobileNote.documentType = file.type;
                        currentEditingMobileNote.updatedAt = Date.now();
                        await forceSaveNoteToServer(currentEditingMobileNote);
                        
                        document.getElementById('mobileEditorDocumentName').textContent = file.name;
                        document.getElementById('mobileEditorDocumentWrapper').style.display = 'flex';
                        showToast("Document uploaded successfully!");
                    } catch (err) {
                        showToast(err.message || "Failed to save document.");
                    }
                };
                reader.readAsDataURL(file);
            } catch (err) {
                console.error(err);
                showToast(err.message || "Failed to process document.");
            }
        });
    }

    const btnRemoveImage = document.getElementById('btnMobileRemoveImage');
    if (btnRemoveImage) {
        btnRemoveImage.onclick = async (e) => {
            e.stopPropagation();
            if (!currentEditingMobileNote) return;
            if (await showCustomConfirm("Delete Image", "Remove this image from the note permanently?", true)) {
                currentEditingMobileNote.image = null;
                currentEditingMobileNote.updatedAt = Date.now();
                await forceSaveNoteToServer(currentEditingMobileNote);
                document.getElementById('mobileEditorImageWrapper').style.display = 'none';
                showToast("Image deleted");
            }
        };
    }

    const btnRemoveDoc = document.getElementById('btnMobileRemoveDocument');
    if (btnRemoveDoc) {
        btnRemoveDoc.onclick = async (e) => {
            e.stopPropagation();
            if (!currentEditingMobileNote) return;
            if (await showCustomConfirm("Delete Document", "Remove this document from the note permanently?", true)) {
                currentEditingMobileNote.document = null;
                currentEditingMobileNote.documentName = null;
                currentEditingMobileNote.documentType = null;
                currentEditingMobileNote.updatedAt = Date.now();
                await forceSaveNoteToServer(currentEditingMobileNote);
                document.getElementById('mobileEditorDocumentWrapper').style.display = 'none';
                showToast("Document deleted");
            }
        };
    }

    const btnShare = document.getElementById('btnMobileShare');
    if (btnShare) {
        btnShare.onclick = () => {
            if (!currentEditingMobileNote) return;
            if (navigator.share) {
                navigator.share({
                    title: 'Clipboardy Note',
                    text: currentEditingMobileNote.text
                }).catch(err => console.log('Share failed', err));
            } else {
                navigator.clipboard.writeText(currentEditingMobileNote.text).then(() => {
                    showToast("Copied to clipboard (Share not supported)");
                });
            }
        };
    }

    // Pull-to-refresh implementation
    const mainScroll = document.querySelector('.main-scroll');
    const ptr = document.getElementById('pullToRefreshSpinner');
    if (mainScroll && ptr) {
        let ptrStartY = 0;
        let ptrDiffY = 0;
        let isPtrActive = false;

        mainScroll.addEventListener('touchstart', (e) => {
            if (mainScroll.scrollTop === 0 && e.touches.length === 1) {
                ptrStartY = e.touches[0].clientY;
                isPtrActive = true;
            }
        }, { passive: true });

        mainScroll.addEventListener('touchmove', (e) => {
            if (!isPtrActive || e.touches.length !== 1) return;
            const currentY = e.touches[0].clientY;
            ptrDiffY = currentY - ptrStartY;

            if (ptrDiffY > 0) {
                if (e.cancelable) e.preventDefault();
                
                const pullHeight = Math.min(60, ptrDiffY * 0.4);
                ptr.style.display = 'flex';
                ptr.style.height = `${pullHeight}px`;
                ptr.style.opacity = `${pullHeight / 60}`;
            } else {
                isPtrActive = false;
            }
        }, { passive: false });

        mainScroll.addEventListener('touchend', async () => {
            if (!isPtrActive) return;
            isPtrActive = false;

            if (ptrDiffY > 80) {
                ptr.classList.add('visible');
                ptr.style.height = '';
                ptr.style.opacity = '';
                
                if (navigator.vibrate) navigator.vibrate(20);
                showToast("Syncing database...");
                
                try {
                    await startFoldersSync();
                    await startNotesSync();
                    showToast("Database up to date");
                } catch (err) {
                    console.error("Sync failed", err);
                } finally {
                    ptr.classList.remove('visible');
                    ptr.style.display = 'none';
                }
            } else {
                ptr.style.transition = 'height 0.2s, opacity 0.2s';
                ptr.style.height = '0px';
                ptr.style.opacity = '0';
                setTimeout(() => {
                    ptr.style.transition = '';
                    ptr.style.display = 'none';
                }, 200);
            }
            ptrDiffY = 0;
        });
    }

    // Left edge swipe-to-open and swipe-to-close sidebar drawer
    let sidebarStartX = 0;
    let sidebarStartY = 0;
    let sidebarIsPulling = false;
    const sidebar = DOM.sidebar;
    const sidebarBackdrop = DOM.sidebarBackdrop;

    if (sidebar && sidebarBackdrop) {
        document.addEventListener('touchstart', (e) => {
            if (!isMobile()) return;
            const touch = e.touches[0];
            
            if (!sidebar.classList.contains('open') && touch.clientX < 30) {
                sidebarStartX = touch.clientX;
                sidebarStartY = touch.clientY;
                sidebarIsPulling = true;
                sidebar.style.transition = 'none';
                sidebarBackdrop.style.transition = 'none';
            }
            else if (sidebar.classList.contains('open')) {
                sidebarStartX = touch.clientX;
                sidebarIsPulling = true;
                sidebar.style.transition = 'none';
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!sidebarIsPulling || e.touches.length !== 1) return;
            const touch = e.touches[0];
            const diffX = touch.clientX - sidebarStartX;
            
            if (!sidebar.classList.contains('open')) {
                if (diffX > 0) {
                    if (e.cancelable) e.preventDefault();
                    const translateAmt = Math.min(0, -260 + diffX);
                    sidebar.style.transform = `translateX(${translateAmt}px)`;
                    sidebarBackdrop.classList.remove('hidden');
                    sidebarBackdrop.style.opacity = `${Math.min(1, diffX / 260)}`;
                }
            } else {
                if (diffX < 0) {
                    if (e.cancelable) e.preventDefault();
                    const translateAmt = Math.max(-260, diffX);
                    sidebar.style.transform = `translateX(${translateAmt}px)`;
                    sidebarBackdrop.style.opacity = `${Math.max(0, 1 + (diffX / 260))}`;
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (!sidebarIsPulling) return;
            sidebarIsPulling = false;
            
            sidebar.style.transition = '';
            sidebarBackdrop.style.transition = '';
            sidebarBackdrop.style.opacity = '';
            
            const touch = e.changedTouches[0];
            const diffX = touch.clientX - sidebarStartX;
            
            if (!sidebar.classList.contains('open')) {
                if (diffX > 80) {
                    toggleSidebar();
                } else {
                    closeMobileSidebar();
                    sidebar.style.transform = '';
                }
            } else {
                if (diffX < -80) {
                    closeMobileSidebar();
                    sidebar.style.transform = '';
                } else {
                    sidebar.style.transform = 'translateX(0)';
                }
            }
        });
    }

    // Folder Actions Context Menu handlers
    const folderActionsBackdrop = document.getElementById('mobileFolderActionsBackdrop');
    if (folderActionsBackdrop) {
        folderActionsBackdrop.onclick = () => closeMobileFolderActions();
    }
    
    const btnRenameFolder = document.getElementById('btnMobileFolderRename');
    if (btnRenameFolder) {
        btnRenameFolder.onclick = () => {
            if (currentFolderMobileAction) {
                const folder = currentFolderMobileAction;
                closeMobileFolderActions();
                setTimeout(() => editFolder(folder.id, folder.name), 200);
            }
        };
    }

    const btnDeleteFolder = document.getElementById('btnMobileFolderDelete');
    if (btnDeleteFolder) {
        btnDeleteFolder.onclick = () => {
            if (currentFolderMobileAction) {
                const folder = currentFolderMobileAction;
                closeMobileFolderActions();
                setTimeout(() => deleteFolder(folder.id), 200);
            }
        };
    }

    // Visual Viewport Keyboard pinning
    if (window.visualViewport) {
        const adjustSheetHeight = () => {
            const editorSheet = document.getElementById('mobileNoteEditorSheet');
            if (editorSheet && editorSheet.classList.contains('active')) {
                const offsetBottom = window.innerHeight - window.visualViewport.height;
                editorSheet.style.bottom = `${offsetBottom}px`;
            }
        };
        window.visualViewport.addEventListener('resize', adjustSheetHeight);
        window.visualViewport.addEventListener('scroll', adjustSheetHeight);
    }
}

let currentFolderMobileAction = null;

function openMobileFolderActions(folder) {
    currentFolderMobileAction = folder;
    const backdrop = document.getElementById('mobileFolderActionsBackdrop');
    const sheet = document.getElementById('mobileFolderActionsSheet');
    const title = document.getElementById('mobileFolderActionsTitle');
    title.textContent = `Folder Options: ${folder.name}`;
    backdrop.classList.add('active');
    sheet.classList.add('active');
}

function closeMobileFolderActions() {
    const backdrop = document.getElementById('mobileFolderActionsBackdrop');
    const sheet = document.getElementById('mobileFolderActionsSheet');
    backdrop.classList.remove('active');
    sheet.classList.remove('active');
    currentFolderMobileAction = null;
}

// Run mobile sheets initializer
initializeMobileSheets();

// Wire up 2026 Navigation and Quick Input
if (DOM.tabNotes) {
    DOM.tabNotes.onclick = () => {
        viewMode = 'active';
        setActiveTab('tabNotes');
        updateViewArchiveUI();
        startNotesSync();
    };
}
if (DOM.tabFolders) {
    DOM.tabFolders.onclick = () => {
        openMobileFolderSelector();
    };
}
if (DOM.tabTrash) {
    DOM.tabTrash.onclick = () => {
        viewMode = 'trash';
        setActiveTab('tabTrash');
        updateViewArchiveUI();
        startNotesSync();
    };
}
if (DOM.tabSettings) {
    DOM.tabSettings.onclick = () => {
        openMobileSettings();
    };
}

// Backdrop close events
if (DOM.mobileFolderSelectorBackdrop) DOM.mobileFolderSelectorBackdrop.onclick = closeMobileFolderSelector;
if (DOM.mobileSettingsBackdrop) DOM.mobileSettingsBackdrop.onclick = closeMobileSettings;

// Mobile settings sheet action items
if (DOM.btnMobileSettingsLock) DOM.btnMobileSettingsLock.onclick = () => { closeMobileSettings(); lockApp(); };
if (DOM.btnMobileSettingsChangePwd) {
    DOM.btnMobileSettingsChangePwd.onclick = () => {
        closeMobileSettings();
        DOM.changeOldPassword.value = '';
        DOM.changeNewPassword.value = '';
        DOM.changeConfirmPassword.value = '';
        DOM.changeLockPasswordModal.classList.remove('hidden');
    };
}
if (DOM.btnMobileSettingsReset) DOM.btnMobileSettingsReset.onclick = () => { closeMobileSettings(); resetRoomData(); };
if (DOM.btnMobileSettingsTheme) {
    DOM.btnMobileSettingsTheme.onclick = () => {
        const isLight = document.documentElement.classList.toggle('light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        if (isLight) {
            DOM.themeIconSun.classList.add('hidden');
            DOM.themeIconMoon.classList.remove('hidden');
        } else {
            DOM.themeIconSun.classList.remove('hidden');
            DOM.themeIconMoon.classList.add('hidden');
        }
    };
}
if (DOM.btnMobileSettingsSignOut) DOM.btnMobileSettingsSignOut.onclick = () => { closeMobileSettings(); handleSignOut(); };
if (DOM.btnAddNewFolderMobile) {
    DOM.btnAddNewFolderMobile.onclick = () => {
        closeMobileFolderSelector();
        editingFolderId = null;
        DOM.folderModal.querySelector('h3').textContent = "Create New Folder";
        DOM.folderModal.classList.remove('hidden');
        DOM.folderNameInput.focus();
    };
}

// Chat-Style Quick Input Listeners
if (DOM.btnQuickInputPaste) {
    DOM.btnQuickInputPaste.onclick = async () => {
        try {
            if (!navigator.clipboard || !navigator.clipboard.readText) {
                throw new Error("Clipboard API not supported.");
            }
            showToast("Reading clipboard...");
            const text = await navigator.clipboard.readText();
            const trimmed = text.trim();
            if (!trimmed) return showToast("Clipboard is empty!");
            await addNoteWithAttachment(trimmed, null, null, null, null);
            showToast("Clipboard pasted & synced!");
        } catch(err) {
            showToast("Paste failed: " + err.message);
        }
    };
}

if (DOM.btnQuickInputAttach) {
    DOM.btnQuickInputAttach.onclick = (e) => {
        e.stopPropagation();
        if (DOM.quickInputAttachDropdown) DOM.quickInputAttachDropdown.classList.toggle('hidden');
    };
    document.addEventListener('click', () => {
        if (DOM.quickInputAttachDropdown) DOM.quickInputAttachDropdown.classList.add('hidden');
    });
}

if (DOM.btnQuickAttachImage) {
    DOM.btnQuickAttachImage.onclick = () => {
        ignoreBlur = true;
        if (DOM.quickInputImageFile) DOM.quickInputImageFile.click();
    };
}
if (DOM.btnQuickAttachDoc) {
    DOM.btnQuickAttachDoc.onclick = () => {
        ignoreBlur = true;
        if (DOM.quickInputDocFile) DOM.quickInputDocFile.click();
    };
}

if (DOM.quickInputImageFile) {
    DOM.quickInputImageFile.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showToast("Uploading image...");
        try {
            const compressedBase64 = await compressImage(file, 256);
            await addNoteWithAttachment('', compressedBase64, null, null, null);
        } catch(err) {
            showToast("Image failed: " + err.message);
        }
    };
}

if (DOM.quickInputDocFile) {
    DOM.quickInputDocFile.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return showToast("File size cannot exceed 2MB.");
        showToast("Uploading document...");
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                await addNoteWithAttachment('', null, event.target.result, file.name, file.type);
            } catch(err) {
                showToast("Failed to upload document.");
            }
        };
        reader.readAsDataURL(file);
    };
}

async function sendQuickInputText() {
    if (!DOM.txtQuickInput) return;
    const text = DOM.txtQuickInput.value.trim();
    if (!text) return;
    
    DOM.txtQuickInput.value = '';
    await addNoteWithAttachment(text, null, null, null, null);
}

if (DOM.btnQuickInputSend) {
    DOM.btnQuickInputSend.onclick = sendQuickInputText;
}
if (DOM.txtQuickInput) {
    DOM.txtQuickInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            sendQuickInputText();
        }
    };
}

// Exports for unit testing
export { hashPassword, countWordsAndChars, login, lockApp, isAppLocked, currentUser, currentRoomHash, ignoreBlur };


