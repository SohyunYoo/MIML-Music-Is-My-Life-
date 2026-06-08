package com.miml.backend.service

import com.miml.backend.client.OpenAiClient
import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap

@Service
class EmbeddingService(
    private val openAiClient: OpenAiClient
) {
    // 같은 태그/문구는 반복 호출 없이 재사용
    private val cache = ConcurrentHashMap<String, List<Double>>()

    fun embed(text: String): List<Double> =
        cache.getOrPut(text) { openAiClient.embed(text) }

    // OpenAI 임베딩은 unit-normalized → dot product = cosine similarity
    fun cosineSimilarity(a: List<Double>, b: List<Double>): Double =
        a.zip(b).sumOf { (x, y) -> x * y }.coerceIn(0.0, 1.0)
}
