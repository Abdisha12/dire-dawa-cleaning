package app.diredawa.cleaning.field

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * A prepared inspection photo stored in app-private storage. Only this internal
 * file path is used by the upload path; it is never shown to users (§24).
 */
data class PreparedPhoto(
    val id: String,
    val fileName: String,
    val absolutePath: String,
    val byteSize: Long,
)

/**
 * Photo capture/processing (§23–§25, §27).
 *
 *  - Captures via the system camera intent (no CameraX dependency); the returned
 *    content URI is then loaded off the UI thread.
 *  - Downsizes via inSampleSize decoding (never holds full-size bitmaps in memory,
 *    §27) and corrects EXIF orientation.
 *  - Compresses to a single JPEG in app-private cache (safe size/type, no raw
 *    full-resolution upload, §24).
 *  - Strips EXIF GPS/orientation metadata — authoritative location is captured
 *    separately by the inspection workflow (§25).
 */
class PhotoProcessor(private val appContext: Context) {

    private val maxDimension = 1600
    private val targetQuality = 80
    private val maxBytes = 5L * 1024L * 1024L // backend limit is 5MB per photo (§23).

    init {
        File(appContext.cacheDir, "field_photos").mkdirs()
    }

    /** Reads a photo from [uri] and prepares a compressed, down-scaled JPEG copy. */
    fun prepare(uri: Uri, sourceDirOverride: File? = null): PreparedPhoto {
        val bounds = decodeBounds(uri)
        val orientation = readOrientation(uri)
        val sampleSize = computeSampleSize(bounds, maxDimension.toFloat())

        val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        var bitmap = runCatching { appContext.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) } }.getOrNull()
            ?: error("Could not decode the selected image.")

        bitmap = applyOrientation(bitmap, orientation)

        val dir = sourceDirOverride ?: File(appContext.cacheDir, "field_photos").apply { mkdirs() }
        val id = UUID.randomUUID().toString()
        val fileName = "photo_$id.jpg"
        val file = File(dir, fileName)
        FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, targetQuality, out) }

        val compressed = compressIfNeeded(file, bitmap)
        return PreparedPhoto(
            id = id,
            fileName = compressed.name,
            absolutePath = compressed.absolutePath,
            byteSize = compressed.length(),
        )
    }

    private fun decodeBounds(uri: Uri): BitmapFactory.Options {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        appContext.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
        return opts
    }

    private fun readOrientation(uri: Uri): Int = runCatching {
        appContext.contentResolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(
            ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
        ) }
    }?.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL

    private fun computeSampleSize(bounds: BitmapFactory.Options, target: Float): Int {
        val (w, h) = (bounds.outWidth.takeIf { it > 0 } ?: target.toInt()) to
            (bounds.outHeight.takeIf { it > 0 } ?: target.toInt())
        var sample = 1
        while (w / sample > target || h / sample > target) sample *= 2
        return sample
    }

    private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
        val rotation = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        if (rotation == 0f) return bitmap
        val matrix = Matrix().apply { postRotate(rotation) }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated != bitmap) bitmap.recycle()
        return rotated
    }

    /** If the compressed file is still over the backend limit, reduce quality iteratively. */
    private fun compressIfNeeded(file: File, bitmap: Bitmap): File {
        if (file.length() <= maxBytes) return file
        var quality = targetQuality
        val output = File(file.parentFile, "${file.nameWithoutExtension}_q.jpg")
        while (quality > 30 && output.length() > maxBytes) {
            quality -= 15
            FileOutputStream(output).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
            }
        }
        file.delete()
        return output
    }
}