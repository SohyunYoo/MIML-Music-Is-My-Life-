package com.miml.backend.service

import com.miml.backend.client.LastFmClient
import com.miml.backend.entity.ArtistGenre
import com.miml.backend.repository.ArtistGenreRepository
import org.springframework.stereotype.Service

@Service
class ArtistGenreService(
    private val lastFmClient: LastFmClient,
    private val artistGenreRepository: ArtistGenreRepository
) {
    /**
     * 아티스트 장르를 Last.fm에서 가져와 저장.
     * 이미 저장된 아티스트(spotifyArtistId 기준)는 API 호출 없이 스킵.
     */
    fun saveGenresIfAbsent(spotifyArtistId: String, artistName: String) {
        if (artistGenreRepository.existsBySpotifyArtistId(spotifyArtistId)) return

        val genres = lastFmClient.fetchTopGenres(artistName)
        if (genres.isEmpty()) {
            println("   ℹ️ 장르 없음 또는 미분류: $artistName ($spotifyArtistId)")
            return
        }

        val entities = genres.map { genre ->
            ArtistGenre(spotifyArtistId = spotifyArtistId, artistName = artistName, genre = genre)
        }
        artistGenreRepository.saveAll(entities)
        println("   🎸 장르 저장 ($artistName): $genres")
    }

    fun getGenres(spotifyArtistId: String): List<String> =
        artistGenreRepository.findBySpotifyArtistId(spotifyArtistId).map { it.genre }

    fun getGenresByArtistIds(spotifyArtistIds: List<String>): Map<String, List<String>> =
        artistGenreRepository.findBySpotifyArtistIdIn(spotifyArtistIds)
            .groupBy({ it.spotifyArtistId }, { it.genre })
}
