import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  PanResponder, Animated, Image, ScrollView, FlatList,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useSpotify } from '../context/SpotifyContext';

const { width, height } = Dimensions.get('window');
const ALBUM_SIZE = width - 80;
const TRACK_WIDTH = width - 80;

// ── SeekBar ───────────────────────────────────────────────────────
function SeekBar({ progress, onSeek }) {
  const xAnim = useRef(new Animated.Value(progress * TRACK_WIDTH)).current;
  const isDragging = useRef(false);

  // onSeek ref — stale closure 방지
  const onSeekRef = useRef(onSeek);
  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);

  // 드래그 중이 아닐 때만 외부 progress 반영
  useEffect(() => {
    if (isDragging.current) return;
    xAnim.setValue(progress * TRACK_WIDTH);
  }, [progress]);

  const clamp = (x) => Math.max(0, Math.min(TRACK_WIDTH, x));

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,      // 슬라이드 제스처 안정적으로 캡처
    onShouldBlockNativeResponder: () => true,      // 부모 스크롤 충돌 방지

    onPanResponderGrant: (e) => {
      isDragging.current = true;
      xAnim.setValue(clamp(e.nativeEvent.locationX));
    },
    // locationX 직접 추적 → grantX+dx 방식 제거, 손가락 위치 1:1 반응
    onPanResponderMove: (e) => {
      xAnim.setValue(clamp(e.nativeEvent.locationX));
    },
    onPanResponderRelease: (e) => {
      isDragging.current = false;
      const x = clamp(e.nativeEvent.locationX);
      xAnim.setValue(x);
      onSeekRef.current(x / TRACK_WIDTH);
    },
    onPanResponderTerminate: () => {
      // 제스처 빼앗겼을 때 isDragging 초기화
      isDragging.current = false;
    },
  })).current;

  const thumbLeft = xAnim.interpolate({
    inputRange: [0, TRACK_WIDTH], outputRange: [0, TRACK_WIDTH], extrapolate: 'clamp',
  });

  return (
    <View style={seek.container} {...pan.panHandlers}>
      <View style={seek.track}>
        <Animated.View style={[seek.fill, { width: thumbLeft }]} />
        <Animated.View style={[seek.thumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
}
const seek = StyleSheet.create({
  container: { paddingVertical: 12, marginHorizontal: 24 },
  track: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2 },
  fill: { height: 4, backgroundColor: '#CCFF00', borderRadius: 2, position: 'absolute' },
  thumb: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#CCFF00', marginTop: -5, marginLeft: -7,
    shadowColor: '#CCFF00', shadowOpacity: 0.6, shadowRadius: 4, elevation: 4,
  },
});

// ── 가사 ─────────────────────────────────────────────────────────
function parseLrc(lrc) {
  if (!lrc) return [];
  return lrc.split('\n').map(line => {
    const m = line.match(/^\[(\d+):(\d+\.\d+)\]\s*(.*)/);
    if (!m) return null;
    return { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() };
  }).filter(l => l && l.text);
}

async function fetchLyrics(title, artist) {
  try {
    const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.syncedLyrics) return { synced: parseLrc(data.syncedLyrics) };
    if (data.plainLyrics) return { plain: data.plainLyrics };
    return null;
  } catch { return null; }
}

function LyricsPanel({ lyrics, progress, duration }) {
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!lyrics?.synced?.length) return;
    const curTime = progress * (duration / 1000);
    let idx = 0;
    for (let i = 0; i < lyrics.synced.length; i++) {
      if (lyrics.synced[i].time <= curTime) idx = i; else break;
    }
    setActiveIdx(idx);
    scrollRef.current?.scrollTo({ y: Math.max(0, idx - 2) * 32, animated: true });
  }, [progress]);

  if (!lyrics) return <Text style={lyr.empty}>가사 없음</Text>;
  if (lyrics.synced) {
    return (
      <ScrollView ref={scrollRef} style={lyr.wrap} scrollEnabled={false} showsVerticalScrollIndicator={false}>
        {lyrics.synced.map((line, i) => (
          <Text key={i} style={[lyr.line, i === activeIdx && lyr.lineActive]}>{line.text}</Text>
        ))}
      </ScrollView>
    );
  }
  return (
    <ScrollView style={lyr.wrap} showsVerticalScrollIndicator={false}>
      <Text style={lyr.plain}>{lyrics.plain}</Text>
    </ScrollView>
  );
}
const lyr = StyleSheet.create({
  wrap: { maxHeight: 96, marginHorizontal: 24, marginTop: 4 },
  line: { color: '#444', fontSize: 13, textAlign: 'center', lineHeight: 32 },
  lineActive: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { color: '#2A2A2A', fontSize: 11, textAlign: 'center', marginTop: 4 },
  plain: { color: '#555', fontSize: 12, lineHeight: 22, textAlign: 'center' },
});

