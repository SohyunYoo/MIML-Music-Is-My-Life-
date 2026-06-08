package com.miml.backend.service

import com.miml.backend.client.SoundNetClient
import com.miml.backend.client.SpotifyClient
import com.miml.backend.entity.AudioFeatures
import com.miml.backend.entity.Music
import com.miml.backend.repository.AudioFeaturesRepository
import com.miml.backend.repository.MusicRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

@Service
class MusicAnalysisService(
    private val musicRepository: MusicRepository,
    private val audioFeaturesRepository: AudioFeaturesRepository,
    private val soundNetClient: SoundNetClient,
    private val spotifyClient: SpotifyClient
) {

    /**
     * 곡명/가수로 음원 정보 수집 + DB 저장 (기존)
     * 사용: 일괄 등록, 단일 등록 등
     */
    @Transactional
    fun fetchAndSaveMusic(title: String, artist: String, spotifyAccessToken: String? = null): MusicSaveResult {
        // 입력 정규화: 앞뒤 공백 제거
        val cleanTitle = title.trim()
        val cleanArtist = artist.trim()

        // 빈 문자열 체크 (사용자가 공백만 입력한 경우)
        if (cleanTitle.isBlank() || cleanArtist.isBlank()) {
            throw IllegalArgumentException("title과 artist는 비어있을 수 없습니다.")
        }

        println("============================================")
        println("🎵 음원 분석 시작: $cleanTitle - $cleanArtist")

        // 1. SoundNet API 호출 (음향 분석 - 필수)
        println("📡 SoundNet API 호출 중...")
        val soundNetResponse = soundNetClient.fetchTrackAnalysis(cleanTitle, cleanArtist)
            ?: throw RuntimeException("SoundNet API에서 응답을 받지 못했습니다.")

        println("📥 SoundNet 응답 수신: $soundNetResponse")

        if (soundNetResponse.energy == null || soundNetResponse.happiness == null ||
            soundNetResponse.danceability == null || soundNetResponse.acousticness == null ||
            soundNetResponse.tempo == null) {
            throw RuntimeException("SoundNet 응답에 필수 데이터가 누락되었습니다")
        }

        // 2. Spotify 메타데이터 조회 (선택, 실패해도 진행)
        var spotifyId: String? = null
        var albumTitle: String? = null
        var albumImageUrl: String? = null

        if (spotifyAccessToken != null) {
            println("📡 Spotify 검색 중...")
            val spotifyTrack = spotifyClient.searchTrackWithDetails(spotifyAccessToken, cleanTitle, cleanArtist)
            if (spotifyTrack != null) {
                spotifyId = spotifyTrack.id
                albumTitle = spotifyTrack.album?.name
                albumImageUrl = spotifyTrack.album?.images?.firstOrNull()?.url
                println("📥 Spotify 응답: id=$spotifyId, album=$albumTitle, image=$albumImageUrl")
            } else {
                println("   ⚠️ Spotify 검색 실패 (계속 진행)")
            }
        }

        // 3. Music 엔티티 저장
        val music = Music(
            title = cleanTitle,
            artist = cleanArtist,
            album = albumTitle,
            albumImageUrl = albumImageUrl,
            spotifyId = spotifyId
        )
        val savedMusic = musicRepository.save(music)
        println("💾 Music 저장 완료 (id: ${savedMusic.id})")

        // 4. AudioFeatures 엔티티 저장
        val audioFeatures = AudioFeatures(
            musicId = savedMusic.id!!,
            energy = soundNetResponse.energy,
            happiness = soundNetResponse.happiness,
            danceability = soundNetResponse.danceability,
            acousticness = soundNetResponse.acousticness,
            tempo = soundNetResponse.tempo,
            musicKey = soundNetResponse.key,
            musicMode = soundNetResponse.mode,
            camelot = soundNetResponse.camelot,
            instrumentalness = soundNetResponse.instrumentalness,
            loudness = soundNetResponse.loudness,
            speechiness = soundNetResponse.speechiness,
            liveness = soundNetResponse.liveness,
            duration = soundNetResponse.duration,
            popularity = soundNetResponse.popularity
        )
        val savedFeatures = audioFeaturesRepository.save(audioFeatures)
        println("💾 AudioFeatures 저장 완료 (music_id: ${savedFeatures.musicId})")
        println("============================================")

        return MusicSaveResult(
            isNewlyAdded = true,
            music = savedMusic,
            audioFeatures = savedFeatures
        )
    }

    /**
     * ⭐ Spotify ID 기반 음원 정보 수집 + DB 저장 (신규)
     * 사용: Spotify 플레이리스트 통합
     *
     * 장점:
     * - SoundNet에 Spotify ID로 호출 → 정확한 음향 데이터 (가짜 데이터 방지)
     * - 메타데이터(album, image)는 Spotify에서 받음
     * - music.spotify_id 컬럼에 ID 저장 → 향후 정확한 재생 가능
     *
     * REQUIRES_NEW: 호출자(importUserPlaylists)의 트랜잭션과 분리하여
     * 한 곡 실패가 전체 import 롤백으로 이어지지 않도록 함
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun fetchAndSaveMusicBySpotifyId(
        spotifyId: String,
        title: String,
        artist: String,
        album: String? = null,
        albumImageUrl: String? = null
    ): MusicSaveResult {
        val cleanTitle = title.trim()
        val cleanArtist = artist.trim()

        if (cleanTitle.isBlank() || cleanArtist.isBlank()) {
            throw IllegalArgumentException("title과 artist는 비어있을 수 없습니다.")
        }

        if (spotifyId.isBlank()) {
            throw IllegalArgumentException("spotifyId는 비어있을 수 없습니다.")
        }

        println("============================================")
        println("🎵 Spotify ID 기반 음원 분석: $cleanTitle - $cleanArtist")
        println("   Spotify ID: $spotifyId")

        // 1. 중복 체크: spotifyId 우선, 없으면 title+artist로 fallback
        val existing = musicRepository.findBySpotifyId(spotifyId)
            ?: musicRepository.findByTitleAndArtist(cleanTitle, cleanArtist)
        if (existing != null) {
            println("⏭️ 이미 DB에 존재 (id: ${existing.id})")

            // Spotify ID가 없었다면 업데이트 (기존 곡이 곡명/가수 검색으로 등록된 경우)
            if (existing.spotifyId.isNullOrBlank()) {
                existing.spotifyId = spotifyId
                musicRepository.save(existing)
                println("   ✅ 기존 곡에 spotify_id 추가")
            }

            val existingFeatures = audioFeaturesRepository.findById(existing.id!!).orElse(null)

            println("============================================")
            return MusicSaveResult(
                isNewlyAdded = false,
                music = existing,
                audioFeatures = existingFeatures
            )
        }

        // 2. SoundNet API 호출: Spotify ID 먼저 시도, 실패 시 곡명/가수 fallback
        println("📡 SoundNet API 호출 (Spotify ID)...")
        val soundNetResponse = soundNetClient.fetchTrackAnalysisBySpotifyId(spotifyId)
            ?.also { println("   ✅ Spotify ID 방식 성공") }
            ?: run {
                println("   ⚠️ Spotify ID 방식 실패 → 곡명/가수 방식으로 재시도...")
                soundNetClient.fetchTrackAnalysis(cleanTitle, cleanArtist)
            }
            ?: throw RuntimeException("SoundNet API에서 응답을 받지 못했습니다.")

        println("📥 SoundNet 응답 수신: $soundNetResponse")

        if (soundNetResponse.energy == null || soundNetResponse.happiness == null ||
            soundNetResponse.danceability == null || soundNetResponse.acousticness == null ||
            soundNetResponse.tempo == null) {
            throw RuntimeException("SoundNet 응답에 필수 데이터가 누락되었습니다")
        }

        // 3. Music 엔티티 저장 (Spotify의 메타데이터 활용)
        val music = Music(
            title = cleanTitle,
            artist = cleanArtist,
            album = album,
            albumImageUrl = albumImageUrl,
            spotifyId = spotifyId  // ⭐ Spotify ID 저장
        )
        val savedMusic = musicRepository.save(music)
        println("💾 Music 저장 완료 (id: ${savedMusic.id}, spotify_id: $spotifyId)")

        // 4. AudioFeatures 엔티티 저장
        val audioFeatures = AudioFeatures(
            musicId = savedMusic.id!!,
            energy = soundNetResponse.energy,
            happiness = soundNetResponse.happiness,
            danceability = soundNetResponse.danceability,
            acousticness = soundNetResponse.acousticness,
            tempo = soundNetResponse.tempo,
            musicKey = soundNetResponse.key,
            musicMode = soundNetResponse.mode,
            camelot = soundNetResponse.camelot,
            instrumentalness = soundNetResponse.instrumentalness,
            loudness = soundNetResponse.loudness,
            speechiness = soundNetResponse.speechiness,
            liveness = soundNetResponse.liveness,
            duration = soundNetResponse.duration,
            popularity = soundNetResponse.popularity
        )
        val savedFeatures = audioFeaturesRepository.save(audioFeatures)
        println("💾 AudioFeatures 저장 완료")
        println("============================================")

        return MusicSaveResult(
            isNewlyAdded = true,
            music = savedMusic,
            audioFeatures = savedFeatures
        )
    }

}

data class MusicSaveResult(
    val isNewlyAdded: Boolean,
    val music: Music,
    val audioFeatures: AudioFeatures?
)