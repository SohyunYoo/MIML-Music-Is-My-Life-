import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  FlatList, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';

export default function AddToPlaylistModal({ visible, onClose, songs, mode = 'single' }) {
  // mode: 'single' (곡 하나) | 'all' (전체 추천 목록)
  const { playlists, addToPlaylist, addAllToPlaylist, createPlaylist } = usePlayer();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [added, setAdded] = useState(null); // 추가 완료된 플레이리스트 id

  const handleSelect = (playlistId) => {
    if (mode === 'all') {
      addAllToPlaylist(playlistId, songs);
    } else {
      addToPlaylist(playlistId, songs[0]);
    }
    setAdded(playlistId);
    setTimeout(() => {
      setAdded(null);
      onClose();
    }, 700);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createPlaylist(newName.trim());
    if (mode === 'all') addAllToPlaylist(id, songs);
    else addToPlaylist(id, songs[0]);
    setNewName('');
    setCreating(false);
    setAdded(id);
    setTimeout(() => {
      setAdded(null);
      onClose();
    }, 700);
  };

  const songCount = Array.isArray(songs) ? songs.length : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheet}
      >
        {/* 핸들 */}
        <View style={styles.handle} />

        <Text style={styles.title}>
          {mode === 'all'
            ? `플레이리스트에 ${songCount}곡 저장`
            : '플레이리스트에 추가'}
        </Text>

        {/* 새 플레이리스트 만들기 */}
        {creating ? (
          <View style={styles.createRow}>
            <TextInput
              style={styles.createInput}
              placeholder="플레이리스트 이름"
              placeholderTextColor="#555"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity style={styles.createConfirm} onPress={handleCreate}>
              <Text style={styles.createConfirmText}>만들기</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreating(false)} style={{ padding: 8 }}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
            <View style={styles.newIcon}>
              <Ionicons name="add" size={20} color="#CCFF00" />
            </View>
            <Text style={styles.newBtnText}>새 플레이리스트 만들기</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {/* 기존 플레이리스트 목록 */}
        <FlatList
          data={playlists}
          keyExtractor={item => item.id}
          style={{ maxHeight: 340 }}
          renderItem={({ item }) => {
            const isDone = added === item.id;
            return (
              <TouchableOpacity style={styles.plRow} onPress={() => handleSelect(item.id)}>
                <View style={[styles.plThumb, { backgroundColor: item.color }]}>
                  {item.icon
                    ? <Ionicons name={item.icon} size={16} color="rgba(255,255,255,0.8)" />
                    : null}
                </View>
                <View style={styles.plInfo}>
                  <Text style={styles.plName}>{item.name}</Text>
                  <Text style={styles.plCount}>{item.songs.length}곡</Text>
                </View>
                {isDone
                  ? <Ionicons name="checkmark-circle" size={22} color="#CCFF00" />
                  : <Ionicons name="add-circle-outline" size={22} color="#555" />}
              </TouchableOpacity>
            );
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, paddingTop: 12,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    color: '#fff', fontSize: 16, fontWeight: '700',
    paddingHorizontal: 20, marginBottom: 14,
  },
  newBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  newIcon: {
    width: 44, height: 44, borderRadius: 8, backgroundColor: '#1E1E1E',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  newBtnText: { color: '#CCFF00', fontSize: 14, fontWeight: '600' },

  createRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 8, gap: 8,
  },
  createInput: {
    flex: 1, backgroundColor: '#1E1E1E', color: '#fff',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  createConfirm: {
    backgroundColor: '#CCFF00', paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 8,
  },
  createConfirmText: { color: '#000', fontWeight: '700', fontSize: 13 },

  divider: { height: 1, backgroundColor: '#1E1E1E', marginVertical: 8 },

  plRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  plThumb: {
    width: 44, height: 44, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  plInfo: { flex: 1 },
  plName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  plCount: { color: '#666', fontSize: 12, marginTop: 2 },
});
