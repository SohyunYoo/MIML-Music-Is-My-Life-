package com.miml.backend.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifySearchResponse(
    @JsonProperty("tracks")
    val tracks: SpotifySearchTracks? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifySearchTracks(
    @JsonProperty("items")
    val items: List<SpotifySearchTrackItem> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifySearchTrackItem(
    @JsonProperty("id")
    val id: String? = null,

    @JsonProperty("name")
    val name: String? = null,

    @JsonProperty("artists")
    val artists: List<SpotifyArtist> = emptyList(),

    @JsonProperty("album")
    val album: SpotifyAlbum? = null,

    @JsonProperty("preview_url")
    val previewUrl: String? = null
)
