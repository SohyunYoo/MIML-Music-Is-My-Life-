import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const PlayerContext = createContext(null);

const DEMO_SONGS = [
  { id: 's1', title: 'Love Me Do - Mono / Remastered', artist: 'The Beatles', color: '#2E2560', reason: 'Energy 0.4 · 차분한 템포' },
  { id: 's2', title: 'From Me to You - Mono / Remastered', artist: 'The Beatles', color: '#3A2E6E', reason: 'Valence 0.7 · 산책에 딱' },
  { id: 's3', title: 'She Loves You - Mono / Remastered', artist: 'The Beatles', color: '#4A3F8A', reason: 'Danceability 0.6 · 경쾌한' },
  { id: 's4', title: 'Easy', artist: 'Troye Sivan', color: '#3A2E6E', reason: 'Acousticness 0.5' },
  { id: 's5', title: 'Sugar', artist: 'Maroon 5', color: '#C0392B', reason: 'Energy 0.8' },
];

const DEFAULT_PLAYLISTS = [
  { id: 'liked', name: 'Liked Songs', description: '좋아요한 곡들', songs: [], icon: 'heart', color: '#4A3FBF' },
  { id: 'recent', name: 'Recently played', description: '최근 재생한 곡들', songs: DEMO_SONGS, icon: 'time-outline', color: '#5B4FC8' },
  { id: 'p1', name: '책 읽으며 들을 노래', description: '집중하면서 읽을 때 딱인 곡들', songs: [DEMO_SONGS[0], DEMO_SONGS[1]], icon: 'notifications', color: '#6B5BD2' },
  { id: 'p2', name: '한강 갈 때 좋은 노래', description: '', songs: [DEMO_SONGS[2], DEMO_SONGS[3]], icon: null, color: '#7C6DE0' },
  { id: 'p3', name: '영화 분위기 어울리는 노래', description: '', songs: [], icon: null, color: '#5248C0' },
];

export function PlayerProvider({ children }) {
  const { user } = useAuth();
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [playlists, setPlaylists] = useState(DEFAULT_PLAYLISTS);
  const [tasteProfile, setTasteProfile] = useState(null);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [alpha, setAlpha] = useState(0.5); // Now(0) ↔ My Vibe(1)

  const isLoaded = useRef(false);
  const saveTimer = useRef(null);

  // 로그인 시 Firestore에서 불러오기
  useEffect(() => {
    if (!user) {
      setPlaylists(DEFAULT_PLAYLISTS);
      setTasteProfile(null);
      setFeedbackCount(0);
      isLoaded.current = false;
      return;
    }
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        if (data.playlists?.length) setPlaylists(data.playlists);
        if (data.tasteProfile) setTasteProfile(data.tasteProfile);
        if (data.feedbackCount) setFeedbackCount(data.feedbackCount);
      } catch (e) {
        console.log('load error:', e);
      } finally {
        isLoaded.current = true;
      }
    };
    load();
  }, [user?.uid]);

  // 플레이리스트 변경 시 Firestore에 저장 (1초 디바운스)
  useEffect(() => {
    if (!user || !isLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), { playlists }, { merge: true });
      } catch (e) {
        console.log('playlists save error:', e);
      }
    }, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [playlists]);

  // 취향 프로필 업데이트 + Firebase 즉시 저장
  const updateTasteProfile = useCallback(async (profile, count) => {
    setTasteProfile(profile);
    setFeedbackCount(count);
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid),
        { tasteProfile: profile, feedbackCount: count },
        { merge: true }
      );
    } catch (e) {
      console.log('tasteProfile save error:', e);
    }
  }, [user]);

  const togglePlay = () =>
    setCurrentTrack(prev => ({ ...prev, isPlaying: !prev.isPlaying }));

  const playTrack = (track) => {
    setCurrentTrack({ ...track, isPlaying: true });
    addToRecent(track);
  };

  const playAll = (songs) => {
    if (!songs?.length) return;
    setCurrentTrack({ ...songs[0], source: 'BEATSPILL+', albumColor: songs[0].color, isPlaying: true });
    setQueue(songs.slice(1));
    addToRecent(songs[0]);
  };

  const playNext = () => {
    if (!queue.length) return;
    const [next, ...rest] = queue;
    setCurrentTrack({ ...next, source: 'BEATSPILL+', albumColor: next.color, isPlaying: true });
    setQueue(rest);
    addToRecent(next);
  };

  const playPrev = () => {
    setPlaylists(prev => {
      const recent = prev.find(pl => pl.id === 'recent');
      if (!recent || recent.songs.length < 2) return prev;
      const prevTrack = recent.songs[1];
      setCurrentTrack({ ...prevTrack, source: 'BEATSPILL+', albumColor: prevTrack.color, isPlaying: true });
      return prev;
    });
  };

  const addToRecent = (track) => {
    if (!track?.id) return;
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== 'recent') return pl;
      const filtered = pl.songs.filter(s => s.id !== track.id);
      return { ...pl, songs: [track, ...filtered].slice(0, 20) };
    }));
  };

  const toggleLike = (song) => {
    if (!song?.id) return;
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== 'liked') return pl;
      const already = pl.songs.some(s => s.id === song.id);
      return { ...pl, songs: already ? pl.songs.filter(s => s.id !== song.id) : [song, ...pl.songs] };
    }));
  };

  const isLiked = useCallback((songId) => {
    const liked = playlists.find(pl => pl.id === 'liked');
    return liked?.songs.some(s => s.id === songId) ?? false;
  }, [playlists]);

  const addToPlaylist = (playlistId, song) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      if (pl.songs.some(s => s.id === song.id)) return pl;
      return { ...pl, songs: [...pl.songs, song] };
    }));
  };

  const addAllToPlaylist = (playlistId, songs) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      const existingIds = new Set(pl.songs.map(s => s.id));
      return { ...pl, songs: [...pl.songs, ...songs.filter(s => !existingIds.has(s.id))] };
    }));
  };

  const createPlaylist = (name) => {
    const newPl = {
      id: Date.now().toString(), name, description: '', songs: [], icon: null,
      color: '#' + Math.floor(Math.random() * 0x444444 + 0x333333).toString(16),
    };
    setPlaylists(prev => [...prev, newPl]);
    return newPl.id;
  };

  const updatePlaylist = (playlistId, changes) => {
    setPlaylists(prev => prev.map(pl => pl.id === playlistId ? { ...pl, ...changes } : pl));
  };

  const removeFromPlaylist = (playlistId, songId) => {
    setPlaylists(prev => prev.map(pl =>
      pl.id === playlistId ? { ...pl, songs: pl.songs.filter(s => s.id !== songId) } : pl
    ));
  };

  // liked / recent 는 삭제 불가
  const SYSTEM_IDS = ['liked', 'recent'];
  const deletePlaylist = (playlistId) => {
    if (SYSTEM_IDS.includes(playlistId)) return;
    setPlaylists(prev => prev.filter(pl => pl.id !== playlistId));
  };

  return (
    <PlayerContext.Provider value={{
      currentTrack, togglePlay, playTrack, playAll, playNext, playPrev, queue, setQueue,
      playlists, addToPlaylist, addAllToPlaylist, createPlaylist, updatePlaylist, removeFromPlaylist, deletePlaylist,
      toggleLike, isLiked,
      tasteProfile, feedbackCount, updateTasteProfile,
      alpha, setAlpha,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
