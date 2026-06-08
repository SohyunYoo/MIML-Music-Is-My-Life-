package com.miml.backend.client

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono

@Component
class LastFmClient(
    @Qualifier("lastFmWebClient") private val webClient: WebClient,
    @Value("\${lastfm.api-key}") private val apiKey: String
) {
    // Last.fm artist.gettoptags 응답에서 걸러낼 비장르 태그
    private val NOISE_TAGS = setOf(
        "seen live", "favourite", "favourites", "favorites", "love", "awesome",
        "amazing", "great", "good", "beautiful", "perfect", "best", "cool",
        "male vocalists", "female vocalists", "vocalist", "singer",
        "american", "british", "swedish", "norwegian", "canadian", "australian",
        "under 2000 listeners", "all", "classic"
    )

    /**
     * 아티스트명으로 Last.fm 상위 태그(장르) 조회
     * - count 기준 정렬된 상위 태그에서 노이즈 제거 후 최대 [limit]개 반환
     * - 아티스트를 찾지 못하거나 API 오류 시 빈 리스트 반환
     */
    fun fetchTopGenres(artistName: String, limit: Int = 5): List<String> {
        return try {
            val response = webClient.get()
                .uri { builder ->
                    builder.queryParam("method", "artist.gettoptags")
                        .queryParam("artist", artistName)
                        .queryParam("api_key", apiKey)
                        .queryParam("autocorrect", "1")
                        .queryParam("format", "json")
                        .build()
                }
                .retrieve()
                .bodyToMono<LastFmTopTagsResponse>()
                .block()

            response?.topTags?.tags
                ?.filter { it.name.lowercase() !in NOISE_TAGS }
                ?.map { it.name.lowercase() }
                ?.take(limit)
                ?: emptyList()

        } catch (e: Exception) {
            println("⚠️ Last.fm 장르 조회 실패 ($artistName): ${e.message}")
            emptyList()
        }
    }
}

@JsonIgnoreProperties(ignoreUnknown = true)
data class LastFmTopTagsResponse(
    @JsonProperty("toptags") val topTags: LastFmTopTags? = null,
    @JsonProperty("error") val error: Int? = null,
    @JsonProperty("message") val message: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class LastFmTopTags(
    @JsonProperty("tag") val tags: List<LastFmTag> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class LastFmTag(
    @JsonProperty("name") val name: String,
    @JsonProperty("count") val count: Int = 0
)
