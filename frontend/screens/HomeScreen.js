import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, PanResponder, Animated, Dimensions, TouchableWithoutFeedback, Image,
} from 'react-native';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import NowPlayingBar from '../components/NowPlayingBar';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import SaveAsPlaylistModal from '../components/SaveAsPlaylistModal';
import { SkeletonSongRow } from '../components/Skeleton';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// ── 타이핑 애니메이션 ─────────────────────────────────────────────
function TypingIndicator() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 180),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.aiWrap}>
      <View style={styles.aiAvatar}>
        <MaterialCommunityIcons name="hexagon-slice-3" size={14} color="#CCFF00" />
      </View>
      <View style={[styles.bubble, styles.aiBubble, { flexDirection: 'row', gap: 5, paddingVertical: 14 }]}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#CCFF00', opacity: dot }} />
        ))}
      </View>
    </View>
  );
}

// ── 개인화 슬라이더 ───────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
// wrapper paddingH 16*2=32, labelNow 52, track marginH 8*2=16, labelVibe 60 → 실제 트랙 너비
const SLIDER_TRACK = SCREEN_WIDTH - 160;

function AlphaSlider({ value, onChange }) {
  const trackWidth = useRef(SLIDER_TRACK);
  const x = useRef(new Animated.Value(value * SLIDER_TRACK)).current;
  const isDragging = useRef(false);
  const grantX = useRef(0); // grant 시점의 절대 위치 (locationX)

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (isDragging.current) return;
    x.setValue(value * trackWidth.current);
  }, [value]);

  const clamp = (v) => Math.max(0, Math.min(trackWidth.current, v));

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      isDragging.current = true;
      const w = trackWidth.current;
      grantX.current = Math.max(0, Math.min(w, e.nativeEvent.locationX));
      x.setValue(grantX.current);
    },
    onPanResponderMove: (_, g) => {
      const w = trackWidth.current;
      x.setValue(Math.max(0, Math.min(w, grantX.current + g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      isDragging.current = false;
      const w = trackWidth.current;
      const nx = Math.max(0, Math.min(w, grantX.current + g.dx));
      x.setValue(nx);
      onChangeRef.current(nx / w);
    },
    onPanResponderTerminate: () => {
      isDragging.current = false;
    },
  })).current;

  const thumbLeft = x.interpolate({ inputRange: [0, SLIDER_TRACK], outputRange: [0, SLIDER_TRACK], extrapolate: 'clamp' });
  const pct = Math.round(value * 100);
  return (
    <View style={sl.wrapper}>
      <Text style={sl.labelNow}>Now <Text style={sl.pct}>{pct}%</Text></Text>
      {/* 터치 영역을 넓게 — 안에 얇은 트랙 시각적으로만 */}
      <View
        style={sl.trackHitArea}
        {...pan.panHandlers}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
      >
        <View style={sl.track} pointerEvents="none">
          <Animated.View style={[sl.fill, { width: thumbLeft }]} />
          <Animated.View style={[sl.thumb, { left: thumbLeft }]} />
        </View>
      </View>
      <Text style={sl.labelVibe}>My Vibe <Text style={sl.pct}>{100 - pct}%</Text></Text>
    </View>
  );
}
const sl = StyleSheet.create({
  wrapper: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  labelNow: { color: '#aaa', fontSize: 10, fontWeight: '700', width: 52 },
  labelVibe: { color: '#CCFF00', fontSize: 10, fontWeight: '700', width: 60, textAlign: 'right' },
  pct: { fontWeight: '400', color: '#666' },
  trackHitArea: {
    flex: 1, height: 36, marginHorizontal: 8,
    justifyContent: 'center',
  },
  track: { height: 3, backgroundColor: '#222', borderRadius: 2 },
  fill: { height: 3, backgroundColor: '#CCFF00', borderRadius: 2, position: 'absolute', left: 0 },
  thumb: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#CCFF00', marginLeft: -8, top: -6.5 },
});

// ── 추천 의도 키워드 판별 ─────────────────────────────────────────
const isRecommendIntent = (text) => {
  const keywords = ['추천', '틀어', '들려', '플레이리스트', '노래', '곡', '음악', '찾아'];
  return keywords.some(k => text.includes(k));
};

