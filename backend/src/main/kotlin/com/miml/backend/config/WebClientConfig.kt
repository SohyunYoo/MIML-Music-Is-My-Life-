package com.miml.backend.config

import io.netty.channel.ChannelOption
import io.netty.handler.timeout.ReadTimeoutHandler
import io.netty.handler.timeout.WriteTimeoutHandler
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient
import java.util.concurrent.TimeUnit

@Configuration
class WebClientConfig {

    @Value("\${rapidapi.base-url}")
    private lateinit var soundNetBaseUrl: String

    @Value("\${rapidapi.key}")
    private lateinit var rapidApiKey: String

    @Value("\${rapidapi.host}")
    private lateinit var rapidApiHost: String

    /**
     * 타임아웃이 설정된 HttpClient
     * - 연결 타임아웃: 10초
     * - 응답 타임아웃: 15초 (그 안에 응답 없으면 포기)
     */
    private fun createHttpClient(): HttpClient {
        return HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 10_000)
            .doOnConnected { conn ->
                conn.addHandlerLast(ReadTimeoutHandler(15, TimeUnit.SECONDS))
                    .addHandlerLast(WriteTimeoutHandler(15, TimeUnit.SECONDS))
            }
    }

    @Bean
    fun soundNetWebClient(
        @Value("\${rapidapi.key}") apiKey: String
    ): WebClient {
        return WebClient.builder()
            .baseUrl("https://track-analysis.p.rapidapi.com")
            .defaultHeader("x-rapidapi-key", apiKey)
            .defaultHeader("x-rapidapi-host", "track-analysis.p.rapidapi.com")
            .build()
    }

    /**
     * Spotify Web API용 WebClient
     * access_token은 요청 시마다 다르므로 여기서 헤더 안 넣음
     */
    @Bean
    fun spotifyWebClient(): WebClient {
        return WebClient.builder()
            .baseUrl("https://api.spotify.com/v1")
            .build()
    }

    @Bean
    fun lastFmWebClient(): WebClient {
        return WebClient.builder()
            .baseUrl("https://ws.audioscrobbler.com/2.0")
            .build()
    }

    @Bean
    fun openAiWebClient(
        @Value("\${openai.api-key}") apiKey: String
    ): WebClient {
        return WebClient.builder()
            .baseUrl("https://api.openai.com/v1")
            .defaultHeader("Authorization", "Bearer $apiKey")
            .defaultHeader("Content-Type", "application/json")
            .clientConnector(ReactorClientHttpConnector(createHttpClient()))
            .build()
    }
}