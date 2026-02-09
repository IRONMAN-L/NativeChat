import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { usePathname, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialTopTabs } from "../../../components/MaterialTopTabs";

const Header = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  let title = "NativeChat";
  let showCamera = true;
  let showProfile = true;
  let showSearch = false;


  if (pathname.includes('/status')) {
    title = "Status";
    showCamera = true;
    showProfile = false;
    showSearch = false;
  } else if (pathname.includes('/communities')) {
    title = "Communities"
    showCamera = false;
    showProfile = false;
    showSearch = true;
  } else if (pathname.includes('/calls')) {
    title = "Calls";
    showCamera = false;
    showProfile = false;
    showSearch = true;
  }
  return (
    <View style={{ paddingTop: 15 + insets.top }} className='bg-white flex-row justify-between items-center px-4 pb-3 border-b border-gray-200 shadow-sm'>
      <Text className="text-3xl font-bold text-[#0e9484]">{title}</Text>

      <View className='flex-row gap-5'>
        {showCamera ? <Pressable
          onPress={() => { }}
          android_ripple={{ borderless: true, radius: 20 }}
          className="active:opacity-50"
        >
          <MaterialIcons name="camera-alt" size={24} color="black" />
        </Pressable>
          : null}

        {showSearch ?
          <Pressable
            onPress={() => { }}
            android_ripple={{ borderless: true, radius: 20 }}
            className="active:opacity-50"
          >
            <MaterialIcons name="search" size={24} color="black" />
          </Pressable>
          : null}
        <Pressable
          onPress={() => router.push('/settings')}
          android_ripple={{ borderless: true, radius: 20 }}
          className="active:opacity-50"
        >
          {showProfile ? <MaterialIcons name="account-circle" size={24} color="black" /> : null}
          {!showProfile ? <Ionicons name="ellipsis-vertical" size={24} color="black" /> : null}
        </Pressable>



      </View>
    </View>
  )
}





type IconName = keyof typeof MaterialIcons.glyphMap;

type TabDetails = {
  icon: IconName,
  focused: boolean,
  title: string
}



const TabIcon = ({ icon, focused, title }: TabDetails) => {
  return (
    <View className={`items-center justify-center gap-1 w-20`}>
      <MaterialIcons
        name={icon}
        size={24}

        color={focused ? '#04c068' : 'gray'}
      />


      <Text className={`text-xs ${focused ? 'font-bold ' : 'font-normal'}`}>
        {title}
      </Text>
    </View>
  )
}

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <View className='flex-1 bg-white'>
        <Header />
        <MaterialTopTabs

          initialRouteName="index"
          tabBarPosition="bottom"
          screenOptions={{

            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: 'white',
              borderRadius: 30,
              overflow: 'hidden',
              position: 'absolute',
              bottom: 10,
              left: 15,
              right: 15,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 2 },

            },
            tabBarAndroidRipple: { borderless: true, radius: 30, color: '#e0e0e0' },
            tabBarIndicatorStyle: { backgroundColor: '#0e9864' },
          }}
        >
          <MaterialTopTabs.Screen
            name="index"
            options={{
              title: "Chats",
              tabBarIcon: ({ focused }) => <TabIcon icon="chat" focused={focused} title="Chats" />,
              tabBarBadge: () => (
                <View className='bg-red-600 rounded-full right-5 px-2'>
                  <Text className="text-sm text-white">7</Text>
                </View>
              ),


            }}
          />

          <MaterialTopTabs.Screen
            name="status"
            options={{
              title: "Status",
              tabBarIcon: ({ focused }) => <TabIcon icon="donut-large" focused={focused} title="Status" />
            }}
          />

          <MaterialTopTabs.Screen
            name="communities"
            options={{
              title: "Groups",
              tabBarIcon: ({ focused }) => <TabIcon icon="groups" focused={focused} title="Groups" />

            }}
          />
          <MaterialTopTabs.Screen
            name="calls"
            options={{
              title: "Calls",
              tabBarIcon: ({ focused }) => <TabIcon icon="call" focused={focused} title="Calls" />
            }}
          />

        </MaterialTopTabs>
      </View>
    </SafeAreaView>
  );
}