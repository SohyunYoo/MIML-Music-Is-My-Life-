package com.miml.backend.dto

import com.miml.backend.entity.Music

data class RecommendedTrack(
    val musicId: Long,
    val title: String,
    val artist: String,
    val album: String? = null,
    val albumImageUrl: String? = null,
    val spotifyId: String? = null,
    val score: Double
) {
    companion object {
        fun fromMusic(music: Music, score: Double): RecommendedTrack {
            return RecommendedTrack(
                musicId = music.id!!,
                title = music.title,
                artist = music.artist,
                album = music.album,
                albumImageUrl = music.albumImageUrl,
                spotifyId = music.spotifyId,
                score = score
            )
        }
    }
}