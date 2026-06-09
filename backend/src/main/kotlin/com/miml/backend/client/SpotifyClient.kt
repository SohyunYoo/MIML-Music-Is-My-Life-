package com.miml.backend.client

import com.miml.backend.dto.SpotifyArtistItem
import com.miml.backend.dto.SpotifyArtistSearchResponse
import com.miml.backend.dto.SpotifyArtistTopTracksResponse
import com.miml.backend.dto.SpotifyLikedTracksResponse
import com.miml.backend.dto.SpotifySearchResponse
import com.miml.backend.dto.SpotifySearchTrackItem
import com.miml.backend.dto.SpotifyTrack
import com.miml.backend.dto.SpotifyUserProfileResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.reactive.function.BodyInserters
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import org.springframework.web.reactive.function.client.bodyToMono
import java.time.Instant
import java.util.Base64

@Component
class SpotifyClient(
    private val spotifyWebClient: WebClient,
    @Value("\${spotify.client-id}") private val clientId: String,
    @Value("\${spotify.client-secret}") private val clientSecret: String
) {
    // Client Credentials 토큰 캐시 (만료 1분 전에 갱신)
    private var cachedAppToken: String? = null
    private var tokenExpiresAt: Instant = Instant.EPOCH

    private val tokenWebClient = WebClient.builder()
        .baseUrl("https://accounts.spotify.com")
        .build()

    /**
     * Spotify Client Credentials 방식 앱 토큰 발급 (자동 캐싱)
     * 유저 로그인 없이 공개 트랙 정보 조회에 사용
     */
    fun getAppToken(): String {
        if (cachedAppToken != null && Instant.now().isBefore(tokenExpiresAt)) {
            return cachedAppToken!!
        }

        val credentials = Base64.getEncoder().encodeToString("$clientId:$clientSecret".toByteArray())
        val body = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "client_credentials")
        }

        val response = tokenWebClient.post()
            .uri("/api/token")
            .header(HttpHeaders.AUTHORIZATION, "Basic $credentials")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(BodyInserters.fromFormData(body))
            .retrieve()
            .bodyToMono<Map<String, Any>>()
            .block() ?: throw RuntimeException("Spotify 앱 토큰 발급 실패")

        cachedAppToken = response["access_token"] as String
        val expiresIn = (response["expires_in"] as Int).toLong()
        tokenExpiresAt = Instant.now().plusSeconds(expiresIn - 60)

        println("🔑 Spotify 앱 토큰 발급 완료 (${expiresIn}초 유효)")
        return cachedAppToken!!
    }

    /**
     * spotifyId만으로 트랙 정보 조회 (앱 토큰 자동 사용)
     */
    fun fetchTrackByIdWithAppToken(spotifyId: String): SpotifySearchTrackItem? {
        return try {
            val token = getAppToken()
            fetchTrackById(token, spotifyId)
        } catch (e: Exception) {
            println("⚠️ 앱 토큰으로 트랙 조회 실패 ($spotifyId): ${e.message}")
            null
        }
    }

    fun fetchUserProfile(accessToken: String): SpotifyUserProfileResponse? {
        return try {
            spotifyWebClient.get()
                .uri("/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifyUserProfileResponse>()
                .block()
        } catch (e: Exception) {
            println("⚠️ Spotify 사용자 프로필 조회 실패: ${e.message}")
            null
        }
    }

    fun fetchLikedTracks(
        accessToken: String,
        limit: Int = 50,
        offset: Int = 0
    ): SpotifyLikedTracksResponse? {
        return try {
            spotifyWebClient.get()
                .uri { uriBuilder ->
                    uriBuilder
                        .path("/me/tracks")
                        .queryParam("limit", limit)
                        .queryParam("offset", offset)
                        .build()
                }
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifyLikedTracksResponse>()
                .block()
        } catch (e: Exception) {
            println("⚠️ Spotify 좋아요 곡 조회 실패: ${e.message}")
            null
        }
    }

    fun searchTrack(accessToken: String, title: String, artist: String): String? {
        return searchTrackWithDetails(accessToken, title, artist)?.id
    }

    fun searchTrackWithDetails(accessToken: String, title: String, artist: String): SpotifySearchTrackItem? {
        fun doSearch(): SpotifySearchTrackItem? {
            val response = spotifyWebClient.get()
                .uri { uriBuilder ->
                    uriBuilder
                        .path("/search")
                        .queryParam("q", "track:$title artist:$artist")
                        .queryParam("type", "track")
                        .queryParam("limit", 1)
                        .build()
                }
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifySearchResponse>()
                .block()
            return response?.tracks?.items?.firstOrNull()
        }

        var attempt = 0
        while (attempt < 5) {
            try {
                return doSearch()
            } catch (e: WebClientResponseException) {
                if (e.statusCode.value() == 429) {
                    val retryAfter = e.headers.getFirst("Retry-After")?.toLongOrNull() ?: 30L
                    val waitSeconds = minOf(retryAfter + 5, 60L)
                    println("⚠️ 429 — ${waitSeconds}초 대기 후 재시도 (attempt ${attempt + 1}/5)...")
                    Thread.sleep(waitSeconds * 1_000)
                    attempt++
                } else {
                    println("⚠️ Spotify 검색 실패 ($title - $artist): ${e.statusCode}")
                    return null
                }
            } catch (e: Exception) {
                println("⚠️ Spotify 검색 실패 ($title - $artist): ${e.message}")
                return null
            }
        }
        println("⚠️ 최대 재시도 초과 ($title - $artist)")
        return null
    }

    fun fetchTrackById(accessToken: String, spotifyId: String): SpotifySearchTrackItem? {
        return try {
            spotifyWebClient.get()
                .uri("/tracks/$spotifyId")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifySearchTrackItem>()
                .block()
        } catch (e: Exception) {
            println("⚠️ Spotify 트랙 조회 실패 ($spotifyId): ${e.message}")
            null
        }
    }

    fun searchArtistId(accessToken: String, artistName: String): String? {
        return try {
            val response = spotifyWebClient.get()
                .uri { uriBuilder ->
                    uriBuilder
                        .path("/search")
                        .queryParam("q", artistName)
                        .queryParam("type", "artist")
                        .queryParam("limit", 1)
                        .build()
                }
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifyArtistSearchResponse>()
                .block()
            response?.artists?.items?.firstOrNull()?.id
        } catch (e: Exception) {
            println("⚠️ Spotify 아티스트 검색 실패 ($artistName): ${e.message}")
            null
        }
    }

    fun fetchArtistTopTracks(accessToken: String, artistId: String, market: String = "KR"): List<SpotifyTrack> {
        return try {
            val response = spotifyWebClient.get()
                .uri { uriBuilder ->
                    uriBuilder
                        .path("/artists/$artistId/top-tracks")
                        .queryParam("market", market)
                        .build()
                }
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifyArtistTopTracksResponse>()
                .block()
            response?.tracks ?: emptyList()
        } catch (e: Exception) {
            println("⚠️ Spotify 아티스트 인기곡 조회 실패 ($artistId): ${e.message}")
            emptyList()
        }
    }

    fun fetchArtistById(accessToken: String, artistId: String): SpotifyArtistItem? {
        return try {
            spotifyWebClient.get()
                .uri("/artists/$artistId")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifyArtistItem>()
                .block()
        } catch (e: Exception) {
            println("⚠️ Spotify 아티스트 조회 실패 ($artistId): ${e.message}")
            null
        }
    }

    fun searchTracksByArtist(accessToken: String, artistName: String, limit: Int = 10): List<SpotifySearchTrackItem> {
        return try {
            val encodedQuery = java.net.URLEncoder.encode("artist:$artistName", "UTF-8")
            val response = spotifyWebClient.get()
                .uri("/search?q=$encodedQuery&type=track&limit=$limit&market=KR")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $accessToken")
                .retrieve()
                .bodyToMono<SpotifySearchResponse>()
                .block()
            response?.tracks?.items ?: emptyList()
        } catch (e: Exception) {
            println("⚠️ Spotify 트랙 검색 실패 ($artistName): ${e.message}")
            emptyList()
        }
    }

}
