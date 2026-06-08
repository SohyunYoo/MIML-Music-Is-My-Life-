package com.miml.backend.entity

import jakarta.persistence.*

@Entity
@Table(
    name = "music_tags",
    uniqueConstraints = [UniqueConstraint(columnNames = ["music_id", "tag"])]
)
class MusicTag(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "music_id", nullable = false)
    val musicId: Long,

    @Column(name = "tag", nullable = false, length = 20)
    val tag: String,

    // GPT: 자동 생성 태그 (초기값 1표), USER: 유저 리뷰 기반 태그
    @Column(name = "source", nullable = false, length = 10)
    val source: String = "GPT",

    // 유저 투표 누적 점수 (0 이하면 추천에서 제외)
    @Column(name = "vote_count", nullable = false)
    var voteCount: Int = 1
)
