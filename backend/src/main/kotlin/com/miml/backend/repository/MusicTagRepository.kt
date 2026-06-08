package com.miml.backend.repository

import com.miml.backend.entity.MusicTag
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface MusicTagRepository : JpaRepository<MusicTag, Long> {
    fun findByMusicIdIn(musicIds: List<Long>): List<MusicTag>
    fun findByMusicIdInAndVoteCountGreaterThan(musicIds: List<Long>, minVoteCount: Int): List<MusicTag>
    fun countByMusicId(musicId: Long): Long
    fun existsByMusicIdAndTag(musicId: Long, tag: String): Boolean

    @Query("SELECT DISTINCT t.musicId FROM MusicTag t WHERE t.tag IN :tags AND t.voteCount > 0")
    fun findDistinctMusicIdsByTags(tags: List<String>): List<Long>
}
