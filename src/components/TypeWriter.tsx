import { useState, useEffect } from 'react';
import { View, Text} from 'react-native'

interface TypeWriterProps {
    text: string,
    speed?: number,
    delay?: number,
    containerClass?: string,
    textClass?: string,
    cursorClass?: string
}
export default function TypeWriter({ text, speed = 50, delay = 0, containerClass = "", textClass = "text-base text-black", cursorClass = "bg-[#0e9484]" }: TypeWriterProps) {

    const [displayedText, setDisplayedText] = useState<string>('');
    const [started, setStarted] = useState<boolean>(false);
    const [showCursor, setShowCursor] = useState<boolean>(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setStarted(true);
        }, delay);
        return () => clearTimeout(timer);
    }, [delay])

    useEffect(() => {
        if (!started) return;
        if (displayedText.length < text.length) {
            const timer = setTimeout(() => {
                setDisplayedText(text.slice(0, displayedText.length + 1));
            }, speed);
            return () => clearTimeout(timer);
        }
    }, [displayedText, started, speed, text]);

    useEffect(() => {
        const cursorTimer = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 500);
        return () => clearInterval(cursorTimer);
    }, []);

    return (
        <View className={`flex-row items-center flex-wrap ${containerClass}`}>
            <Text className={textClass}>
                {displayedText}
            </Text>

            <View
                className={`w-[2px] h-11 ml-1 ${cursorClass} ${showCursor ? 'opacity-100' : 'opacity-0'}`}
            />
        </View>
    )

}