// ── 재생 큐 패널 ──────────────────────────────────────────────────
function QueuePanel({ visible, onClose, queue, currentTrack, onPlayItem }) {
  const slideY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : height,
      useNativeDriver: true, tension: 80, friction: 12,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[q.sheet, { transform: [{ translateY: slideY }] }]}>
      {/* 핸들 */}
      <View style={q.handle} />
      <View style={q.header}>
        <Text style={q.title}>재생 큐</Text>
        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
          <Ionicons name="close" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      {/* 현재 재생 */}
      {currentTrack && (
        <View style={q.nowSection}>
          <Text style={q.sectionLabel}>지금 재생 중</Text>
          <View style={q.nowRow}>
            <View style={[q.thumb, { backgroundColor: currentTrack.albumColor || '#3A2E6E' }]}>
              {currentTrack.albumArt
                ? <Image source={{ uri: currentTrack.albumArt }} style={StyleSheet.absoluteFill} borderRadius={6} />
                : null}
              <View style={q.nowOverlay}>
                <MaterialCommunityIcons name="equalizer" size={12} color="#CCFF00" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={q.nowTitle} numberOfLines={1}>{currentTrack.title}</Text>
              <Text style={q.nowArtist} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 다음 재생 */}
      <Text style={[q.sectionLabel, { paddingHorizontal: 20, marginTop: 8 }]}>
        다음 재생 ({queue.length}곡)
      </Text>
      {queue.length === 0 ? (
        <View style={q.empty}>
          <Ionicons name="list-outline" size={36} color="#2A2A2A" />
          <Text style={q.emptyText}>큐가 비어 있어요</Text>
          <Text style={q.emptySubText}>홈에서 "전체 재생"으로 큐를 채워보세요</Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={q.queueRow} onPress={() => onPlayItem(item, index)} activeOpacity={0.7}>
              <Text style={q.queueNum}>{index + 1}</Text>
              <View style={[q.thumb, { backgroundColor: item.color || '#3A2E6E' }]}>
                {item.albumImageUrl
                  ? <Image source={{ uri: item.albumImageUrl }} style={StyleSheet.absoluteFill} borderRadius={6} />
                  : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={q.queueTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={q.queueArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
              <Ionicons name="reorder-three-outline" size={18} color="#333" />
            </TouchableOpacity>
          )}
        />
      )}
    </Animated.View>
  );
}
const q = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: height * 0.7, backgroundColor: '#0D0D0D',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginTop: 10,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '600', paddingHorizontal: 20, marginBottom: 8 },
  nowSection: { paddingTop: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', paddingBottom: 14 },
  nowRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 },
  nowTitle: { color: '#CCFF00', fontSize: 14, fontWeight: '600' },
  nowArtist: { color: '#888', fontSize: 12, marginTop: 2 },
  nowOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 6, justifyContent: 'center', alignItems: 'center',
  },
  thumb: { width: 40, height: 40, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: '#444', fontSize: 14, fontWeight: '600' },
  emptySubText: { color: '#333', fontSize: 12 },
  queueRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111', gap: 12,
  },
  queueNum: { color: '#333', fontSize: 12, width: 18, textAlign: 'center' },
  queueTitle: { color: '#fff', fontSize: 13, fontWeight: '500' },
  queueArtist: { color: '#666', fontSize: 11, marginTop: 2 },
});

