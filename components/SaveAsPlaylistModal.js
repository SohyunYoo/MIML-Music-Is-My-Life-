import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';

export default function SaveAsPlaylistModal({ visible, onClose, songs }) {
  const { createPlaylist, addAllToPlaylist } = usePlayer();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    const id = createPlaylist(name.trim());
    addAllToPlaylist(id, songs);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setName('');
      onClose();
    }, 900);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.outer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose(); }} />
        <View style={styles.sheet}>
        <View style={styles.handle} />

        {saved ? (
          <View style={styles.successWrap}>
            <Ionicons name="checkmark-circle" size={40} color="#CCFF00" />
            <Text style={styles.successText}>저장됐어요!</Text>
          </View>
        ) : (
          <>
            <Text style={styles.title}>플레이리스트로 저장</Text>
            <Text style={styles.sub}>{songs?.length}곡을 새 플레이리스트에 저장해요</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="플레이리스트 이름을 입력해요"
                placeholderTextColor="#555"
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
                maxLength={40}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, !name.trim() && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveBtnText}>저장</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 20 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, paddingBottom: 34,
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  sub: { color: '#666', fontSize: 13, marginBottom: 20 },
  inputRow: {
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 14,
  },
  input: { color: '#fff', fontSize: 15 },
  saveBtn: {
    backgroundColor: '#CCFF00', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  successWrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  successText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
