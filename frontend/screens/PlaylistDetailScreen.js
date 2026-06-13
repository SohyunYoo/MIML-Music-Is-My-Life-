import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { useState } from 'react';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';

const PALETTE = [
  '#5B4FC8', '#4A3FBF', '#6B5BD2', '#7C6DE0', '#5248C0',
  '#8B5CF6', '#3D2FAA', '#C0392B', '#2E7D32', '#1565C0',
  '#6D4C41', '#37474F', '#AD1457', '#00695C', '#E65100',
];

// ── 편집 모달 ─────────────────────────────────────────────────────
function EditModal({ visible, playlist, onClose, onSave }) {
  const [name, setName] = useState(playlist?.name || '');
  const [desc, setDesc] = useState(playlist?.description || '');
  const [color, setColor] = useState(playlist?.color || '#5B4FC8');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: desc.trim(), color });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={modal.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* 헤더 */}
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={modal.cancel}>취소</Text>
          </TouchableOpacity>
          <Text style={modal.title}>플레이리스트 편집</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[modal.save, !name.trim() && { opacity: 0.4 }]}>저장</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* 커버 미리보기 */}
          <View style={[modal.cover, { backgroundColor: color }]}>
            <Ionicons name="musical-notes" size={36} color="rgba(255,255,255,0.5)" />
          </View>

          {/* 색상 팔레트 */}
          <Text style={modal.label}>커버 색상</Text>
          <View style={modal.palette}>
            {PALETTE.map(c => (
              <TouchableOpacity
                key={c}
                style={[modal.swatch, { backgroundColor: c }, color === c && modal.swatchActive]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* 이름 */}
          <Text style={modal.label}>이름</Text>
          <TextInput
            style={modal.input}
            value={name}
            onChangeText={setName}
            placeholder="플레이리스트 이름"
            placeholderTextColor="#555"
            maxLength={40}
          />

          {/* 설명 */}
          <Text style={modal.label}>설명 (선택)</Text>
          <TextInput
            style={[modal.input, { height: 90, textAlignVertical: 'top' }]}
            value={desc}
            onChangeText={setDesc}
            placeholder="이 플레이리스트를 한 줄로 표현해봐요"
            placeholderTextColor="#555"
            multiline
            maxLength={100}
          />
          <Text style={modal.charCount}>{desc.length}/100</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { color: '#888', fontSize: 15 },
  save: { color: '#CCFF00', fontSize: 15, fontWeight: '700' },
  cover: {
    width: 120, height: 120, borderRadius: 12,
    alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  label: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  swatchActive: { borderWidth: 2, borderColor: '#fff' },
  input: {
    backgroundColor: '#1A1A1A', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  charCount: { color: '#555', fontSize: 11, textAlign: 'right', marginTop: 4 },
});

// ── 곡 아이템 ─────────────────────────────────────────────────────
function SongRow({ song, onPlay, onRemove, isActive }) {
  const albumArt = song.albumImageUrl || song.albumArt || null;
  return (
    <TouchableOpacity style={styles.songRow} onPress={() => onPlay(song)} activeOpacity={0.75}>
      <View style={[styles.songThumb, { backgroundColor: song.color || '#3A2E6E' }]}>
        {albumArt
          ? <Image source={{ uri: albumArt }} style={StyleSheet.absoluteFill} borderRadius={8} />
          : null
        }
        {isActive && (
          <View style={styles.activeOverlay}>
            <MaterialCommunityIcons name="equalizer" size={14} color="#CCFF00" />
          </View>
        )}
      </View>
      <View style={styles.songInfo}>
        <Text style={[styles.songTitle, isActive && { color: '#CCFF00' }]} numberOfLines={1}>
          {song.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          <FontAwesome5 name="circle" size={8} color="#FF6B35" solid />
          <Text style={styles.songArtist}> {song.artist}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => onRemove(song.id)} style={styles.removeBtn}>
        <Ionicons name="remove-circle-outline" size={20} color="#555" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── 옵션 바텀시트 ─────────────────────────────────────────────────
function OptionsSheet({ visible, onClose, onEdit, onDelete, isSystem }) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={opt.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={opt.sheet}>
        <View style={opt.handle} />
        <TouchableOpacity style={opt.row} onPress={() => { onClose(); onEdit(); }}>
          <Ionicons name="pencil-outline" size={20} color="#fff" />
          <Text style={opt.rowText}>플레이리스트 편집</Text>
        </TouchableOpacity>
        {!isSystem && (
          <TouchableOpacity style={[opt.row, opt.rowDanger]} onPress={() => { onClose(); onDelete(); }}>
            <Ionicons name="trash-outline" size={20} color="#FF4D6D" />
            <Text style={[opt.rowText, { color: '#FF4D6D' }]}>플레이리스트 삭제</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[opt.row, { borderBottomWidth: 0 }]} onPress={onClose}>
          <Text style={[opt.rowText, { color: '#666' }]}>취소</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
const opt = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1E1E1E',
  },
  rowDanger: {},
  rowText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});

// ── 메인 ─────────────────────────────────────────────────────────
const SYSTEM_IDS = ['liked', 'recent'];

export default function PlaylistDetailScreen({ route, navigation }) {
  const { playlistId } = route.params;
  const { playlists, updatePlaylist, removeFromPlaylist, deletePlaylist, playTrack, playAll, currentTrack } = usePlayer();
  const [showEdit, setShowEdit] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return null;

  const isSystem = SYSTEM_IDS.includes(playlistId);

  const handleSave = (changes) => updatePlaylist(playlistId, changes);

  const handleDelete = () => {
    Alert.alert(
      '플레이리스트 삭제',
      `"${playlist.name}"을(를) 삭제할까요?\n삭제 후 복구할 수 없어요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: () => { deletePlaylist(playlistId); navigation.goBack(); },
        },
      ]
    );
  };

  const toPlayable = (s) => ({
    ...s,
    source: 'BEATSPILL+',
    albumColor: s.color || s.albumColor,
    albumArt: s.albumImageUrl || s.albumArt || null,
    spotifyUri: s.spotifyId ? `spotify:track:${s.spotifyId}` : s.spotifyUri || null,
  });

  const handlePlay = (song) => playTrack(toPlayable(song));
  const handlePlayAll = () => {
    if (!playlist.songs.length) return;
    playAll(playlist.songs.map(toPlayable));
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowOptions(true)}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlist.songs}
        keyExtractor={item => item.id}
        ListHeaderComponent={() => (
          <View>
            {/* 커버 — 첫 곡 앨범아트 우선, 없으면 색상 박스 */}
            {(() => {
              const coverArt = playlist.songs[0]?.albumImageUrl || playlist.songs[0]?.albumArt || null;
              return (
                <View style={[styles.cover, { backgroundColor: playlist.color }]}>
                  {coverArt
                    ? <Image source={{ uri: coverArt }} style={StyleSheet.absoluteFill} borderRadius={16} />
                    : playlist.icon
                      ? <Ionicons name={playlist.icon} size={48} color="rgba(255,255,255,0.6)" />
                      : <Ionicons name="musical-notes" size={48} color="rgba(255,255,255,0.4)" />
                  }
                </View>
              );
            })()}

            {/* 정보 */}
            <View style={styles.info}>
              <Text style={styles.name}>{playlist.name}</Text>
              {playlist.description ? (
                <Text style={styles.desc}>{playlist.description}</Text>
              ) : (
                <TouchableOpacity onPress={() => setShowEdit(true)}>
                  <Text style={styles.addDesc}>+ 설명 추가</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.count}>{playlist.songs.length}곡</Text>
            </View>

            {/* 액션 버튼 */}
            {playlist.songs.length > 0 && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll}>
                  <Ionicons name="play" size={18} color="#000" />
                  <Text style={styles.playAllText}>전체 재생</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shuffleBtn} onPress={handlePlayAll}>
                  <Ionicons name="shuffle" size={18} color="#CCFF00" />
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.listHeader}>수록곡</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <SongRow
            song={item}
            onPlay={handlePlay}
            onRemove={(songId) => removeFromPlaylist(playlistId, songId)}
            isActive={currentTrack?.id === item.id}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" size={40} color="#333" />
            <Text style={styles.emptyText}>아직 곡이 없어요</Text>
            <Text style={styles.emptySubText}>채팅에서 추천받은 곡을 저장해보세요</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      <EditModal
        visible={showEdit}
        playlist={playlist}
        onClose={() => setShowEdit(false)}
        onSave={handleSave}
      />

      <OptionsSheet
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        onEdit={() => setShowEdit(true)}
        onDelete={handleDelete}
        isSystem={isSystem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 8,
  },

  cover: {
    width: 160, height: 160, borderRadius: 16,
    alignSelf: 'center', marginTop: 8, marginBottom: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },

  info: { paddingHorizontal: 20, marginBottom: 20 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800' },
  desc: { color: '#888', fontSize: 13, marginTop: 6, lineHeight: 19 },
  addDesc: { color: '#555', fontSize: 13, marginTop: 6 },
  count: { color: '#666', fontSize: 12, marginTop: 8 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, gap: 10, marginBottom: 20,
  },
  playAllBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#CCFF00', borderRadius: 12, paddingVertical: 12, gap: 8,
  },
  playAllText: { color: '#000', fontSize: 15, fontWeight: '700' },
  shuffleBtn: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: '#CCFF00',
    justifyContent: 'center', alignItems: 'center',
  },

  listHeader: { color: '#666', fontSize: 12, fontWeight: '600', paddingHorizontal: 20, marginBottom: 4 },

  songRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  songThumb: {
    width: 46, height: 46, borderRadius: 8, marginRight: 12,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  songInfo: { flex: 1 },
  songTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  songArtist: { color: '#888', fontSize: 12 },
  removeBtn: { padding: 6 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { color: '#555', fontSize: 15, fontWeight: '600' },
  emptySubText: { color: '#444', fontSize: 12 },
});
