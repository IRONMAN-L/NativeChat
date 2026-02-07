import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from "react";
import { Alert, Image, ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
type Props = {
    keyboardHeight: { value: number };
    setInputHeight?: (h: number) => void;
    onSend: (inputText: string, images: string[]) => Promise<void>;
    bottomInset: number;
}

export default function MessageInput({ keyboardHeight, setInputHeight, onSend, bottomInset }: Props) {
    const [message, setMessage] = useState<string>('');
    const [images, setImages] = useState<string[]>([]);
    const handleSend = async () => {
        await onSend(message, images);
        setMessage('');
        setImages([]);
    }
    // keyboard go up
    const animatedStyle = useAnimatedStyle(() => {
        const effective = Math.max(keyboardHeight.value - bottomInset, 0);

        return {
            transform: [{ translateY: -effective }]
        }
    })


    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
            Alert.alert('Permission required', 'Permission to access the media library is required');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
            allowsMultipleSelection: images.length > 1 ? false : true,
            selectionLimit: 5
        });

        if (!result.canceled) {
            // Append images
            const newUris = result.assets.map(a => a.uri);
            setImages(prev => [...prev, ...newUris]);
        }
    }

    const openCamera = async () => {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

        if (!permissionResult.granted) {
            Alert.alert('Permission required', 'Permission to open camera is required');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['videos', 'images'],
        });

        if (!result.canceled) {
            setImages(prev => [...prev, result.assets[0].uri])
        }

    }

    const removeImage = (indexToRemove: number) => {
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    }

    return (

        <Animated.View
            style={[
                {
                    position: "absolute",
                    left: 5,
                    right: 5,
                    bottom: bottomInset,
                    backgroundColor: "white",
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                }, animatedStyle
            ]}
            onLayout={(e) => setInputHeight?.(e.nativeEvent.layout.height)}
        >
            {images.length > 0 && (
                <View className="h-32 w-full">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {images.map((uri, index) => (
                            <View key={index} className="w-24 h-24 relative">
                                <Image source={{ uri }} className='w-full h-full rounded-xl' />
                                <TouchableOpacity
                                    className="absolute -top-2 -right-2 bg-gray-200 w-6 h-6 rounded-full justify-center items-center z-10"
                                    onPress={() => removeImage(index)}
                                >
                                    <MaterialIcons name="close" size={16} color="dimgray" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}
            <View className="flex-1 flex-row items-center gap-5">
                <TouchableOpacity className='rounded-full p-2'>
                    <MaterialIcons name="emoji-emotions" size={24} color="gray" />
                </TouchableOpacity>
                <TextInput
                    placeholder="Type something..."
                    value={message}
                    onChangeText={setMessage}
                    placeholderTextColor={'gray'}
                    className="flex-1 bg-white px-3 py-2 text-base max-h-32"
                    multiline={true}

                />

                <TouchableOpacity onPress={pickImage}>
                    <MaterialIcons name="attach-file" size={24} color="black" />
                </TouchableOpacity>
                <TouchableOpacity onPress={openCamera}>
                    <MaterialIcons name="camera-alt" size={24} color="black" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSend} disabled={!message && !images}>
                    <MaterialIcons name={`${(message.trim() || images) ? "send" : "mic"}`} size={24} color="white" className="p-2 bg-[#0e9484] rounded-full" />
                </TouchableOpacity>
            </View>
        </Animated.View>

    )

}