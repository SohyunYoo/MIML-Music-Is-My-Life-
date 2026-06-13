import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSpotify } from '../context/SpotifyContext';
import { usePlayer } from '../context/PlayerContext';

const SLIDER_WIDTH = 220;

function RecommendSlider({ value, onChange }) {
  const x = useRef(new Animated.Value(value * SLIDER_WIDTH)).current;
  const currentX = useRef(value * SLIDER_WIDTH);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { x.setOffset(currentX.current); x.setValue(0); },
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(SLIDER_WIDTH, g.dx)) - currentX.current),
    onPanResponderRelease: (_, g) => {
      const newX = Math.max(0, Math.min(SLIDER_WIDTH, currentX.current + g.dx));
      currentX.current = newX;
      x.flattenOffset();
      x.setValue(newX);
      onChange(newX / SLIDER_WIDTH);
    },
  })).current;

  const thumbLeft = x.interpolate({ inputRange: [0, SLIDER_WIDTH], outputRange: [0, SLIDER_WIDTH], extrapolate: 'clamp' });
  const pct = Math.round(value * 100);

  return (
    <View style={rs.wrapper}>
      <View style={rs.labelRow}>
        <Text style={rs.labelLeft}>Now</Text>
        <Text style={rs.pct}>{pct}% · {100 - pct}%</Text>
        <Text style={rs.labelRight}>My Vibe</Text>
      </View>
      <View style={rs.track}>
        <Animated.View style={[rs.fill, { width: thumbLeft }]} />
        <Animated.View style={[rs.thumb, { left: thumbLeft }]} {...pan.panHandlers} />
      </View>
      <Text style={rs.desc}>
        지금 이 순간의 기분과 평소 취향 사이의 비율을 조절해요
      </Text>
    </View>
  );
}

const rs = StyleSheet.create({
  wrapper: { paddingTop: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  labelLeft: { color: '#fff', fontSize: 13, fontWeight: '700' },
  labelRight: { color: '#CCFF00', fontSize: 13, fontWeight: '700' },
  pct: { color: '#666', fontSize: 12 },
  track: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, width: SLIDER_WIDTH, alignSelf: 'center' },
  fill: { height: 4, backgroundColor: '#CCFF00', borderRadius: 2, position: 'absolute' },
  thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#CCFF00', marginTop: -8, marginLeft: -10 },
  desc: { color: '#555', fontSize: 11, marginTop: 12, textAlign: 'center', lineHeight: 17 },
});

// 취향벡터 항목 정의 (백엔드 필드명 → 표시 레이블)
const VEC_ITEMS = [
  { key: 'energy',       label: '⚡ 에너지' },
  { key: 'happiness',    label: '😊 밝기' },
  { key: 'danceability', label: '💃 신남' },
  { key: 'acousticness', label: '🎸 어쿠스틱' },
  { key: 'tempo',        label: '🥁 빠르기',  max: 200 },
];

const MENU_ITEMS = [
  { icon: 'person-outline', label: '프로필 수정' },
];

