package com.miml.backend.repository

import com.miml.backend.entity.Music
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface MusicRepository : JpaRepository<Music, Long> {

    fun findByTitleAndArtist(title: String, artist: String): Music?

    fun findBySpotifyId(spotifyId: String): Music?

    fun findAllBySpotifyIdIsNull(): List<Music>
    fun findAllBySpotifyIdIsNotNull(): List<Music>
    fun findAllByAlbumImageUrlIsNullAndSpotifyIdIsNotNull(): List<Music>

    @Query("SELECT m FROM Music m WHERE NOT EXISTS (SELECT 1 FROM MusicTag t WHERE t.musicId = m.id)")
    fun findAllWithoutTags(): List<Music>
}