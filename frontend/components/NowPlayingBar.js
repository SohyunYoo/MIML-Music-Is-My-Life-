import { View, Text, TouchableOpacity, StyleSheet, Animated, Image } from 'react-native';
import { useEffect, useRef } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useSpotify } from '../context/SpotifyContext';

// ── 이퀄라이저 바 ─────────────────────────────────────────────────
function EqBars() {
  const bars = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.7)).current,
    useRef(new Animated.Value(0.5)).current,
  ];

  useEffect(() => {
    const makeAnim = (bar, delay, toVal) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(bar, { toValue: toVal, duration: 300 + Math.random() * 200, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.2, duration: 300 + Math.random() * 200, useNativeDriver: true }),
        ])
      );

    const anims = [
      makeAnim(bars[0], 0,   1.0),
      makeAnim(bars[1], 150, 0.5),
      makeAnim(bars[2], 80,  0.9),
    ];
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={eq.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[eq.bar, { transform: [{ scaleY: bar }] }]}
        />
      ))}
    </View>
  );
}

const eq = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginRight: 8, height: 16 },
  bar: { width: 3, height: 16, backgroundColor: '#CCFF00', borderRadius: 2, transformOrigin: 'bottom' },
});

// ── 메인 바 ───────────────────────────────────────────────────────
export default function NowPlayingBar({ navigation }) {
  const { currentTrack, togglePlay } = usePlayer();
  const { isConnected, searchTrack, playOnSpotify, pauseOnSpotify } = useSpotify();
  const slideY = useRef(new Animated.Value(60)).current;
  const spotifyUriRef = useRef(null);
  const isMounted = useRef(false);

  // ── 새 곡이 세팅되면 여기서 바로 Spotify 재생 시작 ──────────────
  // NowPlayingScreen이 열려있지 않아도 즉시 재생되도록
  useEffect(() => {
    // 탭 전환으로 마운트될 때는 이미 재생 중이므로 다시 시작하지 않음
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (!currentTrack?.title) return;
    let cancelled = false;

    const autoPlay = async () => {
      // isPlaying=false면 재생 안 함
      if (!currentTrack.isPlaying || !isConnected) return;

      let uri = currentTrack.spotifyUri || null;

      // URI 없으면 검색
      if (!uri) {
        const info = await searchTrack(currentTrack.title, currentTrack.artist);
        if (cancelled) return;
        uri = info?.spotifyUri || null;
      }

      if (uri && !cancelled) {
        spotifyUriRef.current = uri;
        await playOnSpotify(uri);
      }
    };

    autoPlay();
    return () => { cancelled = true; };
  }, [currentTrack?.id]);

  // ── isPlaying 토글 동기화 ────────────────────────────────────────
  const prevIsPlaying = useRef(currentTrack?.isPlaying);
  useEffect(() => {
    if (!currentTrack || prevIsPlaying.current === currentTrack.isPlaying) return;
    prevIsPlaying.current = currentTrack.isPlaying;

    if (!isConnected || !spotifyUriRef.current) return;
    if (currentTrack.isPlaying) {
      playOnSpotify(spotifyUriRef.current);
    } else {
      pauseOnSpotify();
    }
  }, [currentTrack?.isPlaying]);

  useEffect(() => {
    if (currentTrack) {
      Animated.spring(slideY, {
        toValue: 0, tension: 80, friction: 12, useNativeDriver: true,
      }).start();
    }
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  return (
    <Animated.View style={[styles.bar, { transform: [{ translateY: slideY }] }]}>
      <TouchableOpacity
        style={styles.inner}
        activeOpacity={0.9}
        onPress={() => navigation?.navigate('NowPlaying')}
      >
        <View style={[styles.thumb, { backgroundColor: currentTrack.albumColor || '#3A2E6E' }]}>
          {currentTrack.albumArt
            ? <Image source={{ uri: currentTrack.albumArt }} style={StyleSheet.absoluteFill} borderRadius={4} />
            : null}
        </View>

        {currentTrack.isPlaying && <EqBars />}

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <View style={styles.sourceRow}>
            <MaterialCommunityIcons name="bluetooth" size={11} color="#CCFF00" />
            <Text style={styles.source}> {currentTrack.source}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
          <Ionicons
            name={currentTrack.isPlaying ? 'pause' : 'play'}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18,18,18,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  thumb: {
    width: 46, height: 46, borderRadius: 8, marginRight: 12,
    overflow: 'hidden',
  },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  source: { color: '#CCFF00', fontSize: 11, fontWeight: '500' },
  playBtn: { padding: 8 },
});
