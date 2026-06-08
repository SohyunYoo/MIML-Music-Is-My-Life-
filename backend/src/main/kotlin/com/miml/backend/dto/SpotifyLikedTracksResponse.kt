package com.miml.backend.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

/**
 * GET /v1/me/tracks 응답 (좋아요 누른 곡)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyLikedTracksResponse(
    @JsonProperty("items")
    val items: List<SpotifySavedTrackItem> = emptyList(),

    @JsonProperty("total")
    val total: Int = 0,

    @JsonProperty("next")
    val next: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifySavedTrackItem(
    @JsonProperty("track")
    val track: SpotifyTrack? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyTrack(
    @JsonProperty("id")
    val id: String? = null,

    @JsonProperty("name")
    val name: String,

    @JsonProperty("artists")
    val artists: List<SpotifyArtist> = emptyList(),

    @JsonProperty("album")
    val album: SpotifyAlbum? = null,

    @JsonProperty("preview_url")
    val previewUrl: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyArtist(
    @JsonProperty("id")
    val id: String? = null,

    @JsonProperty("name")
    val name: String
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyAlbum(
    @JsonProperty("id")
    val id: String? = null,

    @JsonProperty("name")
    val name: String? = null,

    @JsonProperty("images")
    val images: List<SpotifyImage> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyImage(
    @JsonProperty("url")
    val url: String,

    @JsonProperty("height")
    val height: Int? = null,

    @JsonProperty("width")
    val width: Int? = null
)
