package com.miml.backend.service

object GenreAliases {
    val aliases: Map<String, List<String>> = mapOf(
        "k-pop"      to listOf("k-pop", "korean pop", "kpop", "k pop", "korean"),
        "k-indie"    to listOf("k-indie", "korean indie", "k indie"),
        "j-pop"      to listOf("j-pop", "jpop", "j pop", "japanese pop", "japanese"),
        "j-rock"     to listOf("j-rock", "jrock", "j rock", "japanese rock"),
        "anime"      to listOf("anime", "j-anime", "anisong"),
        "hip-hop"    to listOf("hip-hop", "hip hop", "rap", "trap", "hiphop"),
        "jazz"       to listOf("jazz", "jazz vocal", "smooth jazz", "vocal jazz", "nu jazz"),
        "r&b"        to listOf("r&b", "rnb", "soul", "r'n'b", "neo soul"),
        "classical"  to listOf("classical", "classical music", "orchestra", "orchestral", "piano"),
        "rock"       to listOf("rock", "alternative rock", "classic rock", "hard rock"),
        "pop"        to listOf("pop", "dance pop", "electropop", "teen pop"),
        "electronic" to listOf("electronic", "electronica", "edm", "electro", "house", "techno", "trance", "dance"),
        "indie"      to listOf("indie", "indie pop", "indie rock", "alternative", "lo-fi"),
        "metal"      to listOf("metal", "heavy metal", "death metal", "metalcore"),
        "folk"       to listOf("folk", "folk rock", "acoustic", "singer-songwriter"),
        "latin"      to listOf("latin", "latin pop", "reggaeton", "bossa nova"),
        "country"    to listOf("country", "country pop", "country rock"),
    )

    val canonicalKeys: Set<String> = aliases.keys.toSet()

    fun expand(canonicalGenres: List<String>): List<String> =
        canonicalGenres.flatMap { aliases[it] ?: listOf(it) }
}