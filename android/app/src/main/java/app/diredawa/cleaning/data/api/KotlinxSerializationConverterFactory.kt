package app.diredawa.cleaning.data.api

import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.ResponseBody
import retrofit2.Converter
import retrofit2.Retrofit
import java.lang.reflect.Type
import kotlinx.serialization.serializerOrNull

/**
 * Minimal Retrofit [Converter.Factory] using kotlinx-serialization directly.
 * This lets the app avoid an external Retrofit↔kotlinx bridge dependency while
 * staying consistent with the web contract (snake_case DTOs, unknown-key tolerance).
 * Handles [RequestBody] encoding and [ResponseBody] decoding for @Serializable types;
 * returns `null` for unsupported types so Retrofit can fall through otherwise.
 */
class KotlinxSerializationConverterFactory(
    private val json: Json,
) : Converter.Factory() {

    private val contentType = "application/json".toMediaType()

    private fun serializerFor(type: Type): KSerializer<Any>? =
        serializerOrNull(type)

    override fun responseBodyConverter(
        type: Type,
        annotations: Array<Annotation>,
        retrofit: Retrofit,
    ): Converter<ResponseBody, *>? {
        val serializer = serializerFor(type) ?: return null
        return object : Converter<ResponseBody, Any> {
            override fun convert(value: ResponseBody): Any {
                value.use {
                    return json.decodeFromString(serializer, it.string())
                }
            }
        }
    }

    override fun requestBodyConverter(
        type: Type,
        parameterAnnotations: Array<Annotation>,
        methodAnnotations: Array<Annotation>,
        retrofit: Retrofit,
    ): Converter<*, RequestBody>? {
        val serializer = serializerFor(type) ?: return null
        return object : Converter<Any, RequestBody> {
            override fun convert(value: Any): RequestBody =
                json.encodeToString(serializer, value).toRequestBody(contentType)
        }
    }
}