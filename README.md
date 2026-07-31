# 📋 Clipboardy v0.2.0

Clipboardy is a secure, lightweight, and real-time syncing multi-device clipboard application. Built with an eye-friendly **Sage & Warm Linen** light design system, Clipboardy allows you to instantly share and sync text, compressed images, and files across desktop and mobile devices.

---

## ✨ Features (v0.2.0)

* **🔒 Room-Locked Security & Authorization**:
  * Join private temporary rooms via Room Codes or authenticate securely using Google Sign-In.
  * Realtime multi-device approval: New devices joining a room require 1-tap authorization from active devices.

* **⚡ Real-Time Instant Sync**:
  * Powered by Firebase Firestore LIFO stream (`limit(50)`), clips sync instantly across all connected screens.
  * **Strict 24-Hour Expiration & Auto-Cleanup**: Guest room clips automatically expire and delete from Firestore after 24 hours to keep temporary rooms lightweight and secure.

* **📱 Hybrid Mobile & Collapsible Desktop UX**:
  * **Desktop (`>= 768px`)**: Collapsible sidebar with stationary icon alignment, direct **Undo (Ctrl+Z)** and **Redo (Ctrl+Shift+Z)** buttons, and top-right header search.
  * **Mobile (`< 768px`)**: Pure, un-cluttered touch interface with 2 compact Floating Action Buttons (**FABs**).

* **📋 Discrete Clip Types (Gboard Style)**:
  * Save discrete **Text**, **Image** (compressed <128KB), or **File** clips.
  * **1-Tap Quick Paste**: Instantly reads device clipboard text/image and saves to Firestore. If the clipboard is empty or unreadable, opens the New Clip modal with a clear warning toast notification.

* **⌨️ Non-Conflicting Keyboard Shortcuts**:
  * `Ctrl + Shift + N` / `Cmd + Shift + N`: Open New Clip Modal.
  * `Ctrl + Shift + V` / `Cmd + Shift + V`: Quick Paste from System Clipboard.
  * `Ctrl + F` / `Cmd + F`: Focus Header Search Bar.
  * `Ctrl + Z`: Undo last delete or edit action.
  * `Ctrl + Y` / `Ctrl + Shift + Z`: Redo action.
  * `Escape`: Close modals or reset search.

* **🌿 Eye-Friendly Sage & Warm Linen Palette**:
  * Designed according to visual ergonomics to prevent eye strain. Avoids harsh dark mode or 100% pure white glare by employing organic paper linen backgrounds (`#F8F7F4`), soothing Sage Forest Green (`#347A5A`), and soft dark forest graphite text (`#242D27`).

---

## 🛠️ Tech Stack

* **Frontend**: Vanilla HTML5, CSS3 Custom Properties (Sage & Warm Linen Tokens), ES6 JavaScript Modules.
* **Database & Sync**: Firebase Firestore JS SDK v11.
* **Authentication**: Firebase Anonymous Auth & Google Auth Provider.
* **Testing**: Vitest + JSDOM unit testing suite.

---

## 📂 Project Structure

```text
├── index.html        # Modern HTML5 app layout, sidebar, and modals
├── style.css         # Responsive mobile-first & desktop CSS design system
├── app.js            # Realtime Firestore sync, authorization, and clip management
├── sw.js             # PWA Service Worker for offline capability
├── manifest.json     # Web App Manifest
└── tests/            # Vitest unit test suite
    └── app.test.js   # Unit tests for hashing, word count, and auth flows
```

---

## 📝 License

Distributed under the MIT License.