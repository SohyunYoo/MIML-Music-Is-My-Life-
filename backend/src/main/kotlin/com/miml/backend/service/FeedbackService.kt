package com.miml.backend.service

import com.miml.backend.dto.MoodFeatures
import com.miml.backend.entity.MoodFeedbackLog
import com.miml.backend.entity.SatisfactionFeedbackLog
import com.miml.backend.repository.AudioFeaturesRepository
import com.miml.backend.repository.MoodFeedbackLogRepository
import com.miml.backend.repository.SatisfactionFeedbackLogRepository
import com.miml.backend.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class FeedbackService(
    private val userRepository: UserRepository,
    private val audioFeaturesRepository: AudioFeaturesRepository,
    private val satisfactionFeedbackLogRepository: SatisfactionFeedbackLogRepository,
    private val moodFeedbackLogRepository: MoodFeedbackLogRepository
) {
    private val MOOD_CORRECTION_THRESHOLD = 3
    private val MOOD_ALPHA = 0.05

    /**
     * Satisfaction Feedback: 추천 음악이 사용자 취향과 맞는지
     * - 좋아요: 사용자 프로필을 곡의 특성 방향으로 당김
     * - 싫어요: 반대 방향으로 밀어냄 (절반 강도)
     *
     * 학습률 α = 1 / (feedbackCount + 10)
     * → 초반엔 빠르게 학습, 누적될수록 안정화
     */
    @Transactional
    fun satisfactionFeedback(userId: Long, musicId: Long, isLiked: Boolean): Map<String, Any> {
        if (satisfactionFeedbackLogRepository.existsByUserIdAndMusicId(userId, musicId)) {
            return mapOf("alreadySubmitted" to true)
        }

        val user = userRepository.findById(userId)
            .orElseThrow { RuntimeException("사용자 없음: $userId") }

        val audioFeatures = audioFeaturesRepository.findById(musicId).orElse(null)
            ?: throw RuntimeException("해당 음악의 오디오 피처 없음: $musicId")

        val alpha = 1.0 / (user.feedbackCount + 10)
        val direction = if (isLiked) 1.0 else -0.5

        val before = mapOf(
            "energy" to user.profileEnergy,
            "happiness" to user.profileHappiness,
            "danceability" to user.profileDanceability,
            "acousticness" to user.profileAcousticness,
            "tempo" to user.profileTempo
        )

        user.profileEnergy = (user.profileEnergy + alpha * direction * (audioFeatures.energy - user.profileEnergy))
            .toInt().coerceIn(0, 100)
        user.profileHappiness = (user.profileHappiness + alpha * direction * (audioFeatures.happiness - user.profileHappiness))
            .toInt().coerceIn(0, 100)
        user.profileDanceability = (user.profileDanceability + alpha * direction * (audioFeatures.danceability - user.profileDanceability))
            .toInt().coerceIn(0, 100)
        user.profileAcousticness = (user.profileAcousticness + alpha * direction * (audioFeatures.acousticness - user.profileAcousticness))
            .toInt().coerceIn(0, 100)
        user.profileTempo = (user.profileTempo + alpha * direction * (audioFeatures.tempo - user.profileTempo))
            .toInt().coerceIn(60, 200)

        user.feedbackCount++
        userRepository.save(user)
        satisfactionFeedbackLogRepository.save(SatisfactionFeedbackLog(userId, musicId, isLiked))

        println("📊 Satisfaction Feedback (userId=$userId, musicId=$musicId, liked=$isLiked)")
        println("   α=${"%.4f".format(alpha)}, feedbackCount=${user.feedbackCount}")
        println("   energy:       ${before["energy"]} → ${user.profileEnergy}")
        println("   happiness:    ${before["happiness"]} → ${user.profileHappiness}")
        println("   danceability: ${before["danceability"]} → ${user.profileDanceability}")
        println("   acousticness: ${before["acousticness"]} → ${user.profileAcousticness}")
        println("   tempo:        ${before["tempo"]} → ${user.profileTempo}")

        return mapOf(
            "alpha" to alpha,
            "feedbackCount" to user.feedbackCount,
            "profile" to mapOf(
                "energy" to user.profileEnergy,
                "happiness" to user.profileHappiness,
                "danceability" to user.profileDanceability,
                "acousticness" to user.profileAcousticness,
                "tempo" to user.profileTempo
            )
        )
    }

    /**
     * Mood Feedback: SoundNet 오분석 보정
     * - 긍정: 즉시 반영 — 각 곡의 오디오 피처를 무드 방향으로 강화
     * - 부정: 로그 누적 후 임계치(3명) 도달 시에만 보정 적용
     *         여러 사용자의 무드 피처를 평균내어 반영 → 개인 편향 완화
     */
    @Transactional
    fun moodFeedback(userId: Long, musicIds: List<Long>, isPositive: Boolean, moodFeatures: MoodFeatures): Map<String, Any> {
        val featuresList = audioFeaturesRepository.findAllById(musicIds)
        if (featuresList.isEmpty()) throw RuntimeException("오디오 피처를 찾을 수 없음: $musicIds")

        if (isPositive) {
            featuresList.forEach { features ->
                features.energy       = (features.energy       + MOOD_ALPHA * (moodFeatures.energy       - features.energy      )).toInt().coerceIn(0, 100)
                features.happiness    = (features.happiness    + MOOD_ALPHA * (moodFeatures.happiness    - features.happiness   )).toInt().coerceIn(0, 100)
                features.danceability = (features.danceability + MOOD_ALPHA * (moodFeatures.danceability - features.danceability)).toInt().coerceIn(0, 100)
                features.acousticness = (features.acousticness + MOOD_ALPHA * (moodFeatures.acousticness - features.acousticness)).toInt().coerceIn(0, 100)
                features.tempo        = (features.tempo        + MOOD_ALPHA * (moodFeatures.tempo        - features.tempo       )).toInt().coerceIn(60, 200)
            }
            audioFeaturesRepository.saveAll(featuresList)

            println("🎭 Mood Feedback (userId=$userId, songs=${featuresList.size}곡, positive=true → 즉시 강화)")
            return mapOf("correctedCount" to featuresList.size, "direction" to "reinforced")
        }

        // 부정 피드백: 로그 저장 → 임계치 확인 → 필요 시 보정
        val moodContext = "${moodFeatures.energy}_${moodFeatures.happiness}_${moodFeatures.danceability}_${moodFeatures.acousticness}_${moodFeatures.tempo}"
        val correctedMusicIds = mutableListOf<Long>()

        featuresList.forEach { features ->
            val musicId = features.musicId

            if (moodFeedbackLogRepository.existsByUserIdAndMusicIdAndMoodContext(userId, musicId, moodContext)) {
                println("   중복 피드백 무시 (userId=$userId, musicId=$musicId, context=$moodContext)")
                return@forEach
            }

            moodFeedbackLogRepository.save(
                MoodFeedbackLog(
                    userId           = userId,
                    musicId          = musicId,
                    isPositive       = false,
                    moodContext      = moodContext,
                    moodEnergy       = moodFeatures.energy,
                    moodHappiness    = moodFeatures.happiness,
                    moodDanceability = moodFeatures.danceability,
                    moodAcousticness = moodFeatures.acousticness,
                    moodTempo        = moodFeatures.tempo
                )
            )

            val negativeCount = moodFeedbackLogRepository.countByMusicIdAndIsPositiveFalseAndAppliedFalse(musicId)
            println("   부정 피드백 누적 (musicId=$musicId): $negativeCount / $MOOD_CORRECTION_THRESHOLD")

            if (negativeCount >= MOOD_CORRECTION_THRESHOLD) {
                val pendingLogs = moodFeedbackLogRepository.findByMusicIdAndIsPositiveFalseAndAppliedFalse(musicId)

                val avgEnergy       = pendingLogs.map { it.moodEnergy }.average().toInt()
                val avgHappiness    = pendingLogs.map { it.moodHappiness }.average().toInt()
                val avgDanceability = pendingLogs.map { it.moodDanceability }.average().toInt()
                val avgAcousticness = pendingLogs.map { it.moodAcousticness }.average().toInt()
                val avgTempo        = pendingLogs.map { it.moodTempo }.average().toInt()

                // 평균 무드 피처 반대 방향으로 오디오 피처 보정
                features.energy       = (features.energy       - MOOD_ALPHA * (avgEnergy       - features.energy      )).toInt().coerceIn(0, 100)
                features.happiness    = (features.happiness    - MOOD_ALPHA * (avgHappiness    - features.happiness   )).toInt().coerceIn(0, 100)
                features.danceability = (features.danceability - MOOD_ALPHA * (avgDanceability - features.danceability)).toInt().coerceIn(0, 100)
                features.acousticness = (features.acousticness - MOOD_ALPHA * (avgAcousticness - features.acousticness)).toInt().coerceIn(0, 100)
                features.tempo        = (features.tempo        - MOOD_ALPHA * (avgTempo        - features.tempo       )).toInt().coerceIn(60, 200)

                audioFeaturesRepository.save(features)
                pendingLogs.forEach { it.applied = true }
                moodFeedbackLogRepository.saveAll(pendingLogs)
                correctedMusicIds.add(musicId)

                println("🔧 Mood Correction 적용 (musicId=$musicId, 누적=${pendingLogs.size}건)")
                println("   평균 무드 → energy=$avgEnergy, happiness=$avgHappiness, danceability=$avgDanceability, acousticness=$avgAcousticness, tempo=$avgTempo")
                println("   보정 후   → energy=${features.energy}, happiness=${features.happiness}, danceability=${features.danceability}, acousticness=${features.acousticness}, tempo=${features.tempo}")
            }
        }

        println("🎭 Mood Feedback (userId=$userId, songs=${featuresList.size}곡, corrected=${correctedMusicIds.size}곡)")
        return mapOf(
            "loggedCount"    to featuresList.size,
            "correctedCount" to correctedMusicIds.size,
            "direction"      to "pending_correction"
        )
    }
}
