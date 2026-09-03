# Dire Dawa Cleaning — Android app custom ProGuard rules.
# Keep Retrofit + Kotlinx Serialization working under minification.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class app.diredawa.cleaning.**$$serializer { *; }
-keepclassmembers class app.diredawa.cleaning.** {
    *** Companion;
}
-keepclasseswithmembers class app.diredawa.cleaning.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp / Retrofit
-keepattributes Signature
-keepattributes Exceptions
-dontwarn okhttp3.**
-dontwarn okio.**
