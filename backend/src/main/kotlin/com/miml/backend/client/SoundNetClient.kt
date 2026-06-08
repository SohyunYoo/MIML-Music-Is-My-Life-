package com.miml.backend.client

import com.miml.backend.dto.SoundNetResponse
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono

@Component
class SoundNetClient(
    private val soundNetWebClient: WebClient
) {

    /**
     * 곡명/가수로 검색 (기존)
     */
    fun fetchTrackAnalysis(song: String, artist: String): SoundNetResponse? {
        return try {
            soundNetWebClient.get()
                .uri { uriBuilder ->
                    uriBuilder
                        .path("/pktx/analysis")
                        .queryParam("song", song)
                        .queryParam("artist", artist)
                        .build()
                }
                .retrieve()
                .bodyToMono<SoundNetResponse>()
                .block()
        } catch (e: Exception) {
            println("⚠️ SoundNet API 호출 실패 (song): ${e.message}")
            null
        }
    }

    /**
     * ⭐ Spotify ID로 정확한 음향 분석 조회 (신규)
     * GET /pktx/analysis/{spotifyId}
     */
    fun fetchTrackAnalysisBySpotifyId(spotifyId: String): SoundNetResponse? {
        return try {
            soundNetWebClient.get()
                .uri("/pktx/analysis/$spotifyId")
                .retrieve()
                .bodyToMono<SoundNetResponse>()
                .block()
        } catch (e: Exception) {
            println("⚠️ SoundNet API 호출 실패 (spotify_id=$spotifyId): ${e.message}")
            null
        }
    }
}