// ── 빠른 시작 제안 ────────────────────────────────────────────────
const SUGGESTIONS = [
  '☀️  오늘 한강 산책하며 듣기 좋은 노래 추천해줘',
  '🌧️  비 오는 날 집에서 공부할 때 듣기 좋은 노래',
  '🔥  기분 업 될 수 있는 신나는 곡 추천해줘',
];

function QuickSuggestions({ onSelect }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.suggestWrap, { opacity: fadeAnim }]}>
      <View style={styles.logoMark}>
        <MaterialCommunityIcons name="hexagon-slice-3" size={32} color="#CCFF00" />
      </View>
      <Text style={styles.suggestTitle}>오늘 어떤 음악 찾으세요?</Text>
      <Text style={styles.suggestSub}>자연어로 상황·감정을 말해주세요</Text>
      <View style={{ gap: 8, marginTop: 20, width: '100%' }}>
        {SUGGESTIONS.map((s, i) => {
          const chipFade = useRef(new Animated.Value(0)).current;
          const chipX    = useRef(new Animated.Value(20)).current;
          useEffect(() => {
            Animated.parallel([
              Animated.timing(chipFade, { toValue: 1, duration: 350, delay: 500 + i * 100, useNativeDriver: true }),
              Animated.timing(chipX,    { toValue: 0, duration: 350, delay: 500 + i * 100, useNativeDriver: true }),
            ]).start();
          }, []);
          return (
            <Animated.View key={i} style={{ opacity: chipFade, transform: [{ translateX: chipX }] }}>
              <TouchableOpacity style={styles.suggestChip} onPress={() => onSelect(s.replace(/^.{2}\s+/, ''))}>
                <Text style={styles.suggestChipText}>{s}</Text>
                <Ionicons name="arrow-forward" size={14} color="#CCFF00" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ── 곡 아이템 ─────────────────────────────────────────────────────
function SongItem({ song, onPlay, onFeedback, onAddToPlaylist }) {
  const { currentTrack } = usePlayer();
  const isActive = currentTrack?.id === song.id;
  const [liked, setLiked] = useState(null);

  return (
    <TouchableOpacity style={styles.songRow} onPress={() => onPlay(song)} activeOpacity={0.75}>
      <View style={[styles.songThumb, { backgroundColor: song.color || '#3A2E6E' }]}>
        {song.albumImageUrl
          ? <Image source={{ uri: song.albumImageUrl }} style={StyleSheet.absoluteFill} borderRadius={6} />
          : null
        }
        {isActive && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
            <MaterialCommunityIcons name="equalizer" size={14} color="#CCFF00" />
          </View>
        )}
      </View>
      <View style={styles.songMeta}>
        <Text style={[styles.songTitle, isActive && { color: '#CCFF00' }]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.songArtist}>{song.artist}</Text>
        {song.reason ? <Text style={styles.songReason}>{song.reason}</Text> : null}
      </View>
      {/* song 전체를 전달해야 musicId를 쓸 수 있음 */}
      <TouchableOpacity onPress={() => { setLiked('like'); onFeedback(song, true); }} style={styles.iconBtn}>
        <Ionicons name="heart" size={15} color={liked === 'like' ? '#FF4D6D' : '#444'} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setLiked('dislike'); onFeedback(song, false); }} style={styles.iconBtn}>
        <Ionicons name="close-circle" size={15} color={liked === 'dislike' ? '#888' : '#444'} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onAddToPlaylist([song])} style={styles.iconBtn}>
        <Ionicons name="add-circle-outline" size={17} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── 취향 프로필 카드 ──────────────────────────────────────────────
const PROFILE_ITEMS = [
  { key: 'energy',       label: 'Energy',       emoji: '⚡', max: 100 },
  { key: 'happiness',    label: 'Happiness',    emoji: '😊', max: 100 },
  { key: 'danceability', label: 'Dance',        emoji: '💃', max: 100 },
  { key: 'acousticness', label: 'Acoustic',     emoji: '🎸', max: 100 },
  { key: 'tempo',        label: 'Tempo',        emoji: '🥁', max: 200 },
];

function TasteProfileCard({ profile, feedbackCount }) {
  const [open, setOpen] = useState(false);
  if (!profile) return null;
  return (
    <View style={styles.profileCard}>
      <TouchableOpacity style={styles.profileHeader} onPress={() => setOpen(v => !v)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="tune-variant" size={13} color="#CCFF00" />
          <Text style={styles.profileHeaderText}>내 취향 프로필</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#555" />
      </TouchableOpacity>
      {open && (
        <View style={styles.profileBody}>
          {PROFILE_ITEMS.map(item => {
            const val = profile[item.key] ?? 0;
            const pct = Math.min(100, Math.round((val / item.max) * 100));
            return (
              <View key={item.key} style={styles.profileRow}>
                <Text style={styles.profileEmoji}>{item.emoji}</Text>
                <Text style={styles.profileLabel}>{item.label}</Text>
                <View style={styles.profileBarBg}>
                  <View style={[styles.profileBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.profileVal}>{val}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── 피드백 이유 선택지 ────────────────────────────────────────────
const DISLIKE_REASONS = [
  { id: 'mood_diff',    label: '분위기가 달라요',      emoji: '🌫️' },
  { id: 'genre_diff',   label: '장르가 안 맞아요',     emoji: '🎸' },
  { id: 'tempo_diff',   label: '템포가 달라요',        emoji: '⏱️' },
  { id: 'already_know', label: '이미 아는 곡들이에요', emoji: '😅' },
  { id: 'want_upbeat',  label: '더 신나는 곡 원해요',  emoji: '🔥' },
  { id: 'want_calm',    label: '더 차분한 곡 원해요',  emoji: '🌙' },
  { id: 'want_korean',  label: '한국 노래 원해요',     emoji: '🇰🇷' },
  { id: 'want_foreign', label: '외국 노래 원해요',     emoji: '🌍' },
];

function FeedbackRow({ onFeedback }) {
  const [step, setStep] = useState('idle'); // 'idle' | 'why' | 'done'
  const [doneMsg, setDoneMsg] = useState('');

  const handleGood = () => {
    onFeedback({ vote: 'good', reason: null });
    setDoneMsg('👍 이런 추천 더 드릴게요!');
    setStep('done');
  };

  const handleBad = () => setStep('why');

  const handleReason = (reason) => {
    onFeedback({ vote: 'bad', reason: reason.id, reasonLabel: reason.label });
    setDoneMsg(`알겠어요! "${reason.label}" 반영해서 다시 추천할게요 🔄`);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <View style={styles.feedbackRow}>
        <Text style={styles.feedbackDone}>{doneMsg}</Text>
      </View>
    );
  }

  if (step === 'why') {
    return (
      <View style={styles.feedbackWhyBox}>
        <View style={styles.feedbackWhyHeader}>
          <Text style={styles.feedbackWhyTitle}>어떤 점이 아쉬웠나요?</Text>
          <TouchableOpacity onPress={() => setStep('idle')}>
            <Ionicons name="close" size={16} color="#555" />
          </TouchableOpacity>
        </View>
        <View style={styles.feedbackReasons}>
          {DISLIKE_REASONS.map(r => (
            <TouchableOpacity
              key={r.id}
              style={styles.feedbackReasonChip}
              onPress={() => handleReason(r)}
            >
              <Text style={styles.feedbackReasonEmoji}>{r.emoji}</Text>
              <Text style={styles.feedbackReasonText}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.feedbackRow}>
      <Text style={styles.feedbackLabel}>이 추천이 마음에 드셨나요?</Text>
      <TouchableOpacity style={styles.feedbackBtn} onPress={handleGood}>
        <Text style={{ fontSize: 18 }}>👍</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.feedbackBtn} onPress={handleBad}>
        <Text style={{ fontSize: 18 }}>👎</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── 서버 응답 디버그 카드 ─────────────────────────────────────────
function DebugCard({ info }) {
  const [open, setOpen] = useState(false);
  if (!info) return null;
  return (
    <View style={styles.debugWrap}>
      <TouchableOpacity style={styles.debugHeader} onPress={() => setOpen(v => !v)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="server" size={11} color="#CCFF00" />
          <Text style={styles.debugHeaderText}>서버 응답 확인</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#555" />
      </TouchableOpacity>
      {open && (
        <View style={styles.debugBody}>
          <Text style={styles.debugLine}>📊 전체 후보: <Text style={styles.debugVal}>{info.totalCandidates}곡</Text></Text>
          <Text style={styles.debugLine}>✅ 반환 수: <Text style={styles.debugVal}>{info.returnedCount}곡</Text></Text>
          <Text style={styles.debugLine}>⏱ 응답 시간: <Text style={styles.debugVal}>{info.responseTime}ms</Text></Text>
          <Text style={styles.debugLine}>🏆 최고 점수: <Text style={styles.debugVal}>{info.topScore}</Text></Text>
          <Text style={styles.debugLine}>📉 최저 점수: <Text style={styles.debugVal}>{info.bottomScore}</Text></Text>
          <Text style={[styles.debugLine, { marginTop: 6, color: '#444' }]}>RAW JSON (top 1):</Text>
          <Text style={styles.debugRaw}>{JSON.stringify(info.firstItem, null, 2)}</Text>
        </View>
      )}
    </View>
  );
}

// ── 추천 곡 목록 + 하단 액션 버튼 ────────────────────────────────
function SongResultBlock({ songs, onPlay, onFeedback, onAddToPlaylist, onPlayAll, onSaveAll, onBlockFeedback }) {
  return (
    <View>
      {songs.map(s => (
        <SongItem
          key={s.id}
          song={s}
          onPlay={onPlay}
          onFeedback={onFeedback}
          onAddToPlaylist={onAddToPlaylist}
        />
      ))}
      {/* 하단 액션 */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtnFill} onPress={() => onPlayAll(songs)}>
          <Ionicons name="play" size={14} color="#000" />
          <Text style={styles.actionBtnFillText}>전체 재생</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnOutline} onPress={() => onSaveAll(songs)}>
          <Ionicons name="add" size={14} color="#CCFF00" />
          <Text style={styles.actionBtnOutlineText}>플레이리스트로 저장</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── 채팅 버블 ─────────────────────────────────────────────────────
function Bubble({ msg, onPlay, onFeedback, onAddToPlaylist, onPlayAll, onSaveAll, onBlockFeedback }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        msg.isUser ? styles.userWrap : styles.aiWrap,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {!msg.isUser && (
        <View style={styles.aiAvatar}>
          <MaterialCommunityIcons name="hexagon-slice-3" size={14} color="#CCFF00" />
        </View>
      )}
      <View style={{ flex: 1, maxWidth: '90%' }}>
        <View style={[styles.bubble, msg.isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={styles.bubbleText}>{msg.text}</Text>
        </View>
        {msg.songs?.length > 0 && (
          <SongResultBlock
            songs={msg.songs}
            onPlay={onPlay}
            onFeedback={onFeedback}
            onAddToPlaylist={onAddToPlaylist}
            onPlayAll={onPlayAll}
            onSaveAll={onSaveAll}
            onBlockFeedback={(vote) => onBlockFeedback?.(msg.id, vote)}
            debugInfo={msg.debugInfo}
          />
        )}
      </View>
    </Animated.View>
  );
}

// ── 백엔드 설정 ──────────────────────────────────────────────────
const BACKEND_URL = 'http://13.209.228.73:8080';
const SONG_COLORS = ['#2E2560', '#3A2E6E', '#4A3F8A', '#5248C0', '#2E4060', '#3E2E50', '#1E3A5F'];

// ── 메인 ─────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;
  const [sessions, setSessions] = useState([
    { id: '1', title: '새 대화', preview: '', active: true },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');

  const [isTyping, setIsTyping] = useState(false);
  const [songCount, setSongCount] = useState(10);
  const lastQueryRef = useRef('');
  const lastQuery = lastQueryRef.current;
  const [addModalSongs, setAddModalSongs] = useState(null);
  const [saveModalSongs, setSaveModalSongs] = useState(null);
  const listRef = useRef(null);
  const { playTrack, playAll, tasteProfile, feedbackCount, updateTasteProfile, alpha, setAlpha } = usePlayer();
  const { getIdToken, user } = useAuth();

  // 앱 시작 시 백엔드에서 최신 취향 프로필 로드
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile) updateTasteProfile(data.profile, data.feedbackCount ?? 0);
      } catch (e) { console.log('profile load error:', e.message); }
    };
    loadProfile();
  }, [user]);

  const handlePlay = useCallback((song) => {
    playTrack({
      ...song,
      source: 'MIML AI',
      albumColor: song.color,
      albumArt: song.albumImageUrl || null,
      spotifyUri: song.spotifyId ? `spotify:track:${song.spotifyId}` : null,
    });
  }, [playTrack]);

  const handlePlayAll = useCallback((songs) => {
    playAll(songs.map(s => ({
      ...s,
      source: 'MIML AI',
      albumColor: s.color,
      albumArt: s.albumImageUrl || null,
      spotifyUri: s.spotifyId ? `spotify:track:${s.spotifyId}` : null,
    })));
  }, [playAll]);

  const openDrawer = () => {
    setShowDrawer(true);
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerAnim, { toValue: -SCREEN_WIDTH * 0.75, duration: 220, useNativeDriver: true }).start(() => setShowDrawer(false));
  };
  const startNewSession = () => {
    const id = Date.now().toString();
    if (messages.length > 0) {
      setSessions(prev => prev.map(s => s.id === activeSessionId
        ? { ...s, title: messages[0]?.text?.slice(0, 20) || '대화', preview: `${messages.length}개 메시지`, active: false }
        : s
      ).concat([{ id, title: '새 대화', preview: '', active: true }]));
    } else {
      setSessions(prev => [...prev, { id, title: '새 대화', preview: '', active: true }]);
    }
    setActiveSessionId(id);
    setMessages([]);
    closeDrawer();
  };

  // ── 개별 곡 👍👎 → /api/feedback/satisfaction ───────────────────
  const handleFeedback = useCallback(async (song, isLiked) => {
    const musicId = song.musicId ?? parseInt(song.id);
    if (!musicId) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/feedback/satisfaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ musicId, isLiked }),
      });
      if (!res.ok) { console.log('satisfaction error:', res.status); return; }
      const data = await res.json();
      if (data.detail?.profile) {
        updateTasteProfile(data.detail.profile, feedbackCount + 1);
      }
    } catch (e) {
      console.log('satisfaction fetch error:', e.message);
    }
  }, [getIdToken, feedbackCount, updateTasteProfile]);

  const handleAddToPlaylist = useCallback((songs) => {
    setAddModalSongs(songs);
  }, []);

  const handleSaveAll = useCallback((songs) => {
    setSaveModalSongs(songs);
  }, []);

  // ── 공통 추천 fetch 로직 ──────────────────────────────────────────
  const buildRecommendRequest = (query, extraBody = {}) => ({
    description: query,
    profileRatio: alpha,   // 0=지금분위기, 1=내취향
    limit: songCount,
    ...extraBody,
  });

  const parseRecommendResponse = (data, isRetry) => {
    const rawList = data.recommendations || [];
    const songs = rawList.map((item, idx) => ({
      id: String(item.musicId || idx),
      title: item.title || '알 수 없음',
      artist: item.artist || '알 수 없음',
      album: item.album || '',
      albumImageUrl: item.albumImageUrl || null,
      spotifyId: item.spotifyId || null,
      musicId: item.musicId || null,
      reason: '',
      color: SONG_COLORS[idx % SONG_COLORS.length],
    }));
    const scores = rawList.map(i => i.score).filter(Boolean);
    const total = data.totalCandidates || 0;
    return {
      songs,
      moodFeatures: data.moodFeatures || null,   // mood 피드백 때 그대로 재사용
      debugInfo: {
        totalCandidates: total,
        returnedCount: data.returnedCount || songs.length,
        topScore: scores.length ? Math.max(...scores).toFixed(4) : 'N/A',
        bottomScore: scores.length ? Math.min(...scores).toFixed(4) : 'N/A',
        firstItem: rawList[0] || null,
      },
      replyText: songs.length > 0
        ? (data.message || (isRetry ? `다시 골라봤어요! 새로운 ${songs.length}곡이에요 🔄` : `딱 맞는 ${songs.length}곡 가져왔어요 🎵`))
        : (data.message || '조건에 맞는 곡을 찾지 못했어요. 다른 표현으로 다시 시도해 보세요.'),
    };
  };

  // ── 재추천 (피드백 후) ────────────────────────────────────────────
  const requestRecommendation = async ({ query, excludeIds = [], isRetry = false }) => {
    setIsTyping(true);
    const startTime = Date.now();
    try {
      const token = await getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/recommend/smart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildRecommendRequest(query,
          excludeIds.length > 0 ? { excludeIds } : {}
        )),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const { songs, moodFeatures, debugInfo, replyText } = parseRecommendResponse(data, isRetry);
      debugInfo.responseTime = Date.now() - startTime;
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: replyText,
        isUser: false,
        songs: songs.length > 0 ? songs : null,
        moodFeatures,
        debugInfo,
      }]);
    } catch (e) {
      console.log('백엔드 에러:', e.message);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `서버 연결에 실패했어요. 🔌\n(${e.message})`,
        isUser: false,
        songs: null,
      }]);
    } finally {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ── 블록 피드백 처리 (👍👎 + 이유) ──────────────────────────────
  const handleBlockFeedback = useCallback(async (msgId, { vote, reason, reasonLabel }) => {
    const msg = messages.find(m => m.id === msgId);
    const songs = msg?.songs || [];
    const moodFeatures = msg?.moodFeatures || null;
    const msgIdx = messages.findIndex(m => m.id === msgId);
    const originalQuery = messages.slice(0, msgIdx).reverse().find(m => m.isUser)?.text || '';
    const isPositive = vote === 'good';
    const token = await getIdToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const musicIds = songs.map(s => s.musicId).filter(Boolean);

    // 1) satisfaction — 곡별 개별 호출
    let lastProfile = null;
    await Promise.all(songs.map(async (song) => {
      const musicId = song.musicId ?? parseInt(song.id);
      if (!musicId) return;
      try {
        const res = await fetch(`${BACKEND_URL}/api/feedback/satisfaction`, {
          method: 'POST', headers,
          body: JSON.stringify({ musicId, isLiked: isPositive }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.detail?.profile) lastProfile = data.detail.profile;
        }
      } catch (e) { console.log('satisfaction error:', e.message); }
    }));

    if (lastProfile) updateTasteProfile(lastProfile, feedbackCount + songs.length);

    // 2) mood — 한 번만 호출 (musicIds 배열 + moodFeatures)
    if (musicIds.length > 0 && moodFeatures) {
      try {
        await fetch(`${BACKEND_URL}/api/feedback/mood`, {
          method: 'POST', headers,
          body: JSON.stringify({ musicIds, isPositive, moodFeatures }),
        });
      } catch (e) { console.log('mood error:', e.message); }
    }

    // Firebase 로그 저장
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user?.uid || 'anonymous',
        vote, reason: reason || null, reasonLabel: reasonLabel || null,
        originalQuery,
        musicIds: songs.map(s => s.musicId).filter(Boolean),
        songTitles: songs.map(s => s.title),
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.log('Firebase 저장 실패:', e.code, e.message);
    }

    // 👎 피드백 → 그냥 알겠다는 메시지만 (재추천 X)
    if (vote === 'bad') {
      const ackMap = {
        'mood_diff':    '분위기를 다르게 해볼게요 🎵',
        'genre_diff':   '장르를 바꿔볼게요 🎸',
        'tempo_diff':   '템포를 조절해볼게요 🥁',
        'already_know': '새로운 곡으로 찾아볼게요 ✨',
        'want_upbeat':  '더 신나는 곡으로 찾아볼게요 🔥',
        'want_calm':    '더 차분한 곡으로 찾아볼게요 🌙',
        'want_korean':  '한국 노래로 찾아볼게요 🇰🇷',
        'want_foreign': '해외 노래로 찾아볼게요 🌍',
      };
      const ack = reason ? (ackMap[reason] || '피드백 반영했어요!') : '알겠어요, 다음엔 더 잘 맞춰드릴게요!';
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: ack,
        isUser: false,
        songs: null,
      }]);
    }
  }, [messages, user, getIdToken, feedbackCount, updateTasteProfile]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;

    // 유저 메시지 추가
    setMessages(prev => {
      if (prev.length === 0) {
        setSessions(s => s.map(ss => ss.id === activeSessionId
          ? { ...ss, title: msg.slice(0, 22), preview: '방금 시작됨' } : ss
        ));
      }
      return [...prev, { id: Date.now().toString(), text: msg, isUser: true, songs: null }];
    });
    setInput('');

    // ── 추천 의도 없으면 힌트 메시지 ──────────────────────────────
    if (!isRecommendIntent(msg)) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `"추천", "노래", "곡" 같은 키워드를 포함해서 말해주세요!\n예) "비 오는 날 감성적인 노래 추천해줘"`,
        isUser: false,
        songs: null,
      }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }

    lastQueryRef.current = msg;
    setIsTyping(true);
    const startTime = Date.now();

    try {
      const token = await getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/recommend/smart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildRecommendRequest(msg)),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const { songs, moodFeatures, debugInfo, replyText } = parseRecommendResponse(data, false);
      debugInfo.responseTime = Date.now() - startTime;

      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: replyText,
        isUser: false,
        songs: songs.length > 0 ? songs : null,
        moodFeatures,
        debugInfo,
      }]);
    } catch (e) {
      console.log('백엔드 에러:', e.message);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `서버 연결에 실패했어요. 잠시 후 다시 시도해주세요. 🔌\n(${e.message})`,
        isUser: false,
        songs: null,
      }]);
    } finally {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.logo}>MIML</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-circle-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 슬라이더 항상 표시 */}
      <AlphaSlider value={alpha} onChange={setAlpha} />

      {/* 취향 프로필 카드 */}
      <TasteProfileCard profile={tasteProfile} feedbackCount={feedbackCount} />

      {/* 곡 수 설정 */}
      <View style={styles.countRow}>
        <Text style={styles.countLabel}>추천 곡 수</Text>
        {[5, 10, 15, 20].map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.countChip, songCount === n && styles.countChipActive]}
            onPress={() => setSongCount(n)}
          >
            <Text style={[styles.countChipText, songCount === n && styles.countChipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 드로어 오버레이 */}
      {showDrawer && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <View style={styles.drawerOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* 왼쪽 드로어 */}
      {showDrawer && (
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>대화 기록</Text>
            <TouchableOpacity onPress={closeDrawer}>
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.newChatBtn} onPress={startNewSession}>
            <Ionicons name="add" size={18} color="#000" />
            <Text style={styles.newChatText}>새 대화</Text>
          </TouchableOpacity>

          <FlatList
            data={[...sessions].reverse()}
            keyExtractor={s => s.id}
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.sessionItem, item.id === activeSessionId && styles.sessionItemActive]}
                onPress={() => {
                  setActiveSessionId(item.id);
                  closeDrawer();
                }}
              >
                <Ionicons name="chatbubble-outline" size={14} color={item.id === activeSessionId ? '#CCFF00' : '#555'} style={{ marginRight: 10, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionTitle, item.id === activeSessionId && { color: '#fff' }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.preview ? <Text style={styles.sessionPreview} numberOfLines={1}>{item.preview}</Text> : null}
                </View>
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}

      {/* 채팅 / 첫 화면 */}
      {messages.length === 0 && !isTyping ? (
        <QuickSuggestions onSelect={sendMessage} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          style={styles.chatList}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <Bubble
              msg={item}
              onPlay={handlePlay}
              onFeedback={handleFeedback}
              onAddToPlaylist={handleAddToPlaylist}
              onPlayAll={handlePlayAll}
              onSaveAll={handleSaveAll}
              onBlockFeedback={handleBlockFeedback}
            />
          )}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <NowPlayingBar navigation={navigation} />

      {/* 입력바 */}
      <View style={styles.inputBar}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="어떤 음악 찾으세요?"
            placeholderTextColor="#555"
            value={input}
            onChangeText={setInput}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && { backgroundColor: '#333' }]}
            onPress={() => sendMessage()}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={18} color={input.trim() ? '#000' : '#666'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 곡 하나 추가 모달 */}
      <AddToPlaylistModal
        visible={!!addModalSongs}
        onClose={() => setAddModalSongs(null)}
        songs={addModalSongs || []}
        mode="single"
      />

      {/* 전체 새 플레이리스트로 저장 모달 */}
      <SaveAsPlaylistModal
        visible={!!saveModalSongs}
        onClose={() => setSaveModalSongs(null)}
        songs={saveModalSongs || []}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 10,
  },
  logo: { fontSize: 34, fontWeight: '900', color: '#CCFF00', letterSpacing: -4 },

  drawerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10,
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: SCREEN_WIDTH * 0.75, backgroundColor: '#0D0D0D',
    zIndex: 11, paddingTop: 54, borderRightWidth: 1, borderRightColor: '#1A1A1A',
  },
  drawerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  drawerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, backgroundColor: '#CCFF00', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  newChatText: { color: '#000', fontSize: 14, fontWeight: '700' },
  sessionItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  sessionItemActive: { backgroundColor: '#161616' },
  sessionTitle: { color: '#888', fontSize: 13, fontWeight: '500' },
  sessionPreview: { color: '#444', fontSize: 11, marginTop: 2 },

  suggestWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 60,
  },
  logoMark: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  suggestTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  suggestSub: { color: '#666', fontSize: 13, marginTop: 6, textAlign: 'center' },
  suggestChip: {
    backgroundColor: '#111', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A',
    paddingHorizontal: 16, paddingVertical: 13,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  suggestChipText: { color: '#ccc', fontSize: 13, flex: 1 },

  chatList: { flex: 1 },
  userWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 5 },
  aiWrap: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 5 },
  aiAvatar: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#1E1E1E',
    justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 2,
  },
  bubble: { borderRadius: 18, paddingVertical: 11, paddingHorizontal: 15 },
  userBubble: { backgroundColor: '#242424', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  aiBubble: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bubbleText: { color: '#f0f0f0', fontSize: 14, lineHeight: 22 },

  songRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  songThumb: {
    width: 46, height: 46, borderRadius: 8, marginRight: 12,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  songMeta: { flex: 1 },
  songTitle: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  songArtist: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  songReason: {
    color: '#CCFF00', fontSize: 10, marginTop: 3,
    opacity: 0.7, fontWeight: '500',
  },
  iconBtn: { padding: 6 },

  // 하단 액션 버튼
  actionRow: {
    flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4,
  },
  actionBtnFill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#CCFF00', borderRadius: 10, paddingVertical: 10, gap: 6,
  },
  actionBtnFillText: { color: '#000', fontSize: 13, fontWeight: '700' },
  actionBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#CCFF00', borderRadius: 10, paddingVertical: 10, gap: 6,
  },
  actionBtnOutlineText: { color: '#CCFF00', fontSize: 13, fontWeight: '600' },

  // 곡 수 선택
  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: '#050505', borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  countLabel: { color: '#555', fontSize: 11, fontWeight: '600', marginRight: 4 },
  countChip: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
  },
  countChipActive: { backgroundColor: '#CCFF00', borderColor: '#CCFF00' },
  countChipText: { color: '#666', fontSize: 12, fontWeight: '600' },
  countChipTextActive: { color: '#000' },

  // 피드백
  feedbackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 4, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#1E1E1E',
  },
  feedbackLabel: { color: '#555', fontSize: 12, flex: 1 },
  feedbackDone: { color: '#888', fontSize: 12 },
  feedbackBtn: { padding: 4 },

  // 피드백 이유 선택
  feedbackWhyBox: {
    marginTop: 8, padding: 12,
    backgroundColor: '#0D0D0D', borderRadius: 12,
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  feedbackWhyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  feedbackWhyTitle: { color: '#888', fontSize: 12, fontWeight: '600' },
  feedbackReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  feedbackReasonChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1A1A1A', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  feedbackReasonEmoji: { fontSize: 12 },
  feedbackReasonText: { color: '#aaa', fontSize: 11 },

  // 취향 프로필 카드
  profileCard: {
    marginHorizontal: 0,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    backgroundColor: '#050505',
  },
  profileHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  profileHeaderText: { color: '#555', fontSize: 11, fontWeight: '600' },
  profileBadge: {
    backgroundColor: '#1A1A1A', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  profileBadgeText: { color: '#CCFF00', fontSize: 9, fontWeight: '700' },
  profileBody: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileEmoji: { fontSize: 11, width: 16 },
  profileLabel: { color: '#444', fontSize: 10, width: 52 },
  profileBarBg: { flex: 1, height: 3, backgroundColor: '#1A1A1A', borderRadius: 2 },
  profileBarFill: { height: 3, backgroundColor: '#CCFF00', borderRadius: 2 },
  profileVal: { color: '#444', fontSize: 10, width: 28, textAlign: 'right' },

  // 디버그 카드
  debugWrap: {
    marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: '#1E1E1E',
    overflow: 'hidden',
  },
  debugHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0D0D0D',
  },
  debugHeaderText: { color: '#555', fontSize: 11, fontWeight: '600' },
  debugBody: { padding: 12, backgroundColor: '#080808' },
  debugLine: { color: '#555', fontSize: 11, marginBottom: 3 },
  debugVal: { color: '#CCFF00', fontWeight: '600' },
  debugRaw: {
    color: '#444', fontSize: 10, fontFamily: 'monospace',
    marginTop: 4, lineHeight: 16,
  },

  inputBar: {
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#1A1A1A',
    borderRadius: 24, paddingHorizontal: 10, paddingVertical: 6,
  },
  inputIconBtn: { padding: 5, marginRight: 2 },
  input: {
    flex: 1, color: '#fff', fontSize: 14,
    paddingHorizontal: 8, paddingVertical: 4, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#CCFF00', width: 34, height: 34,
    borderRadius: 17, justifyContent: 'center', alignItems: 'center',
  },
});
