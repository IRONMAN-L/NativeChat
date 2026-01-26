import { TextInput, View, TouchableOpacity, Alert, Platform, Image } from "react-native";
import { useState } from "react";
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
type Props = {
    keyboardHeight: { value: number };
    setInputHeight?: (h: number) => void;
    onSend?: () => void;
    bottomInset: number;
}

export default function MessageInput({ keyboardHeight, setInputHeight, onSend, bottomInset }: Props) {


    const [message, setMessage] = useState<string>('');
    const [image, setImage] = useState<string | null>(null);
    const handleSend = () => {
        console.log(message);
        onSend?.();
        setMessage("");
        setImage(null);
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
            allowsEditing: Platform.OS === 'ios' ? true : false,
            aspect: [4, 3],
            quality: 1,
            allowsMultipleSelection: false,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
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
            {image ? (
                <View className="w-32 h-32">
                    <Image source={{ uri: image }} className='w-full h-full rounded-xl' />
                    <TouchableOpacity className="absolute top-1 right-1 bg-gray-200 w-7 h-7 rounded-full justify-center" onPress={() => setImage(null)}>
                        <MaterialIcons name="close" size={24} color="dimgray" />
                    </TouchableOpacity>
                </View>
            ) : null}
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
                <TouchableOpacity onPress={handleSend} disabled={!message && !image}>
                    <MaterialIcons name={`${(message || image) ? "send" : "mic"}`} size={24} color="white" className="p-2 bg-[#0e9484] rounded-full" />
                </TouchableOpacity>
            </View>
        </Animated.View>

    )

}