package com.miml.backend.service

import com.google.firebase.cloud.FirestoreClient
import com.miml.backend.client.OpenAiClient
import com.miml.backend.dto.PlaylistSaveRequest
import com.miml.backend.dto.PlaylistSaveResponse
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class PlaylistService(
    private val openAiClient: OpenAiClient
) {
    private val systemPrompt = """
        You are a playlist naming assistant. Given a Korean description of a music mood or situation,
        generate a short, poetic Korean playlist title (10 characters or fewer).
        - Capture the mood/atmosphere, not the literal request
        - Do NOT use quotes or special characters
        - Return ONLY a JSON object: {"title": "제목"}

        Examples:
        - "새벽에 혼자 드라이브하면서 듣고 싶어" → {"title": "새벽 드라이브"}
        - "비 오는 날 카페에서 공부할 때" → {"title": "빗소리 집중"}
        - "운동하면서 신나게 달리고 싶어" → {"title": "한계를 넘어서"}
        - "이별하고 혼자 울고 싶을 때" → {"title": "혼자만의 밤"}
    """.trimIndent()

    fun save(userId: String, request: PlaylistSaveRequest): PlaylistSaveResponse {
        val title = generateTitle(request.description)
        println("📝 플레이리스트 제목 생성: \"${request.description}\" → \"$title\"")

        val tracks = request.tracks.map { track ->
            mapOf(
                "spotifyId" to track.spotifyId,
                "title" to track.title,
                "artist" to track.artist,
                "albumImageUrl" to (track.albumImageUrl ?: "")
            )
        }

        val playlistData = mapOf(
            "userId" to userId,
            "title" to title,
            "description" to request.description,
            "tracks" to tracks,
            "createdAt" to Instant.now().toEpochMilli()
        )

        val firestore = FirestoreClient.getFirestore()
        val docRef = firestore.collection("playlists").add(playlistData).get()

        println("   Firestore 저장 완료: playlistId=${docRef.id}")
        return PlaylistSaveResponse(playlistId = docRef.id, title = title)
    }

    private fun generateTitle(description: String): String {
        val result = openAiClient.chatJson(systemPrompt, description)
        return result.path("title").asText().ifBlank { description.take(10) }
    }
}
