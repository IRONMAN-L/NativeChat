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
    Events("onUserFound", "onConnected", "onMessageReceived", "onDisconnected")

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
                        mapOf("endpointId" to endpointId, "message" to message)
                )
              }
            }
            override fun onPayloadTransferUpdate(
                    endpointId: String,
                    update: PayloadTransferUpdate
            ) {}
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
