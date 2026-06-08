package com.miml.backend.service

import com.miml.backend.entity.Music
import org.springframework.stereotype.Service
import java.util.concurrent.atomic.AtomicInteger

@Service
class BulkImportService(
    private val musicAnalysisService: MusicAnalysisService,
    private val tagGenerationService: TagGenerationService
) {

    /**
     * 곡 리스트를 받아서 일괄 등록
     * - 1곡 실패해도 다음 곡 진행
     * - 진행 상황 콘솔 출력
     * - API 부하 방지 위해 호출 사이 딜레이
     */
    fun bulkImport(tracks: List<TrackRequest>, spotifyAccessToken: String? = null, delayMs: Long = 500): BulkImportResult {
        println("🚀 일괄 등록 시작: 총 ${tracks.size}곡")
        println("============================================")

        val successCount = AtomicInteger(0)
        val skippedCount = AtomicInteger(0)
        val failedCount = AtomicInteger(0)
        val failedTracks = mutableListOf<FailedTrack>()

        tracks.forEachIndexed { index, track ->
            val progress = "${index + 1}/${tracks.size}"
            println("[$progress] 처리 중: ${track.title} - ${track.artist}")

            try {
                val result = musicAnalysisService.fetchAndSaveMusic(track.title, track.artist, spotifyAccessToken)
                if (result.isNewlyAdded) {
                    successCount.incrementAndGet()
                    println("  ✅ 신규 등록 (id: ${result.music.id})")
                    result.audioFeatures?.let { features ->
                        tagGenerationService.autoTagByFeatures(result.music.id!!, result.music.title, result.music.artist, features)
                    }
                } else {
                    skippedCount.incrementAndGet()
                    println("  ⏭️ 이미 존재함 (id: ${result.music.id})")
                }
            } catch (e: Exception) {
                failedCount.incrementAndGet()
                failedTracks.add(FailedTrack(track, e.message ?: "Unknown error"))
                println("  ❌ 실패: ${e.message}")
            }

            // API 부하 방지 대기
            if (index < tracks.size - 1) {
                Thread.sleep(delayMs)
            }
        }

        println("============================================")
        println("🏁 일괄 등록 완료")
        println("   ✅ 성공: ${successCount.get()}")
        println("   ⏭️ 스킵 (이미 존재): ${skippedCount.get()}")
        println("   ❌ 실패: ${failedCount.get()}")
        println("============================================")

        return BulkImportResult(
            total = tracks.size,
            success = successCount.get(),
            skipped = skippedCount.get(),
            failed = failedCount.get(),
            failedTracks = failedTracks
        )
    }
}

data class TrackRequest(
    val title: String,
    val artist: String
)

data class FailedTrack(
    val track: TrackRequest,
    val error: String
)

data class BulkImportResult(
    val total: Int,
    val success: Int,
    val skipped: Int,
    val failed: Int,
    val failedTracks: List<FailedTrack>
)