package com.miml.backend.service

import com.miml.backend.client.SpotifyClient
import com.miml.backend.dto.LikedTracksImportRequest
import com.miml.backend.dto.LikedTracksImportResponse
import com.miml.backend.dto.SpotifyTrack
import com.miml.backend.repository.MusicRepository
import com.miml.backend.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SpotifyImportService(
    private val spotifyClient: SpotifyClient,
    private val musicAnalysisService: MusicAnalysisService,
    private val musicRepository: MusicRepository,
    private val userRepository: UserRepository,
    private val artistGenreService: ArtistGenreService
) {

    fun importLikedTracks(userId: Long, request: LikedTracksImportRequest): LikedTracksImportResponse {
        val startTime = System.currentTimeMillis()
        val accessToken = request.spotifyAccessToken

        println("============================================")
        println("❤️ Spotify 좋아요 곡 가져오기 시작")
        println("   사용자 ID: $userId")

        val spotifyProfile = spotifyClient.fetchUserProfile(accessToken)
            ?: throw RuntimeException("Spotify 사용자 정보 조회 실패. access_token이 유효한지 확인하세요.")

        println("   Spotify 사용자: ${spotifyProfile.displayName} (id: ${spotifyProfile.id})")

        val user = userRepository.findById(userId).orElseThrow {
            RuntimeException("사용자를 찾을 수 없음: $userId")
        }

        user.spotifyId = spotifyProfile.id
        user.spotifyConnected = true
        userRepository.save(user)
        println("   ✅ users.spotify_id 업데이트")

        val maxTracks = request.maxTracks
        val allTracks = mutableListOf<SpotifyTrack>()
        var offset = 0
        val pageSize = 50
        var totalLiked = 0

        println("   최대 ${maxTracks}곡 가져오기 시작...")

        while (allTracks.size < maxTracks) {
            val response = spotifyClient.fetchLikedTracks(
                accessToken = accessToken,
                limit = pageSize,
                offset = offset
            )

            if (response == null) {
                println("   ⚠️ 페이지 조회 실패 (offset=$offset)")
                break
            }

            totalLiked = response.total
            val pageTracks = response.items.mapNotNull { it.track }.filter { it.id != null }
            allTracks.addAll(pageTracks)

            println("   페이지 offset=$offset → ${pageTracks.size}곡 (누적: ${allTracks.size}/${totalLiked})")

            if (response.next == null || pageTracks.isEmpty()) break
            offset += pageSize
        }

        val tracks = allTracks.take(maxTracks)
        println("   가져온 곡 수: ${tracks.size} (전체 좋아요: ${totalLiked}개)")

        var newTracksAdded = 0
        var alreadyExisted = 0
        var failed = 0
        val failedTracks = mutableListOf<String>()
        val collectedFeatures = mutableListOf<com.miml.backend.entity.AudioFeatures>()

        tracks.forEachIndexed { index, track ->
            val trackInfo = "${track.name} - ${track.artists.firstOrNull()?.name ?: "(unknown)"}"
            println("   [${index + 1}/${tracks.size}] $trackInfo")

            try {
                val result = musicAnalysisService.fetchAndSaveMusicBySpotifyId(
                    spotifyId = track.id!!,
                    title = track.name,
                    artist = track.artists.firstOrNull()?.name ?: "Unknown Artist",
                    album = track.album?.name,
                    albumImageUrl = track.album?.images?.firstOrNull()?.url
                )

                if (result.isNewlyAdded) newTracksAdded++ else alreadyExisted++
                result.audioFeatures?.let { collectedFeatures.add(it) }

                // 주 아티스트 장르 저장 (이미 저장된 아티스트는 스킵)
                val primaryArtist = track.artists.firstOrNull()
                if (primaryArtist?.id != null) {
                    artistGenreService.saveGenresIfAbsent(primaryArtist.id, primaryArtist.name)
                }

            } catch (e: Exception) {
                println("   ❌ 처리 실패: ${e.message}")
                failed++
                failedTracks.add("$trackInfo: ${e.message}")
            }
        }

        val profileUpdated = if (collectedFeatures.isNotEmpty()) {
            calculateUserProfile(userId, collectedFeatures)
            true
        } else false

        val elapsedSeconds = (System.currentTimeMillis() - startTime) / 1000.0

        println("\n============================================")
        println("🏁 Spotify 좋아요 곡 가져오기 완료 (${elapsedSeconds}초)")
        println("   가져온 곡: ${tracks.size} / 전체 좋아요: ${totalLiked}개")
        println("   ✅ 신규: $newTracksAdded")
        println("   ⏭️ 이미 존재: $alreadyExisted")
        println("   ❌ 실패: $failed")
        println("   프로파일 업데이트: $profileUpdated")
        println("============================================")

        return LikedTracksImportResponse(
            totalTracksFound = tracks.size,
            newTracksAdded = newTracksAdded,
            alreadyExisted = alreadyExisted,
            failed = failed,
            profileUpdated = profileUpdated,
            elapsedSeconds = elapsedSeconds,
            failedTracks = failedTracks.take(10)
        )
    }

    private fun calculateUserProfile(userId: Long, features: List<com.miml.backend.entity.AudioFeatures>) {
        val user = userRepository.findById(userId).orElseThrow()

        user.profileEnergy       = modeBucket(features.map { it.energy },       min = 0,   max = 100, buckets = 5)
        user.profileHappiness    = modeBucket(features.map { it.happiness },     min = 0,   max = 100, buckets = 5)
        user.profileDanceability = modeBucket(features.map { it.danceability },  min = 0,   max = 100, buckets = 5)
        user.profileAcousticness = modeBucket(features.map { it.acousticness },  min = 0,   max = 100, buckets = 5)
        user.profileTempo        = modeBucket(features.map { it.tempo },         min = 60,  max = 200, buckets = 7)

        userRepository.save(user)

        println("📊 사용자 프로파일 업데이트 (분포 기반, ${features.size}곡):")
        println("   energy: ${user.profileEnergy}")
        println("   happiness: ${user.profileHappiness}")
        println("   danceability: ${user.profileDanceability}")
        println("   acousticness: ${user.profileAcousticness}")
        println("   tempo: ${user.profileTempo}")
    }

    /**
     * [min, max] 범위를 buckets개 구간으로 나눠 가장 많은 곡이 속한 구간의 평균값을 반환.
     * 동점 시 더 높은 구간 우선(최신 취향 편향 방지를 위해 임의 tie-break 대신 상위 구간).
     */
    private fun modeBucket(values: List<Int>, min: Int, max: Int, buckets: Int): Int {
        if (values.isEmpty()) return (min + max) / 2
        val bucketSize = (max - min).toDouble() / buckets
        val counts = IntArray(buckets)
        for (v in values) {
            val idx = ((v - min) / bucketSize).toInt().coerceIn(0, buckets - 1)
            counts[idx]++
        }
        val maxCount = counts.max()
        // 동점이면 마지막(높은) 구간 선택
        val topBucketIdx = counts.indices.last { counts[it] == maxCount }
        val lo = min + topBucketIdx * bucketSize
        val hi = lo + bucketSize
        val inBucket = values.filter { it >= lo && it < hi || (topBucketIdx == buckets - 1 && it == max) }
        return if (inBucket.isEmpty()) ((lo + hi) / 2).toInt() else inBucket.average().toInt()
    }

    fun fillMissingAlbumImages(accessToken: String, maxTracks: Int = 100): Map<String, Any> {
        val allMissing = musicRepository.findAllByAlbumImageUrlIsNullAndSpotifyIdIsNotNull()
        val targets = allMissing.take(maxTracks)

        println("============================================")
        println("🖼️ 앨범 이미지 일괄 업데이트 시작")
        println("   전체 미완료: ${allMissing.size}개 / 이번 배치: ${targets.size}개")

        var updated = 0
        var notFound = 0

        targets.forEachIndexed { index, music ->
            print("   [${index + 1}/${targets.size}] ${music.title} - ${music.artist} → ")
            val track = spotifyClient.fetchTrackById(accessToken, music.spotifyId!!)
            val imageUrl = track?.album?.images?.firstOrNull()?.url

            if (imageUrl != null) {
                music.albumImageUrl = imageUrl
                musicRepository.save(music)
                println("✅ $imageUrl")
                updated++
            } else {
                println("❌ 이미지 없음")
                notFound++
            }

            if (index < targets.size - 1) Thread.sleep(200)
        }

        println("============================================")
        println("🏁 완료 — ✅ 업데이트: $updated / ❌ 실패: $notFound / ⏳ 남음: ${allMissing.size - targets.size}")
        println("============================================")

        return mapOf(
            "total" to targets.size,
            "updated" to updated,
            "notFound" to notFound,
            "remaining" to (allMissing.size - targets.size)
        )
    }

    fun fillMissingSpotifyIds(accessToken: String, maxTracks: Int = 50): Map<String, Any> {
        val allSongs = musicRepository.findAllBySpotifyIdIsNull()
        val songs = allSongs.take(maxTracks)

        println("============================================")
        println("🔍 Spotify ID 일괄 채우기 시작")
        println("   전체 미완료: ${allSongs.size}개 / 이번 배치: ${songs.size}개")

        var filled = 0
        var notFound = 0
        val notFoundSongs = mutableListOf<String>()

        songs.forEachIndexed { index, music ->
            val info = "${music.title} - ${music.artist}"
            print("   [${index + 1}/${songs.size}] $info → ")

            val spotifyId = spotifyClient.searchTrack(accessToken, music.title, music.artist)
            if (spotifyId != null) {
                val duplicate = musicRepository.findBySpotifyId(spotifyId)
                if (duplicate != null) {
                    println("⏭️ 중복 (id=${duplicate.id}에 이미 존재) — 스킵")
                    notFound++
                    notFoundSongs.add("$info [중복: ${duplicate.title} - ${duplicate.artist}]")
                } else {
                    music.spotifyId = spotifyId
                    musicRepository.save(music)
                    println("✅ $spotifyId")
                    filled++
                }
            } else {
                println("❌ 못 찾음")
                notFound++
                notFoundSongs.add(info)
            }

            // Spotify API 레이트 리밋 방지 (500ms ≈ 2 req/s)
            Thread.sleep(500)
        }

        println("\n============================================")
        println("🏁 Spotify ID 채우기 완료")
        println("   ✅ 채움: $filled")
        println("   ❌ 못찾음: $notFound")
        val remaining = allSongs.size - songs.size
        println("   ⏳ 아직 남은 곡: ${remaining}개")
        println("============================================")

        return mapOf(
            "total" to songs.size,
            "filled" to filled,
            "notFound" to notFound,
            "remaining" to remaining,
            "notFoundSongs" to notFoundSongs.take(50)
        )
    }
}
