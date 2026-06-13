import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

let _animPlayed = false;

function AnimatedButton({ style, onPress, children, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => onPress?.());
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={[style, disabled && { opacity: 0.5 }]} onPress={press} activeOpacity={1}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function LoginScreen({ navigation }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const logoY  = useRef(new Animated.Value(-40)).current;
  const logoOp = useRef(new Animated.Value(0)).current;
  const formOp = useRef(new Animated.Value(0)).current;
  const formY  = useRef(new Animated.Value(24)).current;
  const btn1Op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (_animPlayed) {
      logoOp.setValue(1); logoY.setValue(0);
      formOp.setValue(1); formY.setValue(0);
      btn1Op.setValue(1);
      return;
    }
    _animPlayed = true;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(logoY,  { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(formY,  { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(btn1Op, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setAlertMsg('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        navigation.replace('Main');
      } else {
        if (!name.trim()) { setAlertMsg('이름을 입력해주세요.'); setLoading(false); return; }
        await signUp(email.trim(), password, name.trim());
        navigation.replace('Main');
      }
    } catch (e) {
      const msg = {
        'auth/user-not-found': '등록되지 않은 이메일이에요.',
        'auth/wrong-password': '비밀번호가 틀렸어요.',
        'auth/email-already-in-use': '이미 사용 중인 이메일이에요.',
        'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
        'auth/invalid-email': '올바른 이메일 형식이 아니에요.',
        'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않아요.',
      }[e.code] || '오류가 발생했어요. 다시 시도해주세요.';
      setAlertMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      {/* 커스텀 알림 모달 */}
      <Modal visible={!!alertMsg} transparent animationType="fade" onRequestClose={() => setAlertMsg('')}>
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertMsg}>{alertMsg}</Text>
            <TouchableOpacity style={styles.alertBtn} onPress={() => setAlertMsg('')}>
              <Text style={styles.alertBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Animated.Text style={[styles.logo, { opacity: logoOp, transform: [{ translateY: logoY }] }]}>
        MIML
      </Animated.Text>

      <Animated.View style={{ opacity: formOp, transform: [{ translateY: formY }] }}>
        {/* 모드 탭 */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => setMode('login')}>
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, mode === 'signup' && styles.tabActive]} onPress={() => setMode('signup')}>
            <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>회원가입</Text>
          </TouchableOpacity>
        </View>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="이름"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="email@domain.com"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.pwRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="비밀번호"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#555" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: btn1Op, marginTop: 20 }}>
        <AnimatedButton
          style={styles.btnContinue}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnContinueText}>{mode === 'login' ? '로그인' : '가입하기'}</Text>
          }
        </AnimatedButton>
      </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#000',
  },
  scroll: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 32, paddingVertical: 40,
  },
  logo: {
    fontSize: 80, fontWeight: '900', color: '#CCFF00',
    textAlign: 'center', letterSpacing: -5, marginBottom: 48,
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#1A1A1A',
    borderRadius: 10, padding: 4, marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#2A2A2A' },
  tabText: { color: '#555', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#1A1A1A', color: '#fff', height: 52,
    borderRadius: 10, paddingHorizontal: 16, fontSize: 15,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eyeBtn: { position: 'absolute', right: 14 },
  btnContinue: {
    height: 52, borderRadius: 10, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  btnContinueText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#2A2A2A' },
  orText: { color: '#555', marginHorizontal: 12, fontSize: 13 },
  btnGoogle: {
    height: 52, borderRadius: 10, backgroundColor: '#CCFF00',
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
  },
  btnGoogleText: { color: '#000', fontSize: 16, fontWeight: '700' },

  alertOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  alertBox: {
    backgroundColor: '#111', borderRadius: 20, padding: 28,
    width: '78%', alignItems: 'center', borderWidth: 1, borderColor: '#222',
  },
  alertMsg: { color: '#ccc', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  alertBtn: {
    backgroundColor: '#CCFF00', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  alertBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
