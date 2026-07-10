package com.cowatch.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.*
import kotlin.concurrent.thread

class UploadService : Service() {

    private val CHANNEL_ID = "upload_channel"
    private val NOTIFICATION_ID = 1001
    private val NOTIFICATION_READY_ID = 1002

    private var notificationManager: NotificationManager? = null

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val fileUriStr = intent?.getStringExtra("uri")
        val title = intent?.getStringExtra("title") ?: "Video"
        val description = intent?.getStringExtra("description") ?: ""
        val collectionId = intent?.getStringExtra("collection_id")
        val token = intent?.getStringExtra("token")
        val uploadUrlStr = intent?.getStringExtra("upload_url")

        if (fileUriStr != null && uploadUrlStr != null) {
            val fileUri = Uri.parse(fileUriStr)
            
            // Start Foreground immediately
            val initialNotification = buildProgressNotification("Preparing upload...", 0, "0 B", "0 MB/s", "Calculating...")
            startForeground(NOTIFICATION_ID, initialNotification)

            thread {
                performUpload(fileUri, title, description, collectionId, token, uploadUrlStr)
            }
        } else {
            stopSelf()
        }

        return START_NOT_STICKY
    }

    private fun performUpload(
        fileUri: Uri,
        title: String,
        description: String,
        collectionId: String?,
        token: String?,
        uploadUrlStr: String
    ) {
        val boundary = "Boundary-" + System.currentTimeMillis()
        var conn: HttpURLConnection? = null
        var outputStream: OutputStream? = null
        var inputStream: InputStream? = null

        try {
            val contentResolver = contentResolver
            val fileLength = getFileSize(fileUri)
            inputStream = contentResolver.openInputStream(fileUri)

            if (inputStream == null) {
                showFailureNotification("Failed to open file stream")
                stopSelf()
                return
            }

            // Build metadata parts in raw byte buffers
            val titlePart = (
                "--$boundary\r\n" +
                "Content-Disposition: form-data; name=\"title\"\r\n" +
                "Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
                "$title\r\n"
            ).toByteArray(Charsets.UTF_8)

            val descriptionPart = if (description.isNotEmpty()) {
                (
                    "--$boundary\r\n" +
                    "Content-Disposition: form-data; name=\"description\"\r\n" +
                    "Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
                    "$description\r\n"
                ).toByteArray(Charsets.UTF_8)
            } else ByteArray(0)

            val collectionPart = if (!collectionId.isNullOrEmpty() && collectionId != "null" && collectionId != "undefined") {
                (
                    "--$boundary\r\n" +
                    "Content-Disposition: form-data; name=\"collection_id\"\r\n" +
                    "Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
                    "$collectionId\r\n"
                ).toByteArray(Charsets.UTF_8)
            } else ByteArray(0)

            val fileName = getFileName(fileUri) ?: "video.mp4"
            val fileHeaderPart = (
                "--$boundary\r\n" +
                "Content-Disposition: form-data; name=\"file\"; filename=\"$fileName\"\r\n" +
                "Content-Type: video/mp4\r\n\r\n"
            ).toByteArray(Charsets.UTF_8)

            val footerPart = "\r\n--$boundary--\r\n".toByteArray(Charsets.UTF_8)

            // Compute exact total stream length
            val totalLength = titlePart.size + descriptionPart.size + collectionPart.size + fileHeaderPart.size + fileLength + footerPart.size

            val url = URL(uploadUrlStr)
            conn = url.openConnection() as HttpURLConnection
            conn.doOutput = true
            conn.doInput = true
            conn.useCaches = false
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            conn.setRequestProperty("Connection", "Keep-Alive")
            if (!token.isNullOrEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer $token")
            }

            // Set streaming mode: use fixed length if size is valid, else fallback to chunked streaming to prevent OOM
            if (fileLength > 0 && totalLength > 0) {
                conn.setFixedLengthStreamingMode(totalLength)
            } else {
                conn.setChunkedStreamingMode(1024 * 64)
            }

            outputStream = conn.outputStream

            // Write parts to output stream
            outputStream.write(titlePart)
            if (descriptionPart.isNotEmpty()) {
                outputStream.write(descriptionPart)
            }
            if (collectionPart.isNotEmpty()) {
                outputStream.write(collectionPart)
            }

            // Write file header and body bytes
            outputStream.write(fileHeaderPart)

            val buffer = ByteArray(1024 * 64)
            var bytesRead: Int
            var totalBytesWritten: Long = 0
            val startTime = System.currentTimeMillis()
            var lastUpdate = System.currentTimeMillis()

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
                totalBytesWritten += bytesRead

                val now = System.currentTimeMillis()
                if (now - lastUpdate >= 1000) {
                    val progress = if (fileLength > 0) ((totalBytesWritten * 100) / fileLength).toInt() else 0
                    val elapsedSeconds = (now - startTime) / 1000.0
                    val speedBytesPerSec = if (elapsedSeconds > 0) totalBytesWritten / elapsedSeconds else 0.0
                    val remainingBytes = if (fileLength > 0) fileLength - totalBytesWritten else 0L
                    val etaSeconds = if (speedBytesPerSec > 0 && fileLength > 0) (remainingBytes / speedBytesPerSec).toLong() else 0L

                    val progressText = if (fileLength > 0) "${formatBytes(totalBytesWritten)} / ${formatBytes(fileLength)}" else formatBytes(totalBytesWritten)
                    val speedText = formatSpeed(speedBytesPerSec)
                    val etaText = if (fileLength > 0) formatEta(etaSeconds) else "Streaming..."

                    updateNotification(progress, progressText, speedText, etaText)

                    // Dispatch progress update to WebView
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        MainActivity.getWebView()?.evaluateJavascript(
                            "if (typeof window.onAndroidUploadProgress === 'function') { window.onAndroidUploadProgress($progress, $speedBytesPerSec, $etaSeconds, $totalBytesWritten); }",
                            null
                        )
                    }

                    lastUpdate = now
                }
            }

            // Write closing boundary footer
            outputStream.write(footerPart)
            outputStream.flush()

            val responseCode = conn.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                val responseStr = conn.inputStream.bufferedReader().use { it.readText() }
                val responseJson = JSONObject(responseStr)
                val videoId = responseJson.optString("video_id")

                // Remove foreground notification
                stopForeground(STOP_FOREGROUND_REMOVE)

                // Show success notification
                showSuccessNotification(title)

                // Notify WebView of final completion and pass real videoId
                if (!videoId.isNullOrEmpty()) {
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        MainActivity.getWebView()?.evaluateJavascript(
                            "if (typeof window.onAndroidUploadComplete === 'function') { window.onAndroidUploadComplete('$videoId'); }",
                            null
                        )
                    }
                    val statusUrl = uploadUrlStr.replace("/upload", "/$videoId/status")
                    pollProcessingStatus(videoId, statusUrl, token)
                } else {
                    stopSelf()
                }
            } else {
                val errStr = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: "HTTP $responseCode"
                Log.e("UploadService", "Server error: $errStr")
                showFailureNotification("Server returned error: $errStr")
                stopSelf()
            }

        } catch (e: Exception) {
            Log.e("UploadService", "Upload failed", e)
            showFailureNotification(e.message ?: "Connection error")
            stopSelf()
        } finally {
            try { inputStream?.close() } catch (exc: Exception) {}
            try { outputStream?.close() } catch (exc: Exception) {}
            try { conn?.disconnect() } catch (exc: Exception) {}
        }
    }

    private fun pollProcessingStatus(videoId: String, statusUrl: String, token: String?) {
        thread {
            var ready = false
            var attempts = 0
            while (!ready && attempts < 100) {
                Thread.sleep(20000) // Poll every 20 seconds as requested
                attempts++
                try {
                    val url = URL(statusUrl)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    if (!token.isNullOrEmpty()) {
                        conn.setRequestProperty("Authorization", "Bearer $token")
                    }

                    if (conn.responseCode == HttpURLConnection.HTTP_OK) {
                        val responseStr = conn.inputStream.bufferedReader().use { it.readText() }
                        val responseJson = JSONObject(responseStr)
                        val status = responseJson.optString("status")
                        if (status == "ready") {
                            showPlaybackReadyNotification(videoId)
                            ready = true
                        } else if (status == "failed") {
                            showFailedProcessingNotification(videoId)
                            ready = true
                        }
                    }
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.e("UploadService", "Polling status failed", e)
                }
            }
            stopSelf()
        }
    }

    private fun addFormField(writer: PrintWriter, boundary: String, lf: String, name: String, value: String) {
        writer.append("--$boundary").append(lf)
        writer.append("Content-Disposition: form-data; name=\"$name\"").append(lf)
        writer.append("Content-Type: text/plain; charset=UTF-8").append(lf)
        writer.append(lf)
        writer.append(value).append(lf)
        writer.flush()
    }

    private fun getFileSize(uri: Uri): Long {
        var size = 0L
        try {
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                if (cursor.moveToFirst() && sizeIndex != -1) {
                    size = cursor.getLong(sizeIndex)
                }
            }
        } catch (e: Exception) {
            // Ignore query failures
        }
        if (size <= 0L) {
            try {
                contentResolver.openAssetFileDescriptor(uri, "r")?.use {
                    val len = it.length
                    if (len != android.content.res.AssetFileDescriptor.UNKNOWN_LENGTH) {
                        size = len
                    }
                }
            } catch (e: Exception) {
                // Ignore descriptor failures
            }
        }
        return size
    }

    private fun getFileName(uri: Uri): String? {
        var result: String? = null
        if (uri.scheme == "content") {
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val index = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) {
                        result = cursor.getString(index)
                    }
                }
            }
        }
        if (result == null) {
            result = uri.path
            val cut = result?.lastIndexOf('/') ?: -1
            if (cut != -1) {
                result = result?.substring(cut + 1)
            }
        }
        return result
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val exp = (Math.log(bytes.toDouble()) / Math.log(1024.0)).toInt()
        val units = arrayOf("KB", "MB", "GB", "TB")
        return String.format(Locale.US, "%.1f %s", bytes / Math.pow(1024.0, exp.toDouble()), units[exp - 1])
    }

    private fun formatSpeed(bytesPerSec: Double): String {
        return "${formatBytes(bytesPerSec.toLong())}/s"
    }

    private fun formatEta(seconds: Long): String {
        if (seconds <= 0) return "Calculating..."
        if (seconds < 60) return "${seconds}s remaining"
        val mins = seconds / 60
        val secs = seconds % 60
        return "${mins}m ${secs}s remaining"
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Background Uploads",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows progress and completion of background file uploads."
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    private fun buildProgressNotification(
        statusText: String,
        progress: Int,
        sizeText: String,
        speedText: String,
        etaText: String
    ): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Uploading Video")
            .setContentText("$statusText ($progress%)")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setProgress(100, progress, false)
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                "Status: $statusText\n" +
                "Progress: $progress%\n" +
                "Uploaded: $sizeText\n" +
                "Speed: $speedText\n" +
                "ETA: $etaText"
            ))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun updateNotification(progress: Int, sizeText: String, speedText: String, etaText: String) {
        val updatedNotification = buildProgressNotification("Uploading...", progress, sizeText, speedText, etaText)
        notificationManager?.notify(NOTIFICATION_ID, updatedNotification)
    }

    private fun showSuccessNotification(title: String) {
        val successNotification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("✓ File uploaded successfully")
            .setContentText("Your video is now being processed.")
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setStyle(NotificationCompat.BigTextStyle().bigText(
                "✓ File uploaded successfully.\n\n" +
                "Your video \"$title\" is now being processed.\n\n" +
                "You can safely close the application."
            ))
            .setOngoing(false)
            .build()
        notificationManager?.notify(NOTIFICATION_ID, successNotification)
    }

    private fun showFailureNotification(errorMessage: String) {
        val failureNotification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Upload Failed")
            .setContentText(errorMessage)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setOngoing(false)
            .build()
        notificationManager?.notify(NOTIFICATION_ID, failureNotification)
    }

    private fun showPlaybackReadyNotification(videoId: String) {
        val deepLinkIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("https://cowatch-theta.vercel.app/create-stream?video=$videoId")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            deepLinkIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🎬 Your video is ready to watch")
            .setContentText("Tap to open the room.")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        notificationManager?.notify(NOTIFICATION_READY_ID, notification)
    }

    private fun showFailedProcessingNotification(videoId: String) {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Transcoding Failed")
            .setContentText("Your video failed processing on the server.")
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setAutoCancel(true)
            .build()
        notificationManager?.notify(NOTIFICATION_READY_ID, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
