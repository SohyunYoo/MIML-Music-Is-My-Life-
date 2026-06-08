package com.miml.backend.controller

import com.google.firebase.cloud.FirestoreClient
import com.miml.backend.client.SpotifyClient
import com.miml.backend.dto.SmartRecommendationRequest
import com.miml.backend.dto.TagGenerationRequest
import com.miml.backend.dto.SmartRecommendationResponse
import com.miml.backend.entity.User
import com.miml.backend.repository.ArtistGenreRepository
import com.miml.backend.repository.AudioFeaturesRepository
import com.miml.backend.repository.MusicRepository
import com.miml.backend.repository.UserRepository
import com.miml.backend.service.ArtistGenreService
import com.miml.backend.service.BulkImportResult
import com.miml.backend.service.BulkImportService
import com.miml.backend.service.MusicAnalysisService
import com.miml.backend.service.SmartRecommendationService
import com.miml.backend.service.TagGenerationService
import com.miml.backend.service.TrackRequest
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/admin/bulk-import")
class BulkImportController(
    private val bulkImportService: BulkImportService,
    private val spotifyClient: SpotifyClient,
    private val musicAnalysisService: MusicAnalysisService,
    private val tagGenerationService: TagGenerationService,
    private val musicRepository: MusicRepository,
    private val audioFeaturesRepository: AudioFeaturesRepository,
    private val smartRecommendationService: SmartRecommendationService,
    private val userRepository: UserRepository,
    private val artistGenreService: ArtistGenreService,
    private val artistGenreRepository: ArtistGenreRepository
) {

    /**
     * 기존 DB 곡의 주 아티스트 장르를 Last.fm에서 일괄 조회해 저장
     * - 아티스트 이름 기준 중복 제거 → 같은 아티스트 곡이 10개여도 API 호출 1번
     * - Spotify artist ID는 searchArtistId()로 조회 (트랙 조회 대비 호출 수 동일하나 429 덜 발생)
     * - 이미 장르가 저장된 아티스트는 API 호출 없이 스킵
     */
    @PostMapping("/fill-missing-genres")
    fun fillMissingGenres(
        @RequestHeader("X-Spotify-Token") spotifyAccessToken: String,
        @RequestParam(defaultValue = "200") maxArtists: Int
    ): Map<String, Any> {
        // 이미 저장된 아티스트 이름을 미리 수집 → 루프 진입 전에 제외
        val savedArtistNames = artistGenreRepository.findAll()
            .map { it.artistName.lowercase() }.toSet()

        // 아티스트 이름 기준 중복 제거 + 미저장 아티스트만 필터링
        val uniqueArtists = musicRepository.findAllBySpotifyIdIsNotNull()
            .distinctBy { it.artist }
            .filter { it.artist.lowercase() !in savedArtistNames }
            .take(maxArtists)

        println("🎸 장르 일괄 저장 시작: ${uniqueArtists.size}명 미저장 아티스트 처리 예정")

        var saved = 0
        var skipped = 0
        var failed = 0

        uniqueArtists.forEachIndexed { index, music ->
            print("   [${index + 1}/${uniqueArtists.size}] ${music.artist} → ")
            try {
                val spotifyArtistId = spotifyClient.searchArtistId(spotifyAccessToken, music.artist)

                if (spotifyArtistId == null) {
                    println("Spotify 아티스트 ID 없음, 스킵")
                    skipped++
                } else {
                    artistGenreService.saveGenresIfAbsent(spotifyArtistId, music.artist)
                    saved++
                }
            } catch (e: Exception) {
                println("실패: ${e.message}")
                failed++
            }

            if (index < uniqueArtists.size - 1) Thread.sleep(800)
        }

        println("🏁 장르 저장 완료 — 저장: $saved / 스킵: $skipped / 실패: $failed")
        return mapOf("saved" to saved, "skipped" to skipped, "failed" to failed, "total" to uniqueArtists.size)
    }

    // Firebase 없이 추천 알고리즘 테스트용 — users 테이블의 첫 번째 유저를 사용
    @PostMapping("/test-recommend")
    fun testRecommend(@RequestBody request: SmartRecommendationRequest): SmartRecommendationResponse {
        val user = userRepository.findAll().firstOrNull()
            ?: User(firebaseUid = "test", nickname = "test")
        return smartRecommendationService.recommend(request, user)
    }

    @PostMapping("/tracks")
    fun importTracks(
        @RequestBody tracks: List<TrackRequest>,
        @RequestHeader(name = "X-Spotify-Token", required = false) spotifyAccessToken: String? = null
    ): BulkImportResult {
        return bulkImportService.bulkImport(tracks, spotifyAccessToken)
    }

    /**
     * Spotify 좋아요 목록 기반 곡 등록
     * Spotify 정책 변경으로 자사 큐레이션 플레이리스트 접근 불가 → /me/tracks 사용
     */
    @PostMapping("/from-chart")
    fun importFromChart(
        @RequestParam(defaultValue = "50") limit: Int,
        @RequestHeader(name = "X-Spotify-Token") spotifyAccessToken: String
    ): BulkImportResult {
        println("📊 Spotify 좋아요 목록에서 곡 가져오는 중 (limit=$limit)...")

        val likedResponse = spotifyClient.fetchLikedTracks(spotifyAccessToken, limit)
            ?: throw RuntimeException("Spotify 좋아요 목록 조회 실패")

        val tracks = likedResponse.items.mapNotNull { item ->
            val track = item.track ?: return@mapNotNull null
            val title = track.name
            val artist = track.artists.firstOrNull()?.name
            if (!title.isBlank() && !artist.isNullOrBlank()) {
                TrackRequest(title = title, artist = artist)
            } else null
        }

        println("📊 좋아요 목록에서 ${tracks.size}곡 추출 완료")

        return bulkImportService.bulkImport(tracks, spotifyAccessToken)
    }

    @PostMapping("/by-artist")
    fun importByArtist(
        @RequestParam artist: String,
        @RequestParam(defaultValue = "50") limit: Int,
        @RequestHeader(name = "X-Spotify-Token") spotifyAccessToken: String
    ): BulkImportResult {
        println("🎤 Spotify에서 '$artist'의 인기곡 가져오는 중 (limit=$limit)...")

        val artistId = spotifyClient.searchArtistId(spotifyAccessToken, artist)
            ?: throw RuntimeException("Spotify에서 아티스트 '$artist'를 찾을 수 없습니다.")

        val spotifyTracks = spotifyClient.fetchArtistTopTracks(spotifyAccessToken, artistId)

        val tracks = spotifyTracks.take(limit).mapNotNull { track ->
            val title = track.name
            val artistName = track.artists.firstOrNull()?.name ?: artist
            if (!title.isBlank()) TrackRequest(title = title, artist = artistName) else null
        }

        if (tracks.isEmpty()) {
            throw RuntimeException("'$artist'의 곡을 찾을 수 없습니다.")
        }

        println("🎤 '$artist'의 ${tracks.size}곡 추출 완료")

        return bulkImportService.bulkImport(tracks, spotifyAccessToken)
    }

    /**
     * 여러 가수의 인기곡 한 번에 등록
     * POST /api/admin/bulk-import/by-artists?limitPerArtist=30
     */
    @PostMapping("/by-artists")
    fun importByMultipleArtists(
        @RequestBody artists: List<String>,
        @RequestParam(defaultValue = "30") limitPerArtist: Int,
        @RequestHeader(name = "X-Spotify-Token") spotifyAccessToken: String
    ): Map<String, Any> {
        val results = mutableMapOf<String, BulkImportResult>()
        var totalSuccess = 0
        var totalSkipped = 0
        var totalFailed = 0

        println("🚀 여러 가수 일괄 등록 시작: 총 ${artists.size}명")
        println("============================================")

        artists.forEachIndexed { index, artist ->
            println("\n[${index + 1}/${artists.size}] 🎤 처리 중: $artist")
            try {
                val spotifyTracks = spotifyClient.searchTracksByArtist(spotifyAccessToken, artist, limitPerArtist)

                if (spotifyTracks.isEmpty()) {
                    println("⚠️ '$artist' Spotify에서 곡 못 찾음")
                    return@forEachIndexed
                }

                var success = 0; var skipped = 0; var failed = 0

                spotifyTracks.forEachIndexed { i, track ->
                    val spotifyId = track.id
                    val title = track.name ?: return@forEachIndexed
                    val artistName = track.artists.firstOrNull()?.name ?: artist
                    val album = track.album?.name
                    val albumImageUrl = track.album?.images?.firstOrNull()?.url

                    println("  [${i + 1}/${spotifyTracks.size}] $title")

                    try {
                        val result = if (!spotifyId.isNullOrBlank()) {
                            musicAnalysisService.fetchAndSaveMusicBySpotifyId(spotifyId, title, artistName, album, albumImageUrl)
                        } else {
                            musicAnalysisService.fetchAndSaveMusic(title, artistName, spotifyAccessToken)
                        }
                        if (result.isNewlyAdded) {
                            success++
                            result.audioFeatures?.let { features ->
                                tagGenerationService.autoTagByFeatures(result.music.id!!, result.music.title, result.music.artist, features)
                            }
                        } else skipped++
                    } catch (e: Exception) {
                        println("  ❌ 실패: ${e.message}")
                        failed++
                    }

                    if (i < spotifyTracks.size - 1) Thread.sleep(500)
                }

                val result = BulkImportResult(spotifyTracks.size, success, skipped, failed, emptyList())
                results[artist] = result
                totalSuccess += success
                totalSkipped += skipped
                totalFailed += failed

            } catch (e: Exception) {
                println("❌ '$artist' 처리 실패: ${e.message}")
            }
        }

        println("\n============================================")
        println("🏁 전체 작업 완료")
        println("   처리된 가수: ${results.size}/${artists.size}")
        println("   ✅ 신규: $totalSuccess")
        println("   ⏭️ 스킵: $totalSkipped")
        println("   ❌ 실패: $totalFailed")
        println("============================================")

        return mapOf(
            "totalArtists" to artists.size,
            "processedArtists" to results.size,
            "totalSuccess" to totalSuccess,
            "totalSkipped" to totalSkipped,
            "totalFailed" to totalFailed,
            "details" to results
        )
    }

    /**
     * Firestore posts 컬렉션 전체를 읽어 music_tags에 USER 태그 소급 저장
     * 서버 시작 전에 이미 작성된 커뮤니티 글 처리용 — 한 번만 실행하면 됨
     */
    @PostMapping("/sync-community-tags")
    fun syncCommunityTags(
        @RequestParam(defaultValue = "500") delayMs: Long
    ): Map<String, Any> {
        val db = FirestoreClient.getFirestore()
        val posts = db.collection("posts").get().get()
        println("📝 커뮤니티 글 소급 태그 동기화 시작: 총 ${posts.size()}건")

        var success = 0
        var skipped = 0
        var failed = 0

        posts.documents.forEachIndexed { index, doc ->
            val content = doc.getString("content") ?: run { skipped++; return@forEachIndexed }
            @Suppress("UNCHECKED_CAST")
            val songData = doc.get("songData") as? Map<String, Any> ?: run { skipped++; return@forEachIndexed }
            val spotifyId = songData["spotifyId"] as? String ?: run { skipped++; return@forEachIndexed }

            try {
                tagGenerationService.generate(TagGenerationRequest(review = content, spotifyId = spotifyId))
                success++
            } catch (e: Exception) {
                println("❌ 실패 (${doc.id}): ${e.message}")
                failed++
            }

            if (index < posts.size() - 1) Thread.sleep(delayMs)
        }

        println("🏁 소급 동기화 완료 — 성공: $success, 스킵: $skipped, 실패: $failed")
        return mapOf("total" to posts.size(), "success" to success, "skipped" to skipped, "failed" to failed)
    }

    /**
     * 태그가 없는 기존 DB 곡 전체에 오디오 피처 기반 초기 태그 자동 생성
     * OpenAI API 부하 방지를 위해 곡 사이에 delayMs 대기 (기본 300ms)
     */
    @PostMapping("/auto-tag-existing")
    fun autoTagExisting(
        @RequestParam(defaultValue = "300") delayMs: Long
    ): Map<String, Any> {
        val untagged = musicRepository.findAllWithoutTags()
        println("🏷️ 태그 없는 곡 일괄 태깅 시작: 총 ${untagged.size}곡")

        var successCount = 0
        var skippedCount = 0
        var failedCount = 0

        untagged.forEachIndexed { index, music ->
            val progress = "${index + 1}/${untagged.size}"
            val features = audioFeaturesRepository.findById(music.id!!).orElse(null)

            if (features == null) {
                println("[$progress] ⚠️ 오디오 피처 없음, 스킵: ${music.title} - ${music.artist}")
                skippedCount++
                return@forEachIndexed
            }

            println("[$progress] 태깅 중: ${music.title} - ${music.artist}")
            val tags = tagGenerationService.autoTagByFeatures(music.id!!, music.title, music.artist, features)

            if (tags.isNotEmpty()) successCount++ else failedCount++

            if (index < untagged.size - 1) Thread.sleep(delayMs)
        }

        println("🏁 일괄 태깅 완료 — 성공: $successCount, 스킵: $skippedCount, 실패: $failedCount")
        return mapOf(
            "total" to untagged.size,
            "success" to successCount,
            "skipped" to skippedCount,
            "failed" to failedCount
        )
    }
}
