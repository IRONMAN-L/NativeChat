package expo.modules.nativetask

import android.util.Log
import androidx.work.*
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeTaskModule : Module() {

  // Configuration constants for the network
  private val strategy = Strategy.P2P_STAR
  private val serviceId = "com.potato_chip.nativechat"

  override fun definition() = ModuleDefinition {
    Name("NativeTask")

    // Telling Expo which events we are allowing to send from JS
    Events("onUserFound", "onConnected", "onMessageReceived", "onDisconnected", "onTransferUpdate", "onFileReceived")

    // Function called from JS
    // HOST: Creates a room
    Function("startAdvertising") { userName: String ->
      val context = appContext.reactContext ?: return@Function
      val options = AdvertisingOptions.Builder().setStrategy(strategy).build()
      Nearby.getConnectionsClient(context)
              .startAdvertising(userName, serviceId, connectionLifecycleCallback, options)
              .addOnSuccessListener { Log.d("NativeTask", "Advertising started!") }
              .addOnFailureListener { Log.e("NativeTask", "Advertising failed: ", it) }
    }

    // CLIENT: Looks for a room
    Function("startDiscovery") {
      val context = appContext.reactContext ?: return@Function null
      val options = DiscoveryOptions.Builder().setStrategy(strategy).build()

      Nearby.getConnectionsClient(context)
              .startDiscovery(serviceId, endpointDiscoveryCallback, options)
              .addOnSuccessListener { Log.d("NativeTask", "Discovery started!") }
              .addOnFailureListener { Log.e("NativeTask", "Discovery failed: ", it) }
    }

    // CLIENT: Requests a connection to a Host
    Function("connectToUser") { endpointId: String, myName: String ->
      val context = appContext.reactContext ?: return@Function
      Nearby.getConnectionsClient(context)
              .requestConnection(myName, endpointId, connectionLifecycleCallback)
    }

    // SEND: Sends a text or encrypted payload
    Function("sendMessage") { endpointId: String, message: String ->
      val context = appContext.reactContext ?: return@Function
      val payload = Payload.fromBytes(message.toByteArray(Charsets.UTF_8))
      Nearby.getConnectionsClient(context).sendPayload(endpointId, payload)
    }

    Function("sendFile") { endpointId: String, fileUriString: String ->
      val context = appContext.reactContext ?: return@Function
            
      try {
        // React Native gives us URIs (file:// or content://)
        val uri = android.net.Uri.parse(fileUriString)
                
        // We open a safe stream to the file so we don't crash the memory
        val pfd = context.contentResolver.openFileDescriptor(uri, "r") ?: return@Function
        val payload = Payload.fromFile(pfd)

        // Track this as a file payload so onTransferUpdate can label it correctly
        outgoingFilePayloadIds.add(payload.id)

        Nearby.getConnectionsClient(context).sendPayload(endpointId, payload)
        Log.d("NativeTask", "Started streaming file payload: ${payload.id}")
      } catch (e: Exception) {
        Log.e("NativeTask", "Failed to send file: ${e.message}")
      }
    }

    // STOP: Disconnects everything
    Function("stopAll") {
      val context = appContext.reactContext ?: return@Function null
      Nearby.getConnectionsClient(context).stopAllEndpoints()
      Nearby.getConnectionsClient(context).stopAdvertising()
      Nearby.getConnectionsClient(context).stopDiscovery()
    }

    Function("sendReply") { url: String, token: String, payload: Map<String, String> ->
      Log.d("NativeTaskModule", "sendReply called with url: $url, token: $token, payload: $payload")
      enqueueWork(url, token, payload)
    }

    Function("markAsRead") { url: String, token: String, payload: Map<String, String> ->
      Log.d("NativeTaskModule", "markAsRead called with payload: $payload")
      enqueueWork(url, token, payload)
    }
  }

  // Callbacks for google api (Nearby)
  // Triggers when Bluetooth finds a nearby phone
  private val endpointDiscoveryCallback =
          object : EndpointDiscoveryCallback() {
            override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
              sendEvent(
                      "onUserFound",
                      mapOf("endpointId" to endpointId, "userName" to info.endpointName)
              )
            }
            override fun onEndpointLost(endpointId: String) {}
          }

  // Triggers during the connection process
  private val connectionLifecycleCallback =
          object : ConnectionLifecycleCallback() {
            override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
              val context = appContext.reactContext ?: return
              // Auto-accept the connection for this V1 test
              Nearby.getConnectionsClient(context).acceptConnection(endpointId, payloadCallback)
            }

            override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
              if (result.status.isSuccess) {
                sendEvent("onConnected", mapOf("endpointId" to endpointId))
              }
            }

            override fun onDisconnected(endpointId: String) {
              sendEvent("onDisconnected", mapOf("endpointId" to endpointId))
            }
          }

  // A map to store incoming file payloads
  private val incomingFilePayloads = mutableMapOf<Long, Payload>()
  // A set to track outgoing FILE payload IDs (to distinguish from BYTES payloads)
  private val outgoingFilePayloadIds = mutableSetOf<Long>()

  // Triggers when data flies across the Wi-Fi Direct pipe
  private val payloadCallback =
          object : PayloadCallback() {
            override fun onPayloadReceived(endpointId: String, payload: Payload) {
              if (payload.type == Payload.Type.BYTES) {
                val messageBytes = payload.asBytes() ?: return
                val message = String(messageBytes, Charsets.UTF_8)

                // Send the message back to JS!
                sendEvent(
                  "onMessageReceived",
                  mapOf(
                    "endpointId" to endpointId, 
                    "message" to message, 
                    "payloadId" to payload.id.toString()
                  )
                )
              } else if (payload.type == Payload.Type.FILE) {
                Log.d("NativeTask", "Incoming file stream started: ${payload.id}")
                incomingFilePayloads[payload.id] = payload
              }
            }
            override fun onPayloadTransferUpdate(
              endpointId: String,
              update: PayloadTransferUpdate
            ) {
              // Calculate the percentage
              val progress = if (update.totalBytes > 0) {
                (update.bytesTransferred.toFloat() / update.totalBytes.toFloat()) * 100
              } else {
                0f
              }

              // True only for FILE payloads (not BYTES/text messages)
              val isFile = incomingFilePayloads.containsKey(update.payloadId) ||
                           outgoingFilePayloadIds.contains(update.payloadId)

              // Send the exact percentage back to React Native
              sendEvent("onTransferUpdate", mapOf(
                  "endpointId" to endpointId,
                  "payloadId" to update.payloadId.toString(),
                  "status" to update.status, // 1 = SUCCESS, 2 = FAILURE, 3 = IN_PROGRESS
                  "progress" to progress.toInt(),
                  "isFile" to isFile  // KEY: lets JS ignore BYTES (text) transfer events
              ))

              if (update.status == PayloadTransferUpdate.Status.SUCCESS) {
                Log.d("NativeTask", "Payload ${update.payloadId} transfer 100% complete!")
                val payload = incomingFilePayloads[update.payloadId]
                if (payload != null && payload.type == Payload.Type.FILE) {
                  val payloadFile = payload.asFile()
                  if (payloadFile != null) {
                      val reactContext = appContext.reactContext
                      var finalUri: String? = null
                      
                      if (reactContext != null) {
                          try {
                              var inputStream: java.io.InputStream? = null
                              val payloadUri = payloadFile.asUri()
                              val pfd = payloadFile.asParcelFileDescriptor()

                              if (payloadUri != null) {
                                  inputStream = reactContext.contentResolver.openInputStream(payloadUri)
                              } else if (pfd != null) {
                                  inputStream = android.os.ParcelFileDescriptor.AutoCloseInputStream(pfd)
                              } else {
                                  val javaFile = payloadFile.asJavaFile()
                                  if (javaFile != null) {
                                      inputStream = java.io.FileInputStream(javaFile)
                                  }
                              }

                              if (inputStream != null) {
                                  val cachedFile = java.io.File(reactContext.cacheDir, "payload_${update.payloadId}.json")
                                  val outputStream = java.io.FileOutputStream(cachedFile)
                                  inputStream.copyTo(outputStream)
                                  inputStream.close()
                                  outputStream.close()
                                  finalUri = "file://" + cachedFile.absolutePath
                              }
                          } catch (e: Exception) {
                              Log.e("NativeTask", "Failed to cache payload stream", e)
                          }
                      }
                      
                      // If stream caching failed, try fallback
                      if (finalUri == null) {
                          val javaFile = payloadFile.asJavaFile()
                          if (javaFile != null) {
                             finalUri = "file://" + javaFile.absolutePath
                          }
                      }

                      if (finalUri != null) {
                          sendEvent("onFileReceived", mapOf(
                            "endpointId" to endpointId, 
                            "fileUri" to finalUri, 
                            "payloadId" to update.payloadId.toString()
                          ))
                      }
                  }
                  incomingFilePayloads.remove(update.payloadId)
                }
                // Clean up outgoing file tracking
                outgoingFilePayloadIds.remove(update.payloadId)
              } else if (update.status == PayloadTransferUpdate.Status.FAILURE || update.status == PayloadTransferUpdate.Status.CANCELED) {
                incomingFilePayloads.remove(update.payloadId)
                outgoingFilePayloadIds.remove(update.payloadId)
              }
            }
          }
  private fun enqueueWork(url: String, token: String, payload: Map<String, String>) {
    val context =
            appContext.reactContext
                    ?: run {
                      Log.e("NativeTaskModule", "React Context is null!")
                      return
                    }

    try {
      val jsonPayload = com.google.gson.Gson().toJson(payload)
      Log.d("NativeTask", "Payload serialized: $jsonPayload")

      val inputData =
              Data.Builder()
                      .putString("url", url)
                      .putString("token", token)
                      .putString("payload", jsonPayload)
                      .build()

      val request = OneTimeWorkRequestBuilder<ReplyWorker>().setInputData(inputData).build()

      WorkManager.getInstance(context).enqueue(request)
      Log.d("NativeTask", "WorkManager Enqueued successfully")
    } catch (e: Exception) {
      Log.e("NativeTaskModule", "Error scheduling work: ${e.message}")
    }
  }
}
