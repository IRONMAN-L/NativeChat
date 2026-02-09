import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';

export const useGradualAnimation = () => {
    const height = useSharedValue(0);

    useKeyboardHandler(
        {
            onMove: (e) => {
                "worklet";
                height.value = Math.max(e.height, 0);

            },
            onEnd: (e) => {
                "worklet";
                height.value = Math.max(e.height, 0);

            }
        }, []
    );


    useEffect(() => {
        const sub = Keyboard.addListener('keyboardDidHide', () => {
            if (height.value > 0) {
                height.value = 0;
            }
        })
        return () => sub.remove();
    }, [height]);

    return { height };
}
