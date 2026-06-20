export const getFirestore = () => ({});
export const doc = () => ({});
export const setDoc = () => Promise.resolve();
export const onSnapshot = (ref, callback) => {
    callback({
        exists: () => true,
        data: () => ({ folders: [{ id: 'default', name: 'General' }] }),
        forEach: (fn) => fn({ id: 'note123', data: () => ({ text: 'Test note content', folderId: 'default', pinned: false, archived: false, updatedAt: Date.now() }) })
    });
    return () => {};
};
export const serverTimestamp = () => Date.now();
export const collection = () => ({});
export const query = () => ({});
export const where = () => ({});
export const deleteDoc = () => Promise.resolve();
export const getDoc = () => Promise.resolve({
    exists: () => true,
    data: () => ({ folders: [{ id: 'default', name: 'General' }] })
});
