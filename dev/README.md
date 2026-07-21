# 📋 Clipboardy

Clipboardy is a secure, lightweight, and real-time syncing multi-device clipboard application. Designed with an elegant earth-tone user interface, Clipboardy allows you to instantly share and sync transient plain text clips across all your devices.

---

## ✨ Features

* **🔒 Room-Locked Security**: Access clipboard rooms securely using 4-digit PIN room hashing or Google Sign-In authentication.
* **⚡ Live Real-Time Sync**: Powered by Firebase Firestore LIFO stream (`limit(50)`), clips sync instantly across active devices.
* **📦 Cold Storage Search**: Perform explicit on-demand searches through your historical clipboard cold storage without slowing down realtime sync.
* **📱 Mobile-First 2-FAB Interface**:
  * **Top FAB (`+`)**: Opens a fullscreen text editor modal for writing, editing, pasting, and saving clips.
  * **Bottom FAB (Paste)**: 1-tap quick action to automatically read your device clipboard and instantly save it to Firestore.
* **📄 Full-Page Preview & Edit**: Tap any clip card (non-selectable list cards up to 3 lines) to open the fullscreen preview modal where text can be selected, copied, edited, or deleted.
* **🎨 Neutral Earth-Tone Theme**: Modern, comfortable single earth-tone palette featuring Tan (`#998767`), Sand (`#AD9F85`), Warm Beige (`#C2B7A4`), Light Gray-Beige (`#D6CFC2`), and Cream (`#EBE7E1`).

---

## 🛠️ Tech Stack

* **Frontend**: Vanilla HTML5, CSS3 Custom Properties (Earth-tone design tokens), Vanilla ES6 JavaScript Modules.
* **Database**: Firebase Firestore JS SDK v11 (Realtime LIFO collection listener & cold storage query).
* **Authentication**: Firebase Anonymous Auth & Google Sign-In SDK.

---

## 📂 Project Structure

```text
├── index.html        # Clean HTML5 structure & DOM elements
├── style.css         # Earth-tone design system, FABs, and modal animations
├── app.js            # Realtime Firestore sync, search, and 2-FAB logic
├── sw.js             # PWA Service Worker for offline support
├── manifest.json     # PWA configuration
└── tests/            # Test suite for utility functions and auth flow
    └── app.test.js   # Unit tests for hash, word counter, and lock state
```

---

## 📝 License

Distributed under the MIT License.