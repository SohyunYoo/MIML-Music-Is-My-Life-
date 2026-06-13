import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

export function SkeletonBox({ width, height, borderRadius = 6, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#222', opacity }, style]}
    />
  );
}

export function SkeletonSongRow() {
  return (
    <View style={sk.row}>
      <SkeletonBox width={44} height={44} borderRadius={8} />
      <View style={{ marginLeft: 12, flex: 1, gap: 8 }}>
        <SkeletonBox width="70%" height={12} />
        <SkeletonBox width="40%" height={10} />
      </View>
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={sk.card}>
      <SkeletonBox width="100%" height={100} borderRadius={10} />
      <SkeletonBox width="80%" height={12} style={{ marginTop: 10 }} />
      <SkeletonBox width="50%" height={10} style={{ marginTop: 6 }} />
    </View>
  );
}

const sk = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  card: { padding: 12, flex: 1 },
});
