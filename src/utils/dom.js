export const setItemToLocalStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
};

export const getItemFromLocalStorage = (key) => {
    const stored = localStorage.getItem(key) || '';
    if (stored) {
        return JSON.parse(stored);
    }
    return null;
};