export default function ProfileScreen({ navigation }) {
  const [notifications, setNotifications] = useState(true);
  const { user, logout } = useAuth();
  const { isConnected: spotifyConnected, spotifyUser, connect: spotifyConnect, disconnect: spotifyDisconnect } = useSpotify();
  const { tasteProfile, feedbackCount, alpha, setAlpha, playlists } = usePlayer();

  // 실제 통계
  const likedCount = playlists.find(p => p.id === 'liked')?.songs.length ?? 0;
  const recentCount = playlists.find(p => p.id === 'recent')?.songs.length ?? 0;
  const playlistCount = playlists.filter(p => p.id !== 'liked' && p.id !== 'recent').length;
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  const openEdit = () => {
    setEditName(user?.displayName || '');
    setEditVisible(true);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setEditLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName: editName.trim() });
      setEditVisible(false);
    } catch (e) {
      setAlertMsg('이름 변경에 실패했어요.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={40} color="#CCFF00" />
          </View>
          <Text style={styles.userName}>{user?.displayName || '사용자'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Text style={styles.editBtnText}>프로필 편집</Text>
          </TouchableOpacity>
        </View>

        {/* Spotify 연결 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spotify 연결</Text>
          <Text style={styles.sectionSub}>연결하면 전곡 재생 및 스마트 추천이 활성화돼요</Text>
          {spotifyConnected ? (
            <View style={sp.connectedRow}>
              <View style={sp.dot} />
              <Text style={sp.connectedText}>
                {spotifyUser?.display_name || spotifyUser?.email || '연결됨'}
              </Text>
              <TouchableOpacity style={sp.disconnectBtn} onPress={spotifyDisconnect}>
                <Text style={sp.disconnectText}>연결 해제</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={sp.connectBtn} onPress={spotifyConnect}>
              <MaterialCommunityIcons name="spotify" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={sp.connectBtnText}>Spotify로 연결하기</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 내 음악 취향 */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={styles.sectionTitle}>내 음악 취향</Text>
          </View>
          <Text style={styles.sectionSub}>
            {tasteProfile ? '피드백으로 학습된 취향이에요' : '아직 학습된 취향이 없어요 — 곡에 피드백을 남겨보세요'}
          </Text>
          {tasteProfile ? (
            VEC_ITEMS.map(item => {
              const raw = tasteProfile[item.key] ?? 0;
              const maxVal = item.max ?? 100;
              const pct = Math.min(100, (raw / maxVal) * 100);
              const display = item.max ? (raw / maxVal).toFixed(2) : (raw / 100).toFixed(2);
              return (
                <View key={item.key} style={styles.vecRow}>
                  <Text style={styles.vecLabel}>{item.label}</Text>
                  <View style={styles.vecTrack}>
                    <View style={[styles.vecFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.vecVal}>{display}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.vecEmpty}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={32} color="#2A2A2A" />
              <Text style={styles.vecEmptyText}>피드백이 쌓이면 여기에 표시돼요</Text>
            </View>
          )}
        </View>

        {/* 통계 */}
        <View style={styles.statsGrid}>
          {[
            { label: '최근 재생', value: `${recentCount}곡` },
            { label: '좋아요한 곡', value: `${likedCount}곡` },
            { label: '내 플레이리스트', value: `${playlistCount}개` },
            { label: '피드백 횟수', value: `${feedbackCount}회` },
          ].map(item => (
            <View key={item.label} style={styles.statCard}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* 메뉴 */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity key={i} style={styles.menuRow} onPress={item.label === '프로필 수정' ? openEdit : undefined}>
              <Ionicons name={item.icon} size={20} color="#888" style={{ marginRight: 14 }} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#444" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color="#FF4D6D" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 알림 모달 */}
      <Modal visible={!!alertMsg} transparent animationType="fade" onRequestClose={() => setAlertMsg('')}>
        <View style={edit.overlay}>
          <View style={edit.sheet}>
            <Text style={edit.title}>알림</Text>
            <Text style={{ color: '#aaa', fontSize: 14, marginBottom: 20, lineHeight: 20 }}>{alertMsg}</Text>
            <TouchableOpacity style={[edit.btnSave, { width: '100%' }]} onPress={() => setAlertMsg('')}>
              <Text style={edit.btnSaveText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 프로필 편집 모달 */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={edit.overlay}>
          <View style={edit.sheet}>
            <Text style={edit.title}>이름 변경</Text>
            <TextInput
              style={edit.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="새 이름 입력"
              placeholderTextColor="#555"
              autoFocus
              maxLength={20}
            />
            <View style={edit.btnRow}>
              <TouchableOpacity style={edit.btnCancel} onPress={() => setEditVisible(false)}>
                <Text style={edit.btnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[edit.btnSave, !editName.trim() && { opacity: 0.4 }]}
                onPress={handleSaveName}
                disabled={!editName.trim() || editLoading}
              >
                {editLoading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={edit.btnSaveText}>저장</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  profileCard: {
    alignItems: 'center', paddingVertical: 28,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#CCFF00', marginBottom: 12,
  },
  userName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  userEmail: { color: '#666', fontSize: 13, marginTop: 4 },
  editBtn: {
    marginTop: 14, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#333',
  },
  editBtnText: { color: '#fff', fontSize: 13 },

  section: {
    padding: 20,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionSub: { color: '#666', fontSize: 12, marginBottom: 16 },
  vecRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  vecLabel: { color: '#888', fontSize: 12, width: 90 },
  vecTrack: {
    flex: 1, height: 4, backgroundColor: '#222', borderRadius: 2, marginHorizontal: 10,
  },
  vecFill: { height: 4, backgroundColor: '#CCFF00', borderRadius: 2 },
  vecVal: { color: '#CCFF00', fontSize: 11, width: 30, textAlign: 'right' },
  vecEmpty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  vecEmptyText: { color: '#333', fontSize: 12 },
  learnBadge: {
    backgroundColor: '#1A1A1A', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  learnBadgeText: { color: '#CCFF00', fontSize: 10, fontWeight: '700' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  statCard: {
    width: '48%', backgroundColor: '#111', borderRadius: 10,
    margin: '1%', padding: 16, alignItems: 'center',
  },
  statValue: { color: '#CCFF00', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4, textAlign: 'center' },

  menuSection: { paddingTop: 8 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  menuLabel: { flex: 1, color: '#fff', fontSize: 14 },

  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 20, marginTop: 8,
  },
  logoutText: { color: '#FF4D6D', fontSize: 15, fontWeight: '600' },
});

const sp = StyleSheet.create({
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1DB954', borderRadius: 10,
    paddingVertical: 12, marginTop: 4,
  },
  connectBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  connectedRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1DB954', marginRight: 8 },
  connectedText: { color: '#fff', fontSize: 14, flex: 1 },
  disconnectBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#333',
  },
  disconnectText: { color: '#888', fontSize: 12 },
});

const edit = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#111', borderRadius: 16,
    padding: 24, width: '80%',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  input: {
    backgroundColor: '#1A1A1A', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#222', alignItems: 'center',
  },
  btnCancelText: { color: '#888', fontSize: 14, fontWeight: '600' },
  btnSave: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#CCFF00', alignItems: 'center',
  },
  btnSaveText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
