package com.miml.backend.repository

import com.miml.backend.entity.ArtistGenre
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface ArtistGenreRepository : JpaRepository<ArtistGenre, Long> {
    fun existsBySpotifyArtistId(spotifyArtistId: String): Boolean
    fun findBySpotifyArtistId(spotifyArtistId: String): List<ArtistGenre>
    fun findBySpotifyArtistIdIn(spotifyArtistIds: List<String>): List<ArtistGenre>

    @Query("SELECT DISTINCT a.artistName FROM ArtistGenre a WHERE a.genre IN :genres")
    fun findDistinctArtistNamesByGenreIn(@Param("genres") genres: List<String>): List<String>

    @Query("SELECT DISTINCT a.artistName FROM ArtistGenre a WHERE a.artistName IN :artistNames")
    fun findDistinctArtistNamesIn(@Param("artistNames") artistNames: Collection<String>): List<String>
}
