import { create } from 'zustand';

type KeyboardLayoutState = {
    lastResumeAt: number,
    bumpLayoutKey: () => void,
}

export const useKeyboardLayoutStore = create<KeyboardLayoutState>((set) => ({
    lastResumeAt:0,
    bumpLayoutKey: () => {
        set({lastResumeAt: Date.now() })
    }
}));