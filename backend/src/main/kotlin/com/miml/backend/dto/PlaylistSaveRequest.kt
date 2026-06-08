package com.miml.backend.dto

data class PlaylistSaveRequest(
    val description: String,
    val tracks: List<PlaylistTrack>
)

data class PlaylistTrack(
    val spotifyId: String,
    val title: String,
    val artist: String,
    val albumImageUrl: String? = null
)
