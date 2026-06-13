import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Animated, ScrollView, Image, Alert } from 'react-native';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import NowPlayingBar from '../components/NowPlayingBar';
import { SkeletonCard } from '../components/Skeleton';
import { usePlayer } from '../context/PlayerContext';

const SYSTEM_IDS = ['liked', 'recent'];

function PlaylistCard({ item, onPress, onLongPress, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // 첫 번째 곡 앨범아트를 표지로 사용
  const coverArt = item.songs[0]?.albumImageUrl || item.songs[0]?.albumArt || null;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <View style={[styles.cardThumb, { backgroundColor: item.color }]}>
          {coverArt
            ? <Image source={{ uri: coverArt }} style={StyleSheet.absoluteFill} borderRadius={10} />
            : item.icon
              ? <Ionicons name={item.icon} size={26} color="rgba(255,255,255,0.9)" />
              : <Ionicons name="musical-notes" size={26} color="rgba(255,255,255,0.4)" />
          }
        </View>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardSub}>{item.songs.length}곡</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function RecentSongItem({ song, onPress }) {
  const COLOR_MAP = ['#5B4FC8', '#4A3FBF', '#C0392B', '#2E7D32', '#1565C0', '#6B5BD2'];
  const color = song.color || COLOR_MAP[song.title?.length % COLOR_MAP.length] || '#5B4FC8';
  const albumArt = song.albumImageUrl || song.albumArt || null;

  return (
    <TouchableOpacity style={styles.recentItem} onPress={onPress}>
      <View style={[styles.recentThumb, { backgroundColor: color }]}>
        {albumArt && <Image source={{ uri: albumArt }} style={StyleSheet.absoluteFill} borderRadius={10} />}
      </View>
      <Text style={styles.recentTitle} numberOfLines={1}>{song.title}</Text>
      <Text style={styles.recentArtist} numberOfLines={1}>{song.artist}</Text>
    </TouchableOpacity>
  );
}

export default function LibraryScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [loading] = useState(false);
  const { playlists, playTrack, deletePlaylist } = usePlayer();

  const handleLongPress = (item) => {
    if (SYSTEM_IDS.includes(item.id)) return;
    Alert.alert(
      item.name,
      '이 플레이리스트를 삭제할까요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => deletePlaylist(item.id) },
      ]
    );
  };

  const recentSongs = useMemo(() => {
    const recent = playlists.find(p => p.id === 'recent');
    return recent?.songs.slice(0, 8) || [];
  }, [playlists]);

  const filtered = useMemo(() =>
    playlists.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase())
    ),
    [playlists, query]
  );

  const ListHeader = () => (
    <>
      {/* 검색바 */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color="#666" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="플레이리스트 검색"
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {/* 최근 재생 가로 스크롤 */}
      {recentSongs.length > 0 && !query && (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 20 }]}>최근 재생</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
            {recentSongs.map(song => (
              <RecentSongItem
                key={song.id}
                song={song}
                onPress={() => playTrack({
                  ...song,
                  source: 'BEATSPILL+',
                  albumColor: song.color,
                  albumArt: song.albumImageUrl || song.albumArt || null,
                  spotifyUri: song.spotifyId ? `spotify:track:${song.spotifyId}` : song.spotifyUri || null,
                  isPlaying: true,
                })}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.sectionLabel}>내 플레이리스트</Text>
    </>
  );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>보관함</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#CCFF00" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <FlatList
          data={[1, 2, 3, 4]}
          numColumns={2}
          keyExtractor={i => String(i)}
          contentContainerStyle={styles.grid}
          renderItem={() => <SkeletonCard />}
        />
      ) : (
        <FlatList
          data={filtered}
          numColumns={2}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          ListHeaderComponent={<ListHeader />}
          renderItem={({ item, index }) => (
            <PlaylistCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>검색 결과가 없습니다</Text>
          }
        />
      )}

      <NowPlayingBar navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#fff' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A',
    justifyContent: 'center', alignItems: 'center',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },

  sectionLabel: {
    color: '#888', fontSize: 12, fontWeight: '700',
    marginBottom: 12, letterSpacing: 0.5,
  },

  recentSection: { marginBottom: 20, marginHorizontal: -20 },
  recentScroll: { paddingHorizontal: 20, gap: 12 },
  recentItem: { width: 80 },
  recentThumb: { width: 80, height: 80, borderRadius: 10, marginBottom: 6 },
  recentTitle: { color: '#fff', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  recentArtist: { color: '#666', fontSize: 10, marginTop: 2 },

  grid: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },

  card: { flex: 1 },
  cardThumb: {
    borderRadius: 10, aspectRatio: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  cardSub: { color: '#666', fontSize: 11, marginTop: 2 },

  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
