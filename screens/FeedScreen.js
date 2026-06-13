import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Modal, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, Image, ScrollView,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, addDoc, updateDoc, doc, deleteDoc,
  arrayUnion, arrayRemove, orderBy, query, onSnapshot, serverTimestamp,
  limit, startAfter, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useSpotify } from '../context/SpotifyContext';
import NowPlayingBar from '../components/NowPlayingBar';

const BACKEND_URL = 'http://13.209.228.73:8080';

// ── 시간 포맷 ─────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const now = Date.now();
  const t = ts.toDate ? ts.toDate().getTime() : ts;
  const d = Math.floor((now - t) / 1000);
  if (d < 60) return '방금 전';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
}

// ── 게시물 카드 ───────────────────────────────────────────────────
function PostCard({ post, currentUserId }) {
  const likesArr = Array.isArray(post.likes) ? post.likes : [];
  const liked = likesArr.includes(currentUserId);
  const isOwner = post.userId === currentUserId;
  const [likeLoading, setLikeLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { playTrack, currentTrack } = usePlayer();
  const { isConnected, searchTrack, getTrackById } = useSpotify();

  // content / review 둘 다 지원 (필드명 혼용 방어)
  const content = post.content || post.review || '';

  // 앨범아트 — 실제 spotifyId면 직접 조회, 없으면 title+artist 검색
  const [albumArt, setAlbumArt] = useState(post.songData?.albumImageUrl || null);
  useEffect(() => {
    if (albumArt || !isConnected) return;
    const spotifyId = post.songData?.spotifyId;
    const isRealId = !!spotifyId && /^[A-Za-z0-9]{22}$/.test(spotifyId);

    if (isRealId) {
      // spotifyId로 직접 조회 (빠름, 정확)
      getTrackById(spotifyId).then(info => {
        if (info?.albumArt) setAlbumArt(info.albumArt);
      });
    } else if (post.songData?.title) {
      // 가짜 ID or null → title+artist 검색 (랜덤 딜레이로 분산)
      const delay = Math.random() * 3000;
      const t = setTimeout(() => {
        searchTrack(post.songData.title, post.songData.artist || '').then(info => {
          if (info?.albumArt) setAlbumArt(info.albumArt);
        });
      }, delay);
      return () => clearTimeout(t);
    }
  }, [isConnected]);

  const isPlaying = currentTrack?.id === post.id && currentTrack?.isPlaying;

  const toggleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        likes: liked ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
      });
    } finally { setLikeLoading(false); }
  };

  const confirmDelete = async () => {
    setConfirmVisible(false);
    setDeleteLoading(true);
    try { await deleteDoc(doc(db, 'posts', post.id)); }
    catch (e) { setDeleteLoading(false); }
  };

  // 실제 Spotify ID = 22자리 영숫자
  const isRealSpotifyId = (id) => !!id && /^[A-Za-z0-9]{22}$/.test(id);

  const handlePlay = () => {
    if (!post.songData) return;
    const spotifyId = post.songData.spotifyId;
    playTrack({
      id: post.id,
      title: post.songData.title,
      artist: post.songData.artist,
      albumArt: albumArt || null,
      spotifyUri: isRealSpotifyId(spotifyId) ? `spotify:track:${spotifyId}` : null,
      albumColor: post.songData.albumColor || '#3A2E6E',
      source: '커뮤니티',
    });
  };

  const COLORS = ['#5B4FC8', '#4A3FBF', '#C0392B', '#2E7D32', '#1565C0', '#6B5BD2'];
  const thumbColor = post.songData?.albumColor || COLORS[(post.songData?.title?.length ?? 0) % COLORS.length];

  return (
    <View style={styles.card}>
      {/* 삭제 확인 모달 */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="trash-outline" size={28} color="#FF4D6D" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>게시물 삭제</Text>
            <Text style={styles.confirmSub}>삭제 후 복구할 수 없어요.</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.confirmCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={confirmDelete}>
                <Text style={styles.confirmDeleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 헤더: 앨범아트 + 곡 정보 */}
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={[styles.miniThumb, { backgroundColor: thumbColor }]}
          onPress={handlePlay}
          disabled={!post.songData}
          activeOpacity={0.8}
        >
          {albumArt
            ? <Image source={{ uri: albumArt }} style={StyleSheet.absoluteFill} borderRadius={6} />
            : null
          }
          {isPlaying
            ? <View style={styles.thumbOverlay}><MaterialCommunityIcons name="equalizer" size={14} color="#CCFF00" /></View>
            : post.songData
              ? <View style={styles.thumbOverlay}><Ionicons name="play" size={14} color="rgba(255,255,255,0.8)" /></View>
              : null
          }
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.songName} numberOfLines={1}>
            {post.songData ? post.songData.title : (post.song || '—')}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {post.songData?.artist || ''}
          </Text>
          <Text style={styles.userName}>@{post.userName} · {timeAgo(post.createdAt)}</Text>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={() => setConfirmVisible(true)} disabled={deleteLoading} style={{ padding: 4 }}>
            {deleteLoading
              ? <ActivityIndicator size="small" color="#555" />
              : <Ionicons name="trash-outline" size={16} color="#444" />}
          </TouchableOpacity>
        )}
      </View>

      {/* 본문 */}
      {!!content && (
        <Text style={styles.content}>{content}</Text>
      )}

      {/* AI 태그 */}
      {post.tags?.length > 0 && (
        <View style={styles.tagRow}>
          {post.tags.map(t => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 푸터 */}
      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.likeBtn} onPress={toggleLike} disabled={likeLoading}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#FF4D6D' : '#666'} />
          <Text style={[styles.likeCount, liked && { color: '#FF4D6D' }]}>{likesArr.length}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── 작성창 ────────────────────────────────────────────────────────
function ComposeBox({ onSubmit, loading, nowPlaying }) {
  const [expanded, setExpanded] = useState(false);
  const [songQuery, setSongQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null); // 선택된 곡 객체
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [content, setContent] = useState('');
  const debounceRef = useRef(null);
  const { searchTracks, isConnected } = useSpotify();

  // 지금 재생 중인 곡 자동 선택
  useEffect(() => {
    if (expanded && nowPlaying?.title && !selectedSong) {
      setSelectedSong({
        title: nowPlaying.title,
        artist: nowPlaying.artist,
        albumImageUrl: nowPlaying.albumArt || null,
        spotifyId: nowPlaying.spotifyUri?.replace('spotify:track:', '') || null,
      });
      setSongQuery(`${nowPlaying.title} - ${nowPlaying.artist}`);
    }
  }, [expanded]);

  // 검색어 변경 시 debounce 검색
  const handleSongQueryChange = (text) => {
    setSongQuery(text);
    setSelectedSong(null); // 직접 입력하면 선택 초기화
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || !isConnected) { setSearchResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchTracks(text);
      setSearchResults(results);
      setSearching(false);
    }, 500);
  };

  const handleSelectSong = (track) => {
    setSelectedSong(track);
    setSongQuery(`${track.title} - ${track.artist}`);
    setSearchResults([]);
  };

  const handleClear = () => {
    setSongQuery(''); setSelectedSong(null); setSearchResults([]);
  };

  const handleCancel = () => {
    setSongQuery(''); setSelectedSong(null);
    setSearchResults([]); setContent(''); setExpanded(false);
  };

  const handleSubmit = async () => {
    if (!songQuery.trim()) return;
    const songData = selectedSong ? {
      title: selectedSong.title,
      artist: selectedSong.artist,
      albumImageUrl: selectedSong.albumImageUrl || null,
      spotifyId: selectedSong.spotifyId || null,
      albumColor: '#3A2E6E',
    } : null;
    await onSubmit({ song: songQuery.trim(), content: content.trim(), songData });
    setSongQuery(''); setSelectedSong(null); setContent(''); setExpanded(false);
  };

  return (
    <View style={compose.wrapper}>
      {!expanded ? (
        <TouchableOpacity style={compose.collapsed} onPress={() => setExpanded(true)} activeOpacity={0.8}>
          <View style={compose.avatar}>
            <MaterialCommunityIcons name="hexagon-slice-3" size={16} color="#CCFF00" />
          </View>
          <Text style={compose.placeholder}>
            {nowPlaying?.title ? `"${nowPlaying.title}" 감상 공유하기...` : '지금 듣는 음악 공유하기...'}
          </Text>
          <View style={compose.addBtn}>
            <Ionicons name="add" size={18} color="#000" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={compose.expanded}>
          {/* 헤더 */}
          <View style={compose.expandedHeader}>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={compose.cancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={compose.expandedTitle}>감상 공유</Text>
            <TouchableOpacity
              style={[compose.postBtn, (!songQuery.trim() || loading) && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={!songQuery.trim() || loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={compose.postBtnText}>게시</Text>}
            </TouchableOpacity>
          </View>

          {/* 지금 재생 중 칩 */}
          {nowPlaying && !selectedSong && (
            <TouchableOpacity
              style={compose.nowPlayingChip}
              onPress={() => handleSelectSong({
                title: nowPlaying.title,
                artist: nowPlaying.artist,
                albumImageUrl: nowPlaying.albumArt || null,
                spotifyId: nowPlaying.spotifyUri?.replace('spotify:track:', '') || null,
              })}
            >
              <Ionicons name="musical-note" size={11} color="#CCFF00" />
              <Text style={compose.nowPlayingText} numberOfLines={1}>
                지금 재생: {nowPlaying.title}
              </Text>
            </TouchableOpacity>
          )}

          {/* 선택된 곡 표시 */}
          {selectedSong ? (
            <View style={compose.selectedSong}>
              {selectedSong.albumImageUrl
                ? <Image source={{ uri: selectedSong.albumImageUrl }} style={compose.selectedThumb} borderRadius={6} />
                : <View style={[compose.selectedThumb, { backgroundColor: '#2A2A6E', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="musical-note" size={14} color="#888" />
                  </View>
              }
              <View style={{ flex: 1 }}>
                <Text style={compose.selectedTitle} numberOfLines={1}>{selectedSong.title}</Text>
                <Text style={compose.selectedArtist} numberOfLines={1}>{selectedSong.artist}</Text>
              </View>
              <TouchableOpacity onPress={handleClear} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#555" />
              </TouchableOpacity>
            </View>
          ) : (
            /* 곡 검색 인풋 */
            <View style={compose.searchRow}>
              <Ionicons name="search-outline" size={16} color="#555" style={{ marginRight: 8 }} />
              <TextInput
                style={compose.songInput}
                placeholder="곡명 또는 아티스트 검색"
                placeholderTextColor="#444"
                value={songQuery}
                onChangeText={handleSongQueryChange}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color="#555" style={{ marginLeft: 6 }} />}
            </View>
          )}

          {/* 검색 결과 드롭다운 */}
          {searchResults.length > 0 && (
            <View style={compose.dropdown}>
              {searchResults.map((track, i) => (
                <TouchableOpacity
                  key={track.spotifyId || i}
                  style={[compose.dropdownItem, i < searchResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }]}
                  onPress={() => handleSelectSong(track)}
                  activeOpacity={0.7}
                >
                  {track.albumImageUrl
                    ? <Image source={{ uri: track.albumImageUrl }} style={compose.dropdownThumb} borderRadius={4} />
                    : <View style={[compose.dropdownThumb, { backgroundColor: '#2A2A6E' }]} />
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={compose.dropdownTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={compose.dropdownArtist} numberOfLines={1}>{track.artist}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 감상평 */}
          <TextInput
            style={compose.contentInput}
            placeholder="이 곡, 어떤 순간에 들었나요?"
            placeholderTextColor="#444"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={200}
          />
          <Text style={compose.charCount}>{content.length}/200</Text>
          <Text style={compose.aiTagHint}>✦ AI가 태그를 자동으로 달아드려요</Text>
        </View>
      )}
    </View>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

export default function FeedScreen({ navigation }) {
  const { user, getIdToken } = useAuth();
  const { currentTrack } = usePlayer();
  const [posts, setPosts] = useState([]);
  const [postLoading, setPostLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef(null);

  // 첫 페이지 로드 + 실시간 업데이트 (새 글만)
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(docs);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setInitialLoading(false);
    }, () => setInitialLoading(false));
    return unsub;
  }, []);

  // 다음 페이지 로드
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(prev => [...prev, ...newDocs]);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    lastDocRef.current = null;
    setHasMore(true);
    // onSnapshot이 자동으로 최신 10개 다시 로드
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleSubmit = async ({ song, content, songData }) => {
    setPostLoading(true);
    try {
      const token = await getIdToken();

      // ── AI 태그 생성 (spotifyId 있으면 무조건 호출) ──────────
      let tags = [];
      if (songData?.spotifyId) {
        try {
          const tagController = new AbortController();
          const tagTimeout = setTimeout(() => tagController.abort(), 8000);
          const res = await fetch(`${BACKEND_URL}/api/tags/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              review: content || '',
              spotifyId: songData.spotifyId,
            }),
            signal: tagController.signal,
          });
          clearTimeout(tagTimeout);
          if (res.ok) {
            const data = await res.json();
            tags = data.tags || [];
            console.log('✅ 태그 생성:', tags);
          } else {
            console.log('⚠️ 태그 API 실패:', res.status);
          }
        } catch (e) {
          console.log('⚠️ 태그 API 에러:', e.message);
        }
      }

      // ── Firestore 저장 ────────────────────────────────────────
      await addDoc(collection(db, 'posts'), {
        song, content, tags,
        songData: songData || null,
        userId: user?.uid || 'anonymous',
        userName: user?.displayName || user?.email?.split('@')[0] || '익명',
        likes: [],
        createdAt: serverTimestamp(),
      });

      console.log('✅ 게시물 저장 완료, 태그:', tags);
    } catch (e) {
      console.log('❌ Post error:', e);
    } finally {
      setPostLoading(false);
    }
  };

  const ListHeader = (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>커뮤니티</Text>
        <MaterialCommunityIcons name="fire" size={20} color="#FF6B35" />
      </View>
      <ComposeBox onSubmit={handleSubmit} loading={postLoading} nowPlaying={currentTrack} />
      <View style={styles.divider} />
    </>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {initialLoading ? (
        <>
          {ListHeader}
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#CCFF00" />
          </View>
        </>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={ListHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#CCFF00" />}
          renderItem={({ item }) => <PostCard post={item} currentUserId={user?.uid} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#111' }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#CCFF00" size="small" />
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="musical-notes-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>첫 감상 로그를 남겨봐요 👆</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
      <NowPlayingBar navigation={navigation} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  divider: { height: 1, backgroundColor: '#111', marginTop: 4 },
  center: { justifyContent: 'center', alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { color: '#555', fontSize: 14 },

  card: { padding: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  miniThumb: {
    width: 50, height: 50, borderRadius: 8, marginRight: 12,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  songName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artistName: { color: '#888', fontSize: 12, marginTop: 1 },
  userName: { color: '#555', fontSize: 11, marginTop: 3 },

  content: { color: '#ccc', fontSize: 14, lineHeight: 21, marginBottom: 10 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  tag: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { color: '#CCFF00', fontSize: 11 },

  cardFooter: { flexDirection: 'row', marginTop: 4 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeCount: { color: '#666', fontSize: 13 },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { backgroundColor: '#111', borderRadius: 20, padding: 28, width: '78%', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  confirmTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  confirmSub: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  confirmBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1E1E1E', alignItems: 'center' },
  confirmCancelText: { color: '#888', fontSize: 14, fontWeight: '600' },
  confirmDelete: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF4D6D', alignItems: 'center' },
  confirmDeleteText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

const compose = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginVertical: 12 },
  collapsed: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0D0D0D', borderRadius: 16,
    borderWidth: 1, borderColor: '#1E1E1E',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1A1A1A',
    justifyContent: 'center', alignItems: 'center',
  },
  placeholder: { flex: 1, color: '#444', fontSize: 14 },
  addBtn: {
    backgroundColor: '#CCFF00', width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  expanded: {
    backgroundColor: '#0D0D0D', borderRadius: 16,
    borderWidth: 1, borderColor: '#1E1E1E', padding: 16,
  },
  expandedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  cancelText: { color: '#666', fontSize: 14 },
  expandedTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  postBtn: { backgroundColor: '#CCFF00', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6 },
  postBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  nowPlayingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A', alignSelf: 'flex-start',
  },
  nowPlayingText: { color: '#CCFF00', fontSize: 11, maxWidth: 220 },
  songInput: {
    backgroundColor: '#111', color: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#1E1E1E',
  },
  contentInput: {
    backgroundColor: '#111', color: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
    minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  charCount: { color: '#333', fontSize: 10, textAlign: 'right', marginTop: 3, marginBottom: 8 },
  aiTagHint: { color: '#444', fontSize: 11, textAlign: 'center', paddingTop: 4 },

  // 곡 검색
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#1E1E1E',
  },
  songInput: { flex: 1, color: '#fff', fontSize: 14 },

  // 선택된 곡
  selectedSong: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111', borderRadius: 10, padding: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#CCFF00',
  },
  selectedThumb: { width: 40, height: 40, borderRadius: 6 },
  selectedTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  selectedArtist: { color: '#888', fontSize: 11, marginTop: 2 },

  // 검색 드롭다운
  dropdown: {
    backgroundColor: '#111', borderRadius: 10,
    borderWidth: 1, borderColor: '#2A2A2A',
    marginBottom: 10, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  dropdownThumb: { width: 36, height: 36 },
  dropdownTitle: { color: '#fff', fontSize: 13, fontWeight: '500' },
  dropdownArtist: { color: '#666', fontSize: 11, marginTop: 1 },
});
