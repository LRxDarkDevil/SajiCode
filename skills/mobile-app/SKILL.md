---
name: mobile-app
description: Build cross-platform mobile applications with React Native and Expo. Covers project setup, navigation (React Navigation, Expo Router), native modules, push notifications, offline-first architecture, app store deployment, responsive layouts, platform-specific code, state management, and performance optimization. Use when building mobile apps or cross-platform experiences.
---

# Mobile App Development

## Stack Selection

| Approach | Best For | Trade-offs |
|----------|----------|-----------|
| Expo (managed) | Most apps, fast iteration | Limited native module access |
| Expo (dev build) | Full native access + Expo DX | Requires native build |
| React Native CLI | Maximum control, custom native | More setup, slower iteration |
| Progressive Web App | Simple mobile web experience | Limited device APIs |

## Project Setup (Expo Router)
```bash
npx -y create-expo-app@latest my-app --template tabs
cd my-app && npx expo start
```

## Navigation (Expo Router)
```
app/
├── _layout.tsx           # Root layout
├── (tabs)/
│   ├── _layout.tsx       # Tab bar layout
│   ├── index.tsx         # Home tab
│   ├── explore.tsx       # Explore tab
│   └── profile.tsx       # Profile tab
├── (auth)/
│   ├── _layout.tsx       # Auth flow layout
│   ├── login.tsx
│   └── register.tsx
├── [id].tsx              # Dynamic route
└── modal.tsx             # Modal screen
```

### Tab Layout
```tsx
import { Tabs } from "expo-router";
import { Home, Search, User } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: "#8b5cf6",
      tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#1a1a1a" },
      headerStyle: { backgroundColor: "#0a0a0a" },
      headerTintColor: "#fff",
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ color }) => <Search size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User size={22} color={color} /> }} />
    </Tabs>
  );
}
```

## Styling (NativeWind / StyleSheet)
```tsx
import { StyleSheet, View, Text } from "react-native";

export function Card({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 4 },
  description: { fontSize: 14, color: "#999", lineHeight: 20 },
});
```

## Data Fetching (TanStack Query)
```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) =>
      fetch("/api/users", { method: "POST", body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
```

## Offline-First Pattern
```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

async function fetchWithOffline<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const isConnected = (await NetInfo.fetch()).isConnected;

  if (isConnected) {
    try {
      const data = await fetchFn();
      await AsyncStorage.setItem(key, JSON.stringify(data));
      return data;
    } catch {
      // Fall through to cache
    }
  }

  const cached = await AsyncStorage.getItem(key);
  if (cached) return JSON.parse(cached);
  throw new Error("No data available offline");
}
```

## Push Notifications (Expo)
```tsx
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: "your-project-id" });
  return token.data;
}
```

## Platform-Specific Code
```tsx
import { Platform } from "react-native";

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
    android: { elevation: 4 },
    default: {},
  }),
});
```

## Performance Rules
- Use `FlatList` for long lists — never `ScrollView` with `.map()`
- Memoize expensive computations with `useMemo` and `useCallback`
- Use `React.memo` for list items
- Optimize images: resize, compress, use `expo-image` for caching
- Avoid inline styles (create `StyleSheet` once)
- Use `Animated` API or `react-native-reanimated` for smooth animations
