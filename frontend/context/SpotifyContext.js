import { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_TOKEN = '@spotify_access_token';
const STORAGE_KEY_REFRESH = '@spotify_refresh_token';
const STORAGE_KEY_EXPIRY = '@spotify_token_expiry';
const STORAGE_KEY_USER = '@spotify_user';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = 'f8656c156c9d4f07a1f159cb38cfc203';

// Expo Go = exp://IP:PORT (매번 바뀜)
// 개발 빌드 / 프로덕션 = miml:// (고정)
const REDIRECT_URI = Constants.appOwnership === 'expo'
  ? AuthSession.makeRedirectUri()                                        // Expo Go
  : AuthSession.makeRedirectUri({ scheme: 'miml', path: 'redirect' });  // 빌드된 앱

console.log('👉 Spotify redirectUri (이걸 Spotify 대시보드에 등록하세요):', REDIRECT_URI);
const SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
  'streaming',
];

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const SpotifyContext = createContext(null);

export function SpotifyProvider({ children }) {
  const [token, setToken] = useState(null);
  const [spotifyUser, setSpotifyUser] = useState(null);
  const { user } = useAuth();
  const refreshTokenRef = useRef(null);
  const tokenExpiryRef = useRef(null);

  // 앱 시작 시 저장된 토큰 복원
  useEffect(() => {
    const restore = async () => {
      try {
        const [savedToken, savedRefresh, savedExpiry, savedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_REFRESH),
          AsyncStorage.getItem(STORAGE_KEY_EXPIRY),
          AsyncStorage.getItem(STORAGE_KEY_USER),
        ]);
        if (savedRefresh) refreshTokenRef.current = savedRefresh;
        if (savedExpiry) tokenExpiryRef.current = parseInt(savedExpiry);
        if (savedUser) setSpotifyUser(JSON.parse(savedUser));

        if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry)) {
          // 토큰이 아직 유효함
          setToken(savedToken);
        } else if (savedRefresh) {
          // 만료됐으면 갱신 시도 (refreshAccessToken은 아래 정의되지만 여기서 직접 호출)
          const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: savedRefresh,
            client_id: CLIENT_ID,
          });
          const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });
          const data = await res.json();
          if (data.access_token) {
            const expiry = Date.now() + (data.expires_in - 60) * 1000;
            setToken(data.access_token);
            if (data.refresh_token) {
              refreshTokenRef.current = data.refresh_token;
              await AsyncStorage.setItem(STORAGE_KEY_REFRESH, data.refresh_token);
            }
            tokenExpiryRef.current = expiry;
            await AsyncStorage.setItem(STORAGE_KEY_TOKEN, data.access_token);
            await AsyncStorage.setItem(STORAGE_KEY_EXPIRY, String(expiry));
          }
        }
      } catch (e) {
        console.log('Spotify restore error:', e);
      }
    };
    restore();
  }, []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri: REDIRECT_URI,
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeToken(code);
    }
  }, [response]);

  const exchangeToken = async (code) => {
    try {
      const result = await AuthSession.exchangeCodeAsync(
        {
          clientId: CLIENT_ID,
          code,
          redirectUri: REDIRECT_URI,
          extraParams: { code_verifier: request?.codeVerifier },
        },
        discovery
      );
      const expiry = Date.now() + ((result.expiresIn || 3600) - 60) * 1000;
      setToken(result.accessToken);
      console.log('🔑 SPOTIFY_TOKEN=' + result.accessToken);
      if (result.refreshToken) {
        refreshTokenRef.current = result.refreshToken;
        await AsyncStorage.setItem(STORAGE_KEY_REFRESH, result.refreshToken);
      }
      tokenExpiryRef.current = expiry;
      await AsyncStorage.setItem(STORAGE_KEY_TOKEN, result.accessToken);
      await AsyncStorage.setItem(STORAGE_KEY_EXPIRY, String(expiry));
      fetchUser(result.accessToken);
    } catch (e) {
      console.log('Spotify token exchange error:', e);
    }
  };

  // 토큰 갱신
  const refreshAccessToken = async () => {
    if (!refreshTokenRef.current) return null;
    try {
      console.log('🔄 Spotify 토큰 갱신 시도...');
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenRef.current,
        client_id: CLIENT_ID,
      });
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        const expiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
        setToken(data.access_token);
        tokenExpiryRef.current = expiry;
        await AsyncStorage.setItem(STORAGE_KEY_TOKEN, data.access_token);
        await AsyncStorage.setItem(STORAGE_KEY_EXPIRY, String(expiry));
        if (data.refresh_token) {
          refreshTokenRef.current = data.refresh_token;
          await AsyncStorage.setItem(STORAGE_KEY_REFRESH, data.refresh_token);
        }
        return data.access_token;
      }
    } catch (e) {
      console.log('Spotify token refresh error:', e);
    }
    return null;
  };

  // 유효한 토큰 반환 (만료 시 자동 갱신)
  const getValidToken = async () => {
    if (!token) return null;
    if (tokenExpiryRef.current && Date.now() > tokenExpiryRef.current) {
      const newToken = await refreshAccessToken();
      return newToken;
    }
    return token;
  };

  const fetchUser = async (accessToken) => {
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setSpotifyUser(data);
      await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data));
      // Firebase에 Spotify 계정 정보 저장
      if (user?.uid) {
        await setDoc(doc(db, 'users', user.uid), {
          spotify: {
            id: data.id,
            displayName: data.display_name,
            email: data.email,
            imageUrl: data.images?.[0]?.url || null,
            connectedAt: new Date().toISOString(),
          }
        }, { merge: true });
      }
    } catch (e) {
      console.log('Spotify user fetch error:', e);
    }
  };

  // spotifyId로 직접 트랙 조회 → 앨범아트 반환
  const getTrackById = async (spotifyId) => {
    const t = await getValidToken();
    if (!t || !spotifyId) return null;
    try {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return null;
      const track = await res.json();
      return {
        albumArt: track.album?.images?.[0]?.url || null,
        spotifyUri: `spotify:track:${track.id}`,
        durationMs: track.duration_ms,
      };
    } catch { return null; }
  };

  // 자유 쿼리로 여러 곡 검색 (ComposeBox 검색용)
  const searchTracks = async (searchQuery, limit = 6) => {
    const t = await getValidToken();
    if (!t || !searchQuery.trim()) return [];
    try {
      const q = encodeURIComponent(searchQuery);
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${q}&type=track&limit=${limit}`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const data = await res.json();
      return (data.tracks?.items || []).map(track => ({
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        albumImageUrl: track.album?.images?.[0]?.url || null,
        spotifyId: track.id,
        spotifyUri: `spotify:track:${track.id}`,
        durationMs: track.duration_ms,
      }));
    } catch (e) {
      console.log('searchTracks error:', e);
      return [];
    }
  };

  // 곡명 + 아티스트로 Spotify 트랙 검색 → preview_url 반환
  const searchTrack = async (title, artist) => {
    const t = await getValidToken();
    if (!t) return null;
    try {
      const q = encodeURIComponent(`track:${title} artist:${artist}`);
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const data = await res.json();
      const track = data.tracks?.items?.[0];
      if (!track) return null;
      return {
        previewUrl: track.preview_url,
        spotifyUri: `spotify:track:${track.id}`,
        spotifyId: track.id,
        albumArt: track.album?.images?.[0]?.url,
        durationMs: track.duration_ms,
      };
    } catch (e) {
      console.log('Spotify search error:', e);
      return null;
    }
  };

  // 사용 가능한 기기 목록 조회
  const getDevices = async () => {
    const t = await getValidToken();
    if (!t) return [];
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.devices || [];
    } catch (e) { return []; }
  };

  // Spotify 앱에서 전곡 재생 — 기기 자동 선택
  const playOnSpotify = async (spotifyUri) => {
    const t = await getValidToken();
    if (!t || !spotifyUri) return { ok: false, reason: 'no_token' };
    try {
      // 기기 목록 조회
      const devices = await getDevices();
      console.log('🎵 Spotify devices:', JSON.stringify(devices.map(d => `${d.name}(${d.type},active:${d.is_active})`)));

      if (devices.length === 0) {
        console.log('❌ Spotify Connect: 기기 없음. Spotify 앱을 열어주세요.');
        return { ok: false, reason: 'no_device' };
      }

      const activeDevice = devices.find(d => d.is_active);
      const anyDevice = devices[0];
      const device = activeDevice || anyDevice;
      const deviceId = device?.id;

      // 비활성 기기면 먼저 transfer
      if (!activeDevice && anyDevice) {
        console.log(`📲 기기 활성화 시도: ${anyDevice.name}`);
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [anyDevice.id], play: false }),
        });
        await new Promise(r => setTimeout(r, 800)); // Spotify가 활성화될 때까지 대기
      }

      const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [spotifyUri] }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.log('❌ Spotify play failed:', res.status, body);
        return { ok: false, reason: `http_${res.status}` };
      }
      console.log('✅ Spotify play OK:', spotifyUri);
      return { ok: true };
    } catch (e) {
      console.log('❌ Spotify play error:', e);
      return { ok: false, reason: 'exception' };
    }
  };

  const pauseOnSpotify = async () => {
    const t = await getValidToken();
    if (!t) return;
    try {
      const devices = await getDevices();
      const deviceId = devices.find(d => d.is_active)?.id || devices[0]?.id;
      const url = deviceId
        ? `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`
        : 'https://api.spotify.com/v1/me/player/pause';
      await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${t}` },
      });
    } catch (e) {}
  };

  const seekOnSpotify = async (positionMs) => {
    const t = await getValidToken();
    if (!t) return;
    try {
      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${t}` },
      });
    } catch (e) {}
  };

  const getPlayerState = async () => {
    const t = await getValidToken();
    if (!t) return null;
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 204 || !res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  };

  const connect = () => promptAsync();
  const disconnect = async () => {
    setToken(null);
    setSpotifyUser(null);
    refreshTokenRef.current = null;
    tokenExpiryRef.current = null;
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEY_REFRESH),
      AsyncStorage.removeItem(STORAGE_KEY_EXPIRY),
      AsyncStorage.removeItem(STORAGE_KEY_USER),
    ]);
  };

  return (
    <SpotifyContext.Provider value={{
      token, spotifyUser, connect, disconnect, searchTrack, searchTracks, getTrackById,
      playOnSpotify, pauseOnSpotify, seekOnSpotify, getPlayerState, getDevices,
      isConnected: !!token,
    }}>
      {children}
    </SpotifyContext.Provider>
  );
}

export const useSpotify = () => useContext(SpotifyContext);
