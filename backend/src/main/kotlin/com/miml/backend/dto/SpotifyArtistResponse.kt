package com.miml.backend.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyArtistSearchResponse(
    @JsonProperty("artists")
    val artists: SpotifyArtistContainer? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyArtistContainer(
    @JsonProperty("items")
    val items: List<SpotifyArtistItem> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyArtistItem(
    @JsonProperty("id")
    val id: String? = null,

    @JsonProperty("name")
    val name: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyArtistTopTracksResponse(
    @JsonProperty("tracks")
    val tracks: List<SpotifyTrack> = emptyList()
)