// ── 메인 ─────────────────────────────────────────────────────────
export default function NowPlayingScreen({ navigation }) {
  const { currentTrack, togglePlay, toggleLike, isLiked, playNext, playPrev, playTrack, queue, setQueue } = usePlayer();
  const { isConnected, playOnSpotify, pauseOnSpotify, seekOnSpotify, getPlayerState, searchTrack } = useSpotify();

  const liked = isLiked(currentTrack?.id);
  const [isPlaying, setIsPlaying] = useState(currentTrack?.isPlaying ?? false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);   // 가사 동기화용 state (ref만으론 리렌더 안 됨)
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // 'off' | 'one' | 'all'
  const repeatRef = useRef('off');
  const [albumArtUrl, setAlbumArtUrl] = useState(null);
  const [lyrics, setLyrics] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [showQueue, setShowQueue] = useState(false);

  const durationRef = useRef(0);
  // durationRef 업데이트 헬퍼 — ref + state 동시 설정
  const setDurationBoth = (ms) => { durationRef.current = ms; setDuration(ms); };
  const spotifyUriRef = useRef(null);
  const localTimerRef = useRef(null);   // 200ms 로컬 타이머 (부드러운 진행바)
  const syncTimerRef = useRef(null);    // 10초 Spotify 보정
  const playStartTimeRef = useRef(0);  // 재생 시작 시각 (Date.now())
  const playStartPosRef = useRef(0);   // 재생 시작 position (ms)
  const isLoadingRef = useRef(false);

  // 외부(NowPlayingBar 등)에서 togglePlay 했을 때 동기화
  useEffect(() => {
    if (currentTrack?.isPlaying !== undefined) {
      setIsPlaying(currentTrack.isPlaying);
    }
  }, [currentTrack?.isPlaying]);

  // ── refs ────────────────────────────────────────────────────────
  const getPlayerStateRef = useRef(getPlayerState);
  const playNextRef = useRef(playNext);
  const seekOnSpotifyRef = useRef(seekOnSpotify);
  const execPlayRef = useRef(null); // 아래에서 할당
  useEffect(() => { getPlayerStateRef.current = getPlayerState; }, [getPlayerState]);
  useEffect(() => { playNextRef.current = playNext; }, [playNext]);
  useEffect(() => { seekOnSpotifyRef.current = seekOnSpotify; }, [seekOnSpotify]);

  // ── 로컬 타이머 (200ms) — Spotify API 없이도 진행바 움직임 ────
  const startLocalTimer = useCallback((startPosMs = 0) => {
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    playStartTimeRef.current = Date.now();
    playStartPosRef.current = startPosMs;

    localTimerRef.current = setInterval(() => {
      const dur = durationRef.current;
      if (!dur) return;
      const elapsed = Date.now() - playStartTimeRef.current;
      const curMs = playStartPosRef.current + elapsed;
      if (curMs >= dur - 1000) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
        setProgress(1);
        if (repeatRef.current === 'one') {
          // 한 곡 반복 — seek to 0 후 재시작
          seekOnSpotifyRef.current?.(0);
          setTimeout(() => startLocalTimer(0), 500);
        } else {
          // 'all': 큐 없으면 현재 곡 다시, 있으면 다음 곡
          if (repeatRef.current === 'all' && !playNextRef.current) {
            seekOnSpotifyRef.current?.(0);
            setTimeout(() => startLocalTimer(0), 500);
          } else {
            playNextRef.current?.();
          }
        }
        return;
      }
      setProgress(curMs / dur);
    }, 200);
  }, []);

  const stopLocalTimer = useCallback(() => {
    if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
    if (syncTimerRef.current)  { clearInterval(syncTimerRef.current);  syncTimerRef.current = null; }
  }, []);

  // ── Spotify 보정 (10초마다) — 로컬 타이머 드리프트 수정 ──────
  const startSyncTimer = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(async () => {
      const state = await getPlayerStateRef.current();
      if (!state) return;
      if (state.duration_ms) setDurationBoth(state.duration_ms);
      if (state.is_playing && state.progress_ms != null) {
        // 로컬 타이머 기준점 재설정 (드리프트 보정)
        playStartTimeRef.current = Date.now();
        playStartPosRef.current = state.progress_ms;
      }
      // 곡 끝 감지
      if (!state.is_playing && state.duration_ms > 0 &&
          state.progress_ms >= state.duration_ms - 2000) {
        stopLocalTimer();
        if (repeatRef.current === 'one') {
          seekOnSpotifyRef.current?.(0);
          setTimeout(() => execPlayRef.current?.(spotifyUriRef.current), 500);
        } else {
          playNextRef.current?.();
        }
      }
    }, 10000);
  }, [stopLocalTimer]);

  // 통합 stop
  const stopPolling = useCallback(() => stopLocalTimer(), [stopLocalTimer]);

  // ── 실제 Spotify 재생 실행 ────────────────────────────────────
  const playOnSpotifyRef = useRef(playOnSpotify);
  useEffect(() => { playOnSpotifyRef.current = playOnSpotify; }, [playOnSpotify]);

  const execPlay = useCallback(async (uri) => {
    if (!uri) return false;
    setStatusMsg('연결 중...');
    const result = await playOnSpotifyRef.current(uri);
    if (result?.ok) {
      setStatusMsg('');
      // 즉시 로컬 타이머 시작 (duration 이미 있으면 바로 진행)
      startLocalTimer(0);
      // 2초 후 Spotify에서 실제 position/duration 받아 보정
      setTimeout(async () => {
        const state = await getPlayerStateRef.current();
        if (state?.duration_ms) {
          durationRef.current = state.duration_ms;
          playStartTimeRef.current = Date.now();
          playStartPosRef.current = state.progress_ms || 0;
        }
        startSyncTimer();
      }, 2000);
      return true;
    } else if (result?.reason === 'no_device') {
      setStatusMsg('Spotify 앱을 열고 아무 곡이나 먼저 재생해주세요');
    } else {
      setStatusMsg(`재생 오류 (${result?.reason})`);
    }
    return false;
  }, [startLocalTimer, startSyncTimer]);

  const pauseOnSpotifyRef = useRef(pauseOnSpotify);
  useEffect(() => { pauseOnSpotifyRef.current = pauseOnSpotify; }, [pauseOnSpotify]);

  // execPlay ref 등록 (sync 타이머에서 repeat-one 재시작용)
  useEffect(() => { execPlayRef.current = execPlay; }, [execPlay]);

  // ── 반복 모드 순환: off → one → all → off ──────────────────────
  const cycleRepeat = useCallback(() => {
    setRepeat(prev => {
      const next = prev === 'off' ? 'one' : prev === 'one' ? 'all' : 'off';
      repeatRef.current = next;
      return next;
    });
  }, []);

  // ── 셔플: 큐를 랜덤으로 섞기 ──────────────────────────────────
  const handleShuffle = useCallback(() => {
    setShuffle(prev => {
      const next = !prev;
      if (next && queue?.length) {
        const arr = [...queue];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        setQueue(arr);
      }
      return next;
    });
  }, [queue, setQueue]);

  // ── 재생/일시정지 핸들러 (직접 Spotify 호출) ─────────────────
  const handlePlayPause = useCallback(async () => {
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);      // UI 즉시 반응
    togglePlay();                 // PlayerContext 상태 동기화

    if (!isConnected) {
      setStatusMsg('프로필에서 Spotify를 연결해주세요');
      return;
    }
    if (!spotifyUriRef.current) {
      setStatusMsg('곡 로딩 중... 잠시 후 다시 눌러주세요');
      return;
    }

    if (willPlay) {
      await execPlay(spotifyUriRef.current);
    } else {
      pauseOnSpotifyRef.current();
      stopPolling();
      setStatusMsg('');
    }
  }, [isPlaying, isConnected, togglePlay, execPlay, stopPolling]);

  // ── 곡 변경 시 URI/앨범아트 로드 → 자동재생 ──────────────────
  useEffect(() => {
    if (!currentTrack?.title) return;
    let cancelled = false;

    const load = async () => {
      isLoadingRef.current = true;
      stopPolling();
      setProgress(0);
      setDurationBoth(0);
      setStatusMsg('');
      setIsPlaying(currentTrack.isPlaying ?? false);
      setAlbumArtUrl(currentTrack.albumArt || null);
      spotifyUriRef.current = currentTrack.spotifyUri || null;

      if (!isConnected) {
        setStatusMsg('프로필에서 Spotify를 연결해주세요');
        isLoadingRef.current = false;
        return;
      }

      // URI 없으면 Spotify 검색
      if (!spotifyUriRef.current) {
        setStatusMsg('검색 중...');
        const info = await searchTrack(currentTrack.title, currentTrack.artist);
        if (cancelled) return;
        if (info?.spotifyUri) {
          spotifyUriRef.current = info.spotifyUri;
          if (!currentTrack.albumArt && info.albumArt) setAlbumArtUrl(info.albumArt);
          if (info.durationMs) setDurationBoth(info.durationMs);
        }
      }

      isLoadingRef.current = false;
      if (cancelled) return;

      if (!spotifyUriRef.current) {
        setStatusMsg('Spotify에서 곡을 찾을 수 없어요');
        return;
      }

      // 재생 상태면 자동 시작
      if (currentTrack.isPlaying) {
        const state = await getPlayerStateRef.current();
        if (state?.is_playing) {
          // NowPlayingBar에서 이미 재생 중 → 현재 position 기준으로 로컬 타이머 시작
          if (state.duration_ms) setDurationBoth(state.duration_ms);
          setStatusMsg('');
          startLocalTimer(state.progress_ms || 0);
          startSyncTimer();
        } else {
          await execPlay(spotifyUriRef.current);
        }
      } else {
        setStatusMsg('');
      }
    };

    load();
    return () => { cancelled = true; stopPolling(); };
  }, [currentTrack?.id, isConnected]);

  // ── 가사 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack?.title) return;
    setLyrics(null);
    fetchLyrics(currentTrack.title, currentTrack.artist).then(l => setLyrics(l));
  }, [currentTrack?.id]);

  const handleSeek = async (ratio) => {
    if (!isConnected) return;
    const posMs = ratio * durationRef.current;
    setProgress(ratio);
    // 로컬 타이머 기준점도 seek 위치로 업데이트
    playStartTimeRef.current = Date.now();
    playStartPosRef.current = posMs;
    await seekOnSpotify(posMs);
  };

  // ── 큐에서 곡 선택 재생 ───────────────────────────────────────
  const handlePlayFromQueue = useCallback((item, index) => {
    setShowQueue(false);
    playTrack({
      ...item,
      source: item.source || 'MIML AI',
      albumColor: item.color || item.albumColor,
      albumArt: item.albumImageUrl || item.albumArt || null,
      spotifyUri: item.spotifyId ? `spotify:track:${item.spotifyId}` : item.spotifyUri || null,
    });
    // 선택한 곡 이후만 큐에 남김
    if (typeof setQueue === 'function') {
      setQueue(prev => prev.slice(index + 1));
    }
  }, [playTrack, setQueue]);

  const formatTime = (ratio) => {
    const total = Math.floor(durationRef.current / 1000) || 0;
    const s = Math.floor(ratio * total);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const screenFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(screenFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  if (!currentTrack) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 54, left: 20 }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <MaterialCommunityIcons name="hexagon-slice-3" size={48} color="#333" />
        <Text style={{ color: '#444', fontSize: 14, marginTop: 16 }}>재생 중인 곡이 없어요</Text>
      </View>
    );
  }

  const albumColor = currentTrack?.albumColor || '#1A1A3E';

  return (
    <Animated.View style={[styles.container, { opacity: screenFade }]}>
      {/* 앨범 컬러 배경 오버레이 */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: albumColor, opacity: 0.18 }]} />

      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.sourceLabel}>{currentTrack.source || 'MIML'}</Text>
          <Text style={styles.logo}>재생 중</Text>
        </View>
        <TouchableOpacity onPress={() => setShowQueue(true)}>
          <Ionicons name="list" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 앨범 아트 — 탭하면 재생/일시정지 */}
      <View style={styles.albumWrapper}>
        {/* 앨범 컬러 glow 그림자 */}
        <View style={[styles.albumGlow, {
          backgroundColor: albumColor,
          shadowColor: albumColor,
        }]} />
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePlayPause}
          style={[styles.album, { backgroundColor: currentTrack?.albumColor || '#3A2E6E' }]}
        >
          {albumArtUrl
            ? <Image source={{ uri: albumArtUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <><View style={styles.albumDeco1} /><View style={styles.albumDeco2} /></>
          }
          {!isPlaying && (
            <View style={styles.albumOverlay}>
              <Ionicons name="play" size={52} color="rgba(255,255,255,0.85)" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 트랙 정보 */}
      <View style={styles.trackInfo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack?.title || '—'}</Text>
          <Text style={styles.trackArtist}>{currentTrack?.artist || '—'}</Text>
          {!!statusMsg && <Text style={styles.statusMsg}>{statusMsg}</Text>}
        </View>
        <TouchableOpacity onPress={() => toggleLike(currentTrack)}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? '#FF4D6D' : '#666'} />
        </TouchableOpacity>
      </View>

      {/* 컨트롤 */}
      <View style={styles.controls}>
        {/* 셔플 */}
        <TouchableOpacity onPress={handleShuffle} style={styles.ctrlBtn}>
          <Ionicons name="shuffle" size={22} color={shuffle ? '#CCFF00' : '#555'} />
          {shuffle && <View style={styles.ctrlDot} />}
        </TouchableOpacity>

        <TouchableOpacity onPress={playPrev}>
          <Ionicons name="play-skip-back" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={playNext} disabled={repeat === 'off' && !queue?.length}>
          <Ionicons name="play-skip-forward" size={28} color={(repeat !== 'off' || queue?.length) ? '#fff' : '#333'} />
        </TouchableOpacity>

        {/* 반복: off → 한 곡(🔂) → 전체(🔁) */}
        <TouchableOpacity onPress={cycleRepeat} style={styles.ctrlBtn}>
          <Ionicons
            name={repeat === 'one' ? 'repeat' : 'repeat'}
            size={22}
            color={repeat !== 'off' ? '#CCFF00' : '#555'}
          />
          {repeat === 'one' && (
            <View style={styles.repeatOneBadge}>
              <Text style={styles.repeatOneText}>1</Text>
            </View>
          )}
          {repeat !== 'off' && <View style={styles.ctrlDot} />}
        </TouchableOpacity>
      </View>

      {/* Spotify 상태 */}
      <View style={styles.connectRow}>
        <MaterialCommunityIcons name="spotify" size={13} color={isConnected ? '#1DB954' : '#444'} />
        <Text style={[styles.connectText, { color: isConnected ? '#1DB954' : '#444' }]}>
          {isConnected ? 'Spotify Connect' : '미연결 — 프로필에서 연결'}
        </Text>
        {queue?.length > 0 && (
          <TouchableOpacity onPress={() => setShowQueue(true)} style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>큐 {queue.length}곡</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 재생 큐 패널 */}
      {showQueue && (
        <TouchableOpacity
          style={styles.queueOverlay}
          activeOpacity={1}
          onPress={() => setShowQueue(false)}
        />
      )}
      <QueuePanel
        visible={showQueue}
        onClose={() => setShowQueue(false)}
        queue={queue || []}
        currentTrack={currentTrack}
        onPlayItem={handlePlayFromQueue}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 8,
  },
  sourceLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5 },
  logo: { color: '#fff', fontSize: 13, fontWeight: '700' },

  albumWrapper: { alignItems: 'center', marginTop: 8 },
  albumGlow: {
    position: 'absolute',
    width: ALBUM_SIZE - 20,
    height: ALBUM_SIZE - 20,
    borderRadius: 20,
    opacity: 0.35,
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 0,
    top: 10,
  },
  album: {
    width: ALBUM_SIZE, height: ALBUM_SIZE,
    borderRadius: 20, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 24, elevation: 16,
  },
  albumDeco1: {
    position: 'absolute', width: 100, height: 100, borderRadius: 4,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.12)', transform: [{ rotate: '45deg' }],
  },
  albumDeco2: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  albumOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  trackInfo: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, marginTop: 14,
  },
  trackTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  trackArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  statusMsg: { color: '#CCFF00', fontSize: 11, marginTop: 4 },

  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 2,
  },
  timeText: { color: '#555', fontSize: 11 },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, marginTop: 8,
  },
  playBtn: {
    backgroundColor: '#CCFF00', width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#CCFF00', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  ctrlBtn: { alignItems: 'center', justifyContent: 'center', width: 32 },
  ctrlDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#CCFF00',
    position: 'absolute', bottom: -6,
  },
  repeatOneBadge: {
    position: 'absolute', top: -5, right: -5,
    backgroundColor: '#CCFF00', borderRadius: 6,
    width: 12, height: 12, justifyContent: 'center', alignItems: 'center',
  },
  repeatOneText: { color: '#000', fontSize: 8, fontWeight: '900' },

  connectRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: 10,
  },
  connectText: { fontSize: 11, fontWeight: '600' },
  queueBadge: {
    marginLeft: 8, backgroundColor: '#1A1A1A',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  queueBadgeText: { color: '#CCFF00', fontSize: 10, fontWeight: '700' },

  queueOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
