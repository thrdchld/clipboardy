# 📋 Clipboardy

Clipboardy is a secure, lightweight, and real-time syncing clipboard and note-taking web application. Built with modern vanilla technologies and designed with a premium, responsive glassmorphism user interface, Clipboardy allows you to quickly share text, notes, and links across your devices instantly.

---

## ✨ Features

*   **🔒 Room-Locked Security**: Access notes using a hashed password room mechanism. Built-in local SHA-256 verification ensures your clipboard room remains private.
*   **⚡ Live Real-Time Sync**: Powered by Firebase Firestore, notes sync instantaneously across all active devices without page refreshes.
*   **🛠️ Folder Organization**: Organize your notes into custom folders (e.g., Work, Personal, Snippets).
*   **📱 Progressive Web App (PWA)**: Fully installable on iOS, Android, and Desktop. Serves offline capabilities via Service Workers.
*   **⏳ Advanced Auto-Lock Policies**:
    *   **Strict Lock**: Instantly locks the room when you switch tabs or minimize the window.
    *   **Idle Auto-Lock**: Automatically locks the room after a configurable inactivity period (1, 2, 5, 10, 30, or 60 minutes).
*   **🖼️ Image Lightbox & Downloads**: Pasted/uploaded images can be previewed in a gorgeous fullscreen lightbox and downloaded locally.
*   **🔍 Instant Search**: Real-time fuzzy searching through your note title and contents.
*   **🧹 Smart Trash & Archive**: Archive notes you don't need immediately, or send them to the Trash. Empty the trash with a single click.
*   **📱 Mobile-First FABs**: Dynamic Floating Action Buttons for quick note creation and clearing trash on mobile devices.

---

## 🛠️ Tech Stack

*   **Frontend**: Vanilla HTML5, CSS3 Custom Properties (CSS variables), Vanilla ES6 JavaScript (Modules).
*   **Database**: Firebase Firestore JS SDK (dynamic loading).
*   **PWA Core**: Service Worker caching, `manifest.json`, and Apple web-app configuration.
*   **Test Runner**: Vitest with `jsdom` configuration.

---

## 📂 Project Structure

```text
├── index.html        # Main application HTML & DOM structure
├── style.css         # Custom responsive design system & animations
├── app.js            # Main application logic & Firebase real-time integration
├── sw.js             # PWA Service Worker for offline support
├── manifest.json     # PWA configurations and installation details
├── vite.config.js    # Vitest runner configurations
├── package.json      # Dependencies and test runner script definitions
└── tests/            # Test suite
    ├── app.test.js   # Unit & integration tests for app utilities and auth flow
    └── mocks/        # Firebase mock interfaces for running tests offline
```

---

## 🚀 Getting Started

### Prerequisites

You need a web browser and an internet connection to sync notes. To run the test suite locally, you will need **Node.js** (v18+) and **npm**.

### Development / Local Server

You can run this application by serving the directory with any static web server (such as Vite, Live Server, or Nginx).

To serve with Vite (using developer tooling):

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Run the tests:
    ```bash
    npm test
    ```

---

## 📦 Security Details

*   **Password Hashing**: Room passwords are never stored or transmitted in plain text. A cryptographic hash (SHA-256) is computed on the client side to lock and unlock access to the room.
*   **Tab Switch Lock**: When enabling **Strict Lock**, the application detects browser visibility states (`document.hidden`) and locks the application instantly when the tab loses focus, preventing shoulder-surfing or unauthorized access.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.