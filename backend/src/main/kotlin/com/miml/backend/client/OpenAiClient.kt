package com.miml.backend.client

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient

@Component
class OpenAiClient(
    @Qualifier("openAiWebClient") private val webClient: WebClient,
    private val objectMapper: ObjectMapper,
    @Value("\${openai.model}") private val model: String
) {

    fun embed(text: String): List<Double> {
        val requestBody = mapOf(
            "model" to "text-embedding-3-small",
            "input" to text
        )

        val responseBody = webClient.post()
            .uri("/embeddings")
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(String::class.java)
            .block() ?: throw RuntimeException("OpenAI Embedding API 응답 없음")

        val root = objectMapper.readTree(responseBody)
        return root.path("data").path(0).path("embedding").map { it.asDouble() }
    }

    fun chatJson(systemPrompt: String, userMessage: String): JsonNode {
        val requestBody = mapOf(
            "model" to model,
            "response_format" to mapOf("type" to "json_object"),
            "messages" to listOf(
                mapOf("role" to "system", "content" to systemPrompt),
                mapOf("role" to "user", "content" to userMessage)
            )
        )

        val responseBody = webClient.post()
            .uri("/chat/completions")
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(String::class.java)
            .block() ?: throw RuntimeException("OpenAI API 응답 없음")

        val root = objectMapper.readTree(responseBody)
        val content = root
            .path("choices")
            .path(0)
            .path("message")
            .path("content")
            .asText()

        return objectMapper.readTree(content)
    }
}
