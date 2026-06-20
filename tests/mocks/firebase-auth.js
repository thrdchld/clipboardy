export const getAuth = () => ({});
export const signInAnonymously = () => Promise.resolve({ user: { uid: 'mock-user-123' } });
export const onAuthStateChanged = (auth, callback) => {
    callback({ uid: 'mock-user-123' });
    return () => {};
};
