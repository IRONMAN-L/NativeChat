package expo.modules.nativetask

import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class ReplyWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    private val client = OkHttpClient()

    override fun doWork(): Result {
        val url = inputData.getString("url") ?: return Result.failure()
        val token = inputData.getString("token") ?: return Result.failure()
        val jsonPayload = inputData.getString("payload") ?: return Result.failure()

        try {
            val mediaType = "application/json; charset=utf-8".toMediaType()
            val body = jsonPayload.toRequestBody(mediaType)

            val request =
                    Request.Builder()
                            .url(url)
                            .addHeader("Authorization", "Bearer $token")
                            .addHeader("apikey", token)
                            .addHeader("Content-Type", "application/json")
                            .post(body)
                            .build()

            val response = client.newCall(request).execute()

            val responseBody = response.body?.string() // Read body to see server error message
            Log.d("NativeTask", "Response Code: ${response.code}, Body: $responseBody")

            return if (response.isSuccessful) {
                Log.d("NativeTask", "SUCCESS! Request sent.")
                Result.success()
            } else {
                Log.e("NativeTask", "Server Error: ${response.code} - $responseBody")
                if (response.code >= 500) Result.retry() else Result.failure()
            }
        } catch (e: Exception) {
            Log.e("NativeTask", "Network Exception: ${e.message}", e)
            return Result.retry() // Network fail? Try again automatically
        }
    }
}
