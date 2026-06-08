package com.miml.backend.repository

import com.miml.backend.entity.AudioFeatures
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface AudioFeaturesRepository : JpaRepository<AudioFeatures, Long> {

    @Query("""
        SELECT a FROM AudioFeatures a
        WHERE a.energy       BETWEEN :energyMin       AND :energyMax
          AND a.happiness    BETWEEN :happinessMin    AND :happinessMax
          AND a.danceability BETWEEN :danceabilityMin AND :danceabilityMax
          AND a.acousticness BETWEEN :acousticnessMin AND :acousticnessMax
          AND a.tempo        BETWEEN :tempoMin        AND :tempoMax
    """)
    fun findByFeatureRange(
        @Param("energyMin")       energyMin: Int,
        @Param("energyMax")       energyMax: Int,
        @Param("happinessMin")    happinessMin: Int,
        @Param("happinessMax")    happinessMax: Int,
        @Param("danceabilityMin") danceabilityMin: Int,
        @Param("danceabilityMax") danceabilityMax: Int,
        @Param("acousticnessMin") acousticnessMin: Int,
        @Param("acousticnessMax") acousticnessMax: Int,
        @Param("tempoMin")        tempoMin: Int,
        @Param("tempoMax")        tempoMax: Int,
    ): List<AudioFeatures>
}