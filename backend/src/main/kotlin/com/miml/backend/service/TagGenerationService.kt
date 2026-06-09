package com.miml.backend.service

import com.miml.backend.client.OpenAiClient
import com.miml.backend.client.SpotifyClient
import com.miml.backend.dto.TagGenerationRequest
import com.miml.backend.dto.TagGenerationResponse
import com.miml.backend.entity.MusicTag
import com.miml.backend.repository.MusicRepository
import com.miml.backend.repository.MusicTagRepository
import org.springframework.stereotype.Service

@Service
class TagGenerationService(
    private val openAiClient: OpenAiClient,
    private val embeddingService: EmbeddingService,
    private val musicRepository: MusicRepository,
    private val musicTagRepository: MusicTagRepository,
    private val musicAnalysisService: MusicAnalysisService,
    private val spotifyClient: SpotifyClient
) {
    private val MAX_TAGS_PER_MUSIC = 30

    // USER 태그와 코사인 유사도가 이 값 미만이면 분위기 충돌로 판단
    private val CONFLICT_THRESHOLD = 0.3

    private val systemPrompt = """
        You are a music mood tagging assistant. Given a Korean music review, select the most fitting tags.

        Rules:
        - Choose ONLY from the allowed tag list below — do NOT create new tags
        - Select 2–4 tags that best match the mood/atmosphere of the review
        - No duplicates
        - Return ONLY a JSON object: {"tags": ["#tag1", "#tag2", ...]}

        Allowed tags:
        ${TagVocabulary.asString}

        Examples:
        - "바다에서 시원하게 듣기 좋음" → {"tags": ["#청량한", "#여름", "#활기찬"]}
        - "노래 잔잔하니 새벽감성있고 좋네요" → {"tags": ["#잔잔한", "#새벽감성", "#감성적인"]}
        - "너무 슬프고 이별할때 듣기 좋은 노래" → {"tags": ["#슬픈", "#이별노래", "#아련한"]}
    """.trimIndent()

    private val autoTagSystemPrompt = """
        You are a music mood tagging assistant. Given a song's title, artist, and audio feature analysis,
        select the most fitting Korean mood/atmosphere tags.

        Audio feature scale:
        - Energy: 0=very calm, 100=very energetic
        - Happiness: 0=very sad/dark, 100=very happy/bright
        - Danceability: 0=not danceable, 100=very danceable
        - Acousticness: 0=fully electronic, 100=fully acoustic
        - Tempo: BPM

        Rules:
        - Choose ONLY from the allowed tag list below — do NOT create new tags
        - Select 2–4 tags that best match the mood/atmosphere
        - No duplicates
        - Return ONLY a JSON object: {"tags": ["#tag1", "#tag2", ...]}

        Allowed tags:
        ${TagVocabulary.asString}
    """.trimIndent()

    fun generate(request: TagGenerationRequest): TagGenerationResponse {
        println("🏷️ 태그 자동 생성: \"${request.review}\"")

        val result = openAiClient.chatJson(systemPrompt, request.review)
        val tags = result.path("tags").map { it.asText() }.filter { it in TagVocabulary.allowedTags }

        println("   생성된 태그: $tags")

        var music = musicRepository.findBySpotifyId(request.spotifyId)

        // DB에 없으면 Spotify 앱 토큰으로 곡 정보 조회 후 신규 저장
        if (music == null) {
            println("   🆕 DB에 없는 곡 — Spotify에서 곡 정보 조회 (spotifyId=${request.spotifyId})")
            try {
                val track = spotifyClient.fetchTrackByIdWithAppToken(request.spotifyId)
                if (track != null) {
                    val title = track.name ?: throw RuntimeException("트랙 이름 없음")
                    val artist = track.artists.firstOrNull()?.name ?: throw RuntimeException("아티스트 없음")
                    val album = track.album?.name
                    val albumImageUrl = track.album?.images?.firstOrNull()?.url

                    val result = musicAnalysisService.fetchAndSaveMusicBySpotifyId(
                        spotifyId = request.spotifyId,
                        title = title,
                        artist = artist,
                        album = album,
                        albumImageUrl = albumImageUrl
                    )
                    music = result.music

                    // AudioFeatures 기반 GPT 자동 태그 생성
                    if (result.audioFeatures != null) {
                        autoTagByFeatures(music.id!!, title, artist, result.audioFeatures)
                    }
                } else {
                    println("   ⚠️ Spotify에서 트랙 정보를 가져오지 못함 — 태그만 반환")
                }
            } catch (e: Exception) {
                println("   ⚠️ 신규 곡 저장 실패 (${request.spotifyId}): ${e.message} — 태그만 반환")
            }
        }

        if (music != null) {
            val currentCount = musicTagRepository.countByMusicId(music.id!!)
            val remaining = MAX_TAGS_PER_MUSIC - currentCount

            if (remaining <= 0) {
                println("   ⚠️ 태그 한도 초과 (${currentCount}/${MAX_TAGS_PER_MUSIC}), 저장 생략")
            } else {
                val newTags = tags
                    .filter { tag -> !musicTagRepository.existsByMusicIdAndTag(music.id!!, tag) }
                    .take(remaining.toInt())
                    .map { tag -> MusicTag(musicId = music.id!!, tag = tag, source = "USER") }

                if (newTags.isNotEmpty()) {
                    musicTagRepository.saveAll(newTags)
                    println("   DB 저장 완료: ${newTags.size}개 신규 태그 (${currentCount + newTags.size}/${MAX_TAGS_PER_MUSIC})")

                    // 신규 USER 태그와 분위기가 충돌하는 GPT 태그 자동 감지
                    detectAndResolveConflicts(music.id!!, newTags.map { it.tag })
                }
            }
        }

        return TagGenerationResponse(tags = tags)
    }

    /**
     * 신규 USER 태그와 기존 GPT 태그 사이의 분위기 충돌 자동 감지
     * 코사인 유사도 < CONFLICT_THRESHOLD → 충돌로 판단 → GPT 태그 voteCount 감소
     * USER 태그끼리는 감지 안 함 (사람마다 다르게 느낄 수 있음)
     */
    private fun detectAndResolveConflicts(musicId: Long, newTagNames: List<String>) {
        val gptTags = musicTagRepository.findByMusicIdIn(listOf(musicId))
            .filter { it.source == "GPT" && it.tag !in newTagNames }

        if (gptTags.isEmpty()) return

        val newEmbeddings = newTagNames.map { embeddingService.embed(it) }

        val conflicting = gptTags.filter { gptTag ->
            val gptEmbedding = embeddingService.embed(gptTag.tag)
            val maxSimilarity = newEmbeddings.maxOf { embeddingService.cosineSimilarity(it, gptEmbedding) }
            maxSimilarity < CONFLICT_THRESHOLD
        }

        if (conflicting.isNotEmpty()) {
            conflicting.forEach { it.voteCount-- }
            musicTagRepository.saveAll(conflicting)
            println("   ⚡ 충돌 감지 → ${conflicting.map { "${it.tag}(voteCount=${it.voteCount})" }}")
        }
    }

    /**
     * 오디오 피처 기반 자동 태깅 (임포트 시점 초기 태그 생성용)
     * 실패해도 예외를 던지지 않고 빈 리스트 반환 — 임포트 흐름을 막지 않기 위함
     */
    fun autoTagByFeatures(musicId: Long, title: String, artist: String, audioFeatures: com.miml.backend.entity.AudioFeatures): List<String> {
        return try {
            val userMessage = """
                Song: "$title" by $artist
                Energy: ${audioFeatures.energy}/100
                Happiness: ${audioFeatures.happiness}/100
                Danceability: ${audioFeatures.danceability}/100
                Acousticness: ${audioFeatures.acousticness}/100
                Tempo: ${audioFeatures.tempo} BPM
            """.trimIndent()

            val result = openAiClient.chatJson(autoTagSystemPrompt, userMessage)
            val tags = result.path("tags").map { it.asText() }.filter { it in TagVocabulary.allowedTags }

            if (tags.isNotEmpty()) {
                val newTags = tags
                    .filter { !musicTagRepository.existsByMusicIdAndTag(musicId, it) }
                    .map { MusicTag(musicId = musicId, tag = it, source = "GPT") }
                if (newTags.isNotEmpty()) musicTagRepository.saveAll(newTags)
            }

            println("🏷️ 자동 태깅 완료 (musicId=$musicId): $tags")
            tags
        } catch (e: Exception) {
            println("⚠️ 자동 태깅 실패 (musicId=$musicId): ${e.message}")
            emptyList()
        }
    }
}
