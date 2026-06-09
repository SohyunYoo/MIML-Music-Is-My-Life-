package com.miml.backend.service

import com.miml.backend.client.OpenAiClient
import com.miml.backend.dto.MoodFeatures
import com.miml.backend.dto.RecommendedTrack
import com.miml.backend.dto.SmartRecommendationRequest
import com.miml.backend.dto.SmartRecommendationResponse
import com.miml.backend.entity.AudioFeatures
import com.miml.backend.entity.Music
import com.miml.backend.entity.MusicTag
import com.miml.backend.repository.ArtistGenreRepository
import com.miml.backend.repository.AudioFeaturesRepository
import com.miml.backend.repository.MusicRepository
import com.miml.backend.repository.MusicTagRepository
import org.springframework.stereotype.Service
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sqrt
import kotlin.random.Random

@Service
class SmartRecommendationService(
    private val openAiClient: OpenAiClient,
    private val embeddingService: EmbeddingService,
    private val audioFeaturesRepository: AudioFeaturesRepository,
    private val musicRepository: MusicRepository,
    private val musicTagRepository: MusicTagRepository,
    private val artistGenreRepository: ArtistGenreRepository
) {
    private val TAG_WEIGHT = 0.85
    private val POPULARITY_WEIGHT = 0.15
    private val AUDIO_WEIGHT_NO_TAGS = 0.85
    private val POPULARITY_WEIGHT_NO_TAGS = 0.15
    private val MAX_AUDIO_DISTANCE = 80.0
    private val MIN_AUDIO_SCORE = 0.45
    private val AUDIO_POOL_FACTOR = 6       // 후보 풀 확대 → 다양한 아티스트 포함 가능성 증가
    private val MAX_PER_ARTIST = 1          // 아티스트당 최대 1곡 (2 → 1)
    private val RANGE_MARGIN = 35
    private val TAG_POOL_LIMIT = 50
    private val TAG_EXPAND_THRESHOLD = 0.75
    private val SCORE_TEMPERATURE = 0.5    // 점수 평탄화: score^0.5 → 점수 차이 압축
    private val DIVERSITY_JITTER = 0.08    // 최종 정렬 전 랜덤 노이즈 폭

    private val systemPrompt = """
        You are a music feature analyst. Given a natural language description of a desired music mood or situation,
        return ONLY a JSON object with these exact keys:
        - energy: 0–100 (integer, 0 = very calm, 100 = very energetic)
        - happiness: 0–100 (integer, 0 = very sad/dark, 100 = very happy/bright)
        - danceability: 0–100 (integer, 0 = not danceable, 100 = very danceable)
        - acousticness: 0–100 (integer, 0 = fully electronic, 100 = fully acoustic)
        - tempo: 60–200 (integer, BPM)
        - tags: 2–4 tags chosen ONLY from the allowed tag list below — do NOT create new tags
        - message: a warm, natural Korean reply (2 sentences max) that acknowledges the user's situation and briefly describes the playlist vibe. Start with "네!" or a similar friendly opener. Do NOT list song titles.

        CRITICAL — happiness axis:
        - happiness measures emotional POSITIVITY, not energy level.
        - Anger / frustration / stress / venting → happiness MUST be 0–15 (dark, negative)
        - "#활기찬" and "#신나는" are for POSITIVE high-energy situations (excitement, joy). NEVER use them for anger or stress.
        - For anger/frustration use: #폭발적인, #강렬한, #어두운, #역동적인, #묵직한

        Allowed tags:
        ${TagVocabulary.asString}

        Genre filter — populate ONLY when the user explicitly mentions a genre or country of music:
        - genreInclude: canonical genre keys the user wants ([] if not mentioned)
        - genreExclude: canonical genre keys the user wants excluded ([] if not mentioned)
        If genre/country is NOT mentioned, both must be [].

        CRITICAL — genre detection:
        - "케이팝", "kpop", "k-pop", "한국 노래", "한국 음악", "국내" → ALWAYS "k-pop"
        - "팝송", "영어 노래", "해외 노래" → "pop"
        - "힙합", "랩", "rap" → "hip-hop"
        - "재즈" → "jazz"
        - "일본 노래", "j-pop", "일본 음악" → "j-pop"
        - Genre keyword anywhere in the sentence MUST be extracted — even if buried in mood description

        Canonical genre keys (use ONLY these exact strings):
        ${GenreAliases.canonicalKeys.sorted().joinToString(", ")}

        Genre examples:
        - "재즈 느낌 나는 노래" → "genreInclude": ["jazz"], "genreExclude": []
        - "일본 노래로 틀어줘" → "genreInclude": ["j-pop", "j-rock"], "genreExclude": []
        - "케이팝 말고 다른 거" → "genreInclude": [], "genreExclude": ["k-pop", "k-indie"]
        - "힙합으로 스트레스 풀고 싶어" → "genreInclude": ["hip-hop"], "genreExclude": []
        - "꿀꿀한데 위로되는 음악 틀어줘" → "genreInclude": [], "genreExclude": []
        - "졸라 신나는 여름에 듣는 케이팝 노래 추천해줘" → "genreInclude": ["k-pop"], "genreExclude": []
        - "신나는 케이팝 틀어줘" → "genreInclude": ["k-pop"], "genreExclude": []
        - "기분 좋은 팝송 틀어줘" → "genreInclude": ["pop"], "genreExclude": []
        - "드라이브하면서 들을 신나는 힙합" → "genreInclude": ["hip-hop"], "genreExclude": []

        Examples:
        - "새벽에 혼자 드라이브하며 감성에 젖고 싶어" → {"energy": 30, "happiness": 20, "danceability": 10, "acousticness": 70, "tempo": 70, "tags": ["#새벽감성", "#잔잔한", "#드라이브"], "message": "네! 새벽 드라이브의 감성에 딱 맞는 곡들을 골라봤어요. 조용하고 서정적인 음악들로 플레이리스트를 채웠어요."}
        - "길 막혀서 개빡치는데 분노 분출할 노래" → {"energy": 95, "happiness": 8, "danceability": 60, "acousticness": 5, "tempo": 158, "tags": ["#폭발적인", "#강렬한", "#역동적인", "#어두운"], "message": "꽉 막힌 도로에서 쌓인 스트레스, 제대로 터뜨려 드릴게요! 강렬하고 폭발적인 에너지의 곡들로 준비했어요."}
        - "스트레스 받아서 힙합으로 풀고 싶어" → {"energy": 88, "happiness": 12, "danceability": 70, "acousticness": 5, "tempo": 145, "tags": ["#강렬한", "#폭발적인", "#역동적인"], "message": "네! 스트레스 확 날려줄 강한 힙합 곡들로 준비했어요. 묵직한 비트와 강렬한 에너지로 가득한 플레이리스트예요."}
        - "친구들이랑 파티하면서 신나게 놀 노래" → {"energy": 90, "happiness": 90, "danceability": 95, "acousticness": 5, "tempo": 128, "tags": ["#신나는", "#활기찬", "#파티", "#댄스음악"], "message": "네! 파티 분위기 확 살려줄 신나는 곡들로 채워봤어요. 모두 함께 신나게 즐길 수 있는 댄스 플레이리스트예요!"}
        - "비 오는 날 우울하고 슬플 때" → {"energy": 25, "happiness": 10, "danceability": 15, "acousticness": 65, "tempo": 72, "tags": ["#슬픈", "#감성적인", "#비오는날", "#아련한"], "message": "네, 비 오는 날의 감성에 어울리는 곡들을 담았어요. 촉촉하고 잔잔한 멜로디로 감정에 공감해 드릴게요."}
    """.trimIndent()

    fun recommend(request: SmartRecommendationRequest, user: com.miml.backend.entity.User): SmartRecommendationResponse {
        val ratio = request.profileRatio.coerceIn(0.0, 1.0)

        // 1. GPT로 오디오 피처 수치 + 태그 동시 생성
        println("🤖 [Smart] GPT 분석: \"${request.description}\"")
        val parsed = openAiClient.chatJson(systemPrompt, request.description)

        val moodEnergy       = parsed.path("energy").asInt().coerceIn(0, 100)
        val moodHappiness    = parsed.path("happiness").asInt().coerceIn(0, 100)
        val moodDanceability = parsed.path("danceability").asInt().coerceIn(0, 100)
        val moodAcousticness = parsed.path("acousticness").asInt().coerceIn(0, 100)
        val moodTempo        = parsed.path("tempo").asInt().coerceIn(60, 200)
        val generatedTags    = parsed.path("tags").map { it.asText() }.filter { it in TagVocabulary.allowedTags }
        val gptGenreInclude  = parsed.path("genreInclude").map { it.asText() }.filter { it in GenreAliases.canonicalKeys }
        val gptGenreExclude  = parsed.path("genreExclude").map { it.asText() }.filter { it in GenreAliases.canonicalKeys }
        val replyMessage     = parsed.path("message").asText("")

        // GPT가 장르를 놓쳤을 경우 키워드 감지로 보완
        val detectedInclude  = detectGenreFromInput(request.description)
        val genreInclude     = (gptGenreInclude + detectedInclude).distinct()
            .filter { it in GenreAliases.canonicalKeys }
        val genreExclude     = gptGenreExclude

        println("   수치 → energy=$moodEnergy, happiness=$moodHappiness, danceability=$moodDanceability, acousticness=$moodAcousticness, tempo=$moodTempo")
        println("   태그 → $generatedTags")
        println("   장르 include=$genreInclude (gpt=$gptGenreInclude, detected=$detectedInclude), exclude=$genreExclude")

        // 2. 유저 프로필과 블렌딩
        val blendedEnergy       = blend(moodEnergy,       user.profileEnergy,       ratio)
        val blendedHappiness    = blend(moodHappiness,    user.profileHappiness,    ratio)
        val blendedDanceability = blend(moodDanceability, user.profileDanceability, ratio)
        val blendedAcousticness = blend(moodAcousticness, user.profileAcousticness, ratio)
        val blendedTempo        = blend(moodTempo,        user.profileTempo,        ratio)

        println("   블렌딩 (profileRatio=$ratio) → energy=$blendedEnergy, happiness=$blendedHappiness, danceability=$blendedDanceability, acousticness=$blendedAcousticness, tempo=$blendedTempo")

        // 3A. 오디오 범위 필터로 후보 추출
        val audioCandidates = audioFeaturesRepository.findByFeatureRange(
            energyMin       = (blendedEnergy - RANGE_MARGIN).coerceAtLeast(0),
            energyMax       = (blendedEnergy + RANGE_MARGIN).coerceAtMost(100),
            happinessMin    = (blendedHappiness - RANGE_MARGIN).coerceAtLeast(0),
            happinessMax    = (blendedHappiness + RANGE_MARGIN).coerceAtMost(100),
            danceabilityMin = (blendedDanceability - RANGE_MARGIN).coerceAtLeast(0),
            danceabilityMax = (blendedDanceability + RANGE_MARGIN).coerceAtMost(100),
            acousticnessMin = (blendedAcousticness - RANGE_MARGIN).coerceAtLeast(0),
            acousticnessMax = (blendedAcousticness + RANGE_MARGIN).coerceAtMost(100),
            tempoMin        = (blendedTempo - RANGE_MARGIN * 2).coerceAtLeast(60),
            tempoMax        = (blendedTempo + RANGE_MARGIN * 2).coerceAtMost(200),
        )
        val audioCandidateIds = audioCandidates.map { it.musicId }.toSet()

        // 3B. 태그 풀 — 의미 확장 후 매칭
        // exact match 대신 코사인 유사도 >= TAG_EXPAND_THRESHOLD 인 태그까지 확장
        val tagCandidates = if (generatedTags.isNotEmpty()) {
            val expandedTags = expandTags(generatedTags)
            println("   태그 확장: $generatedTags → $expandedTags")
            val tagMusicIds = musicTagRepository.findDistinctMusicIdsByTags(expandedTags)
                .filter { it !in audioCandidateIds }
            if (tagMusicIds.isNotEmpty()) {
                audioFeaturesRepository.findAllById(tagMusicIds)
                    .sortedByDescending { it.popularity ?: 0 }
                    .take(TAG_POOL_LIMIT)
            } else emptyList()
        } else emptyList()

        // 3C. 머지
        val candidates = audioCandidates + tagCandidates
        val candidateMusicIds = candidates.map { it.musicId }
        val allMusic = musicRepository.findAllById(candidateMusicIds).associateBy { it.id!! }
        println("   오디오 풀: ${audioCandidates.size}곡, 태그 풀: ${tagCandidates.size}곡, 합계: ${candidates.size}곡")

        // 3D. 장르 필터 (명시적 언급 시에만)
        val genreFiltered = applyGenreFilter(candidates, allMusic, genreInclude, genreExclude)
        if (genreInclude.isNotEmpty() || genreExclude.isNotEmpty()) {
            println("   장르 필터 후: ${genreFiltered.size}/${candidates.size}곡")
        }

        // 4. 1단계: 오디오 점수로 정렬 → 상위 N곡만 오디오 풀로 확정
        val audioPool = genreFiltered.mapNotNull { features ->
            val music = allMusic[features.musicId] ?: return@mapNotNull null
            val audioScore = calculateAudioScore(
                features, blendedEnergy, blendedHappiness, blendedDanceability, blendedAcousticness, blendedTempo
            )
            AudioScoredTrack(music, features, audioScore)
        }
            .filter { it.audioScore >= MIN_AUDIO_SCORE }
            .sortedByDescending { it.audioScore }
            .take(request.limit * AUDIO_POOL_FACTOR)

        println("   오디오 풀: ${audioPool.size}곡 (threshold=$MIN_AUDIO_SCORE)")

        // 5. 2단계: 오디오 풀 내에서 태그 유사도로 최종 순위 결정
        val audioPoolIds = audioPool.map { it.music.id!! }
        val tagsByMusicId = musicTagRepository.findByMusicIdInAndVoteCountGreaterThan(audioPoolIds, 0)
            .groupBy { it.musicId }  // List<MusicTag> 그대로 보존 (voteCount 점수 반영용)
        val hasTags = generatedTags.isNotEmpty() && tagsByMusicId.isNotEmpty()

        val tagEmbeddings = if (hasTags) {
            generatedTags.map { embeddingService.embed(it) }
        } else emptyList()

        println("   태그 보유 곡: ${tagsByMusicId.size}곡, 생성 태그: $generatedTags")

        val pool = audioPool.map { audioTrack ->
            val tagScore = if (hasTags) {
                calculateTagScore(audioTrack.music.id!!, tagsByMusicId, tagEmbeddings)
            } else 0.0
            val popularityScore = (audioTrack.features.popularity ?: 0) / 100.0

            // 태그 있으면 태그가 주 순위, 없으면 오디오 점수가 주 순위
            val totalScore = if (hasTags && tagScore > 0.0) {
                tagScore * TAG_WEIGHT + popularityScore * POPULARITY_WEIGHT
            } else {
                audioTrack.audioScore * AUDIO_WEIGHT_NO_TAGS + popularityScore * POPULARITY_WEIGHT_NO_TAGS
            }

            ScoredTrack(audioTrack.music, audioTrack.audioScore, tagScore, totalScore)
        // DIVERSITY_JITTER: 동점권 곡들의 순서를 매 요청마다 흔들어 다양성 확보
        }.sortedByDescending { it.totalScore + Random.nextDouble(-DIVERSITY_JITTER, DIVERSITY_JITTER) }

        println("   최종 풀: ${pool.size}곡")

        val recommendations = weightedSampleWithArtistDedup(pool, request.limit)

        println("   최종 추천: ${recommendations.size}곡")

        return SmartRecommendationResponse(
            totalCandidates = candidates.size,
            returnedCount = recommendations.size,
            recommendations = recommendations.map { RecommendedTrack.fromMusic(it.music, it.totalScore) },
            moodFeatures = MoodFeatures(
                energy = moodEnergy,
                happiness = moodHappiness,
                danceability = moodDanceability,
                acousticness = moodAcousticness,
                tempo = moodTempo
            ),
            message = replyMessage
        )
    }

    /**
     * 사용자 입력에서 장르 키워드를 직접 감지 — GPT가 놓쳤을 때 보완
     */
    private val genreKeywordMap = mapOf(
        "k-pop"      to listOf("케이팝", "kpop", "k-pop", "k팝", "한국 노래", "한국노래", "한국 음악", "국내 노래", "국내노래"),
        "k-indie"    to listOf("케이인디", "한국 인디", "국내 인디"),
        "hip-hop"    to listOf("힙합", "랩", "hip-hop", "hiphop", "hip hop"),
        "jazz"       to listOf("재즈", "jazz"),
        "r&b"        to listOf("알앤비", "r&b", "rnb"),
        "j-pop"      to listOf("제이팝", "j-pop", "jpop", "일본 노래", "일본노래", "일본 음악"),
        "pop"        to listOf("팝송", "팝 음악"),
        "classical"  to listOf("클래식", "classical"),
        "rock"       to listOf("록", "락", "rock", "록 음악", "락 음악", "록음악", "락음악"),
        "electronic" to listOf("일렉트로닉", "edm", "EDM", "전자음악"),
        "latin"      to listOf("라틴", "latin"),
        "metal"      to listOf("메탈", "헤비메탈", "metal", "heavy metal"),
    )

    private fun detectGenreFromInput(input: String): List<String> {
        val normalized = java.text.Normalizer.normalize(input, java.text.Normalizer.Form.NFC).lowercase()
        return genreKeywordMap.entries
            .filter { (_, keywords) ->
                keywords.any { keyword ->
                    val normalizedKeyword = java.text.Normalizer.normalize(keyword, java.text.Normalizer.Form.NFC).lowercase()
                    normalized.contains(normalizedKeyword)
                }
            }
            .map { it.key }
    }

    private fun applyGenreFilter(
        candidates: List<AudioFeatures>,
        allMusic: Map<Long, Music>,
        genreInclude: List<String>,
        genreExclude: List<String>
    ): List<AudioFeatures> {
        if (genreInclude.isEmpty() && genreExclude.isEmpty()) return candidates

        val includedArtists: Set<String>? = if (genreInclude.isNotEmpty()) {
            artistGenreRepository.findDistinctArtistNamesByGenreIn(GenreAliases.expand(genreInclude)).toSet()
        } else null

        val excludedArtists: Set<String>? = if (genreExclude.isNotEmpty()) {
            artistGenreRepository.findDistinctArtistNamesByGenreIn(GenreAliases.expand(genreExclude)).toSet()
        } else null

        return candidates.filter { features ->
            val artist = allMusic[features.musicId]?.artist
                ?: return@filter excludedArtists == null
            // 장르 명시 시 해당 장르 아티스트만 통과 — 장르 데이터 없는 아티스트도 제외
            val includePass = includedArtists == null || artist in includedArtists
            // 제외 장르 일치 → 제거, 장르 데이터 없으면 유지
            val excludePass = excludedArtists == null || artist !in excludedArtists
            includePass && excludePass
        }
    }

    private fun blend(mood: Int, profile: Int, profileRatio: Double): Int =
        ((1.0 - profileRatio) * mood + profileRatio * profile).toInt()

    private fun calculateAudioScore(
        features: AudioFeatures,
        energy: Int, happiness: Int, danceability: Int, acousticness: Int, tempo: Int
    ): Double {
        val diffs = listOf(
            (features.energy - energy).toDouble().pow(2),
            (features.happiness - happiness).toDouble().pow(2),
            (features.danceability - danceability).toDouble().pow(2),
            (features.acousticness - acousticness).toDouble().pow(2),
            run {
                val nf = (features.tempo - 60.0) / 1.4
                val nr = (tempo - 60.0) / 1.4
                (nf - nr).pow(2)
            }
        )
        val distance = sqrt(diffs.sum() / diffs.size)
        return (1.0 - (distance / MAX_AUDIO_DISTANCE)).coerceIn(0.0, 1.0)
    }

    /**
     * 태그 점수 계산 — 커버리지 방식 + voteCount 보정
     *
     * [기존] communityTags.maxOf { bestSimToAnyGeneratedTag }
     *   → 가장 좋은 커뮤니티 태그 1개만 보고 나머지 무시
     *   → 태그 1개 일치 = 태그 4개 일치 (점수 동일)
     *
     * [변경] tagEmbeddings.map { bestSimToAnyCommunityTag }.average()
     *   → 요청 태그 각각이 커뮤니티 태그에서 얼마나 커버되는지 평균
     *   → 태그 3개 일치 > 태그 1개 일치 (정확한 차등)
     *   → voteCount 높은 태그가 최선 매칭일 때 최대 +20% 보정
     */
    private fun calculateTagScore(
        musicId: Long,
        tagsByMusicId: Map<Long, List<MusicTag>>,
        tagEmbeddings: List<List<Double>>
    ): Double {
        val communityTags = tagsByMusicId[musicId] ?: return 0.0
        if (communityTags.isEmpty()) return 0.0

        // 각 생성 태그 → 가장 잘 맞는 커뮤니티 태그의 유사도 (커버리지)
        val coverageScores = tagEmbeddings.map { genEmbedding ->
            communityTags.maxOf { musicTag ->
                embeddingService.cosineSimilarity(genEmbedding, embeddingService.embed(musicTag.tag))
            }
        }
        val coverageScore = coverageScores.average()  // [0.0, 1.0]

        // voteCount 보정: 각 생성 태그의 최선 매칭 태그 중 가장 높은 voteCount 기준
        //   voteCount=1: +0%, voteCount=7: +10%, voteCount=55+: +20%
        val bestMatchVoteCount = tagEmbeddings.mapNotNull { genEmbedding ->
            communityTags.maxByOrNull {
                embeddingService.cosineSimilarity(genEmbedding, embeddingService.embed(it.tag))
            }?.voteCount
        }.maxOrNull() ?: 1
        val voteBonus = (ln(bestMatchVoteCount.toDouble()) / ln(200.0)).coerceIn(0.0, 0.2)

        return (coverageScore * (1.0 + voteBonus)).coerceIn(0.0, 1.0)
    }

    /**
     * 생성 태그와 코사인 유사도 >= TAG_EXPAND_THRESHOLD 인 TagVocabulary 태그 전체 반환
     * EmbeddingService 캐시 덕분에 두 번째 호출부터는 메모리 조회만 발생
     */
    private fun expandTags(generatedTags: List<String>): List<String> {
        val genEmbeddings = generatedTags.map { embeddingService.embed(it) }
        return TagVocabulary.allowedTags.filter { candidate ->
            val candidateEmbedding = embeddingService.embed(candidate)
            genEmbeddings.any { genEmb ->
                embeddingService.cosineSimilarity(genEmb, candidateEmbedding) >= TAG_EXPAND_THRESHOLD
            }
        }
    }

    /**
     * 가중치 샘플링 + 아티스트 중복 제거
     *
     * SCORE_TEMPERATURE(0.5) 적용: score^0.5 를 가중치로 사용
     *   - 0.95^0.5 ≈ 0.975, 0.70^0.5 ≈ 0.837 → 점수 격차가 압축되어
     *     하위권 곡도 선택될 확률이 의미 있게 높아짐
     *   - MAX_PER_ARTIST=1 과 결합하면 특정 아티스트 독점 현상 제거
     */
    private fun weightedSampleWithArtistDedup(pool: List<ScoredTrack>, limit: Int): List<ScoredTrack> {
        val result = mutableListOf<ScoredTrack>()
        val remaining = pool.toMutableList()
        val artistCount = mutableMapOf<String, Int>()

        while (result.size < limit && remaining.isNotEmpty()) {
            val eligible = remaining.filter { (artistCount[it.music.artist] ?: 0) < MAX_PER_ARTIST }
            if (eligible.isEmpty()) break

            // score^temperature 로 가중치 평탄화
            val weights = eligible.map { it.totalScore.pow(SCORE_TEMPERATURE) }
            val totalWeight = weights.sum()
            val rand = Random.nextDouble() * totalWeight
            var cumulative = 0.0
            val selected = eligible.zip(weights).first { (_, w) ->
                cumulative += w
                cumulative >= rand
            }.first

            result.add(selected)
            remaining.remove(selected)
            artistCount[selected.music.artist] = (artistCount[selected.music.artist] ?: 0) + 1
        }

        return result
    }

    private data class AudioScoredTrack(val music: Music, val features: AudioFeatures, val audioScore: Double)

    private data class ScoredTrack(
        val music: Music,
        val audioScore: Double,
        val tagScore: Double,
        val totalScore: Double
    )
}
