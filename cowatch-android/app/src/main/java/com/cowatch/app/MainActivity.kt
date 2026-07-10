package com.cowatch.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    
    // Callbacks to pass files selected in native dialog back to Next.js
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Register file chooser launcher
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val data: Intent? = result.data
            val results = when {
                data?.dataString != null -> arrayOf(Uri.parse(data.dataString))
                data?.clipData != null -> {
                    val count = data.clipData!!.itemCount
                    Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                }
                else -> null
            }
            filePathCallback?.onReceiveValue(results)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    // Explicitly cache incoming requests to prevent race condition loop in LiveKit WebRTC requests
    private var pendingPermissionRequest: PermissionRequest? = null
    
    // For handling fullscreen HTML5 video elements in WebView
    private var customView: android.view.View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        val audioGranted = permissions[Manifest.permission.RECORD_AUDIO] ?: false

        if (cameraGranted && audioGranted) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
        } else {
            Toast.makeText(this, "Camera & Audio access required for LiveKit chat.", Toast.LENGTH_LONG).show()
            pendingPermissionRequest?.deny()
        }
        pendingPermissionRequest = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        setContentView(R.layout.activity_main)

        // Request notification permission for Android 13+ background updates
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 102)
            }
        }

        webView = findViewById(R.id.webView)
        setupWebView()
        setupBackNavigation()
        handleDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val data: Uri? = intent?.data
        if (data != null && data.scheme == "cowatch" && data.host == "login-callback") {
            val token = data.getQueryParameter("token")
            if (!token.isNullOrEmpty()) {
                val script = "document.cookie = 'cowatch_auth=$token; path=/; max-age=${60 * 60 * 24 * 7}'; window.location.href = '/dashboard';"
                webView.evaluateJavascript(script, null)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        
        // Critical for Real-time WebSockets, LiveKit, and custom controls
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        
        // Use a clean, standard mobile User-Agent to bypass Google OAuth WebView blocks and identify the Android app wrapper
        settings.userAgentString = "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 CoWatchAndroid"
        
        // Autoplay and hardware configurations
        settings.mediaPlaybackRequiresUserGesture = false 
        settings.allowFileAccess = true
        settings.databaseEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        webView.clearCache(true)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        
        // Enable popup window support for Google Identity Services popup auth
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true

        webView.addJavascriptInterface(AndroidUploadBridge(), "AndroidUploadBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url != null) {
                    if (url.startsWith("http://") || url.startsWith("https://")) {
                        return false
                    }
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                    } catch (e: Exception) {
                        // Ignore
                    }
                }
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            
            // Route popup windows (like Google login popups) into a dialog WebView to support postMessage auth flow
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                val context = this@MainActivity
                val popupWebView = WebView(context)
                
                popupWebView.settings.javaScriptEnabled = true
                popupWebView.settings.domStorageEnabled = true
                popupWebView.settings.userAgentString = view?.settings?.userAgentString
                popupWebView.settings.setSupportMultipleWindows(true)
                popupWebView.settings.javaScriptCanOpenWindowsAutomatically = true
                
                val dialog = android.app.Dialog(context, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
                dialog.setContentView(popupWebView)
                dialog.show()
                
                popupWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                        if (url != null && !url.startsWith("http://") && !url.startsWith("https://")) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                startActivity(intent)
                                return true
                            } catch (e: Exception) {
                                // Ignore
                            }
                        }
                        return false
                    }
                }
                
                popupWebView.webChromeClient = object : WebChromeClient() {
                    override fun onCloseWindow(window: WebView?) {
                        super.onCloseWindow(window)
                        dialog.dismiss()
                    }
                }
                
                val transport = resultMsg?.obj as? WebView.WebViewTransport
                transport?.webView = popupWebView
                resultMsg?.sendToTarget()
                return true
            }
            
            // Bridge Next.js HTML5 mic/camera requests (LiveKit) to Android runtime permissions
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return

                // Handle race conditions and prevent infinite permission loops
                if (pendingPermissionRequest != null) {
                    request.deny()
                    return
                }

                pendingPermissionRequest = request

                val requiredPermissions = mutableListOf<String>()
                if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                    requiredPermissions.add(Manifest.permission.CAMERA)
                }
                if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    requiredPermissions.add(Manifest.permission.RECORD_AUDIO)
                }

                if (requiredPermissions.isNotEmpty()) {
                    val missingPermissions = requiredPermissions.filter {
                        ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED
                    }

                    if (missingPermissions.isEmpty()) {
                        request.grant(request.resources)
                        pendingPermissionRequest = null
                    } else {
                        requestPermissionLauncher.launch(missingPermissions.toTypedArray())
                    }
                } else {
                    request.grant(request.resources)
                    pendingPermissionRequest = null
                }
            }

            // Bridge <input type="file"> to Native Android File Chooser
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                
                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }

            // Implement custom view support for standard HTML5 player fullscreen request
            override fun onShowCustomView(view: android.view.View?, callback: CustomViewCallback?) {
                super.onShowCustomView(view, callback)
                if (customView != null) {
                    onHideCustomView()
                    return
                }
                customView = view
                customViewCallback = callback
                
                val decor = window.decorView as android.view.ViewGroup
                decor.addView(view, android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                ))
                
                webView.visibility = android.view.View.GONE
                
                // Set orientation to landscape utilizing the device's IMU sensors
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                
                // Hide system UI (immersive fullscreen)
                window.decorView.systemUiVisibility = (
                    android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
                    android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
            }

            override fun onHideCustomView() {
                super.onHideCustomView()
                hideFullscreen()
            }
        }

        // Load targeted application URL
        webView.loadUrl("https://cowatch-theta.vercel.app")
    }

    private fun hideFullscreen() {
        val view = customView ?: return
        val decor = window.decorView as android.view.ViewGroup
        decor.removeView(view)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        
        webView.visibility = android.view.View.VISIBLE
        
        // Restore screen orientation back to unspecified (default auto-rotate/portrait behavior)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        
        // Restore system UI
        window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_VISIBLE
    }

    // Keep parameters globally cached for the current file picker request
    private var selectedFileUri: Uri? = null

    private val nativeUploadFilePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val selectedUri = result.data?.data
            if (selectedUri != null) {
                selectedFileUri = selectedUri
                // Grant persistent Uri permissions so service can read it
                try {
                    val takeFlags: Int = Intent.FLAG_GRANT_READ_URI_PERMISSION
                    contentResolver.takePersistableUriPermission(selectedUri, takeFlags)
                } catch (e: Exception) {
                    // Ignore on non-persistable Uris
                }

                // Query details of selected file to notify WebView
                var fileName = "video.mp4"
                var fileSize = 0L
                contentResolver.query(selectedUri, null, null, null, null)?.use { cursor ->
                    val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                    if (cursor.moveToFirst()) {
                        if (nameIndex != -1) {
                            fileName = cursor.getString(nameIndex) ?: "video.mp4"
                        }
                        if (sizeIndex != -1) {
                            fileSize = cursor.getLong(sizeIndex)
                        }
                    }
                }

                // Escape single quotes for JS safety
                val escapedFileName = fileName.replace("'", "\\'")

                // Notify WebView of file selection
                webView.evaluateJavascript("if (typeof window.onAndroidFileSelected === 'function') { window.onAndroidFileSelected('$escapedFileName', $fileSize); }", null)
            }
        }
    }

    private fun launchNativeFilePicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "video/*"
        }
        nativeUploadFilePickerLauncher.launch(intent)
    }

    private fun startNativeUploadService(
        title: String,
        description: String,
        collectionId: String?,
        token: String?,
        uploadUrl: String
    ) {
        val uri = selectedFileUri
        if (uri == null) {
            Toast.makeText(this, "No video selected", Toast.LENGTH_SHORT).show()
            return
        }

        val serviceIntent = Intent(this, UploadService::class.java).apply {
            putExtra("uri", uri.toString())
            putExtra("title", title)
            putExtra("description", description)
            putExtra("collection_id", collectionId)
            putExtra("token", token)
            putExtra("upload_url", uploadUrl)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        // Notify WebView that background upload service has successfully started
        webView.evaluateJavascript("if (typeof window.onAndroidUploadStarted === 'function') { window.onAndroidUploadStarted(); }", null)
    }

    inner class AndroidUploadBridge {
        @android.webkit.JavascriptInterface
        fun triggerNativeFilePicker() {
            runOnUiThread {
                launchNativeFilePicker()
            }
        }

        @android.webkit.JavascriptInterface
        fun startNativeUpload(
            title: String,
            description: String,
            collectionId: String?,
            token: String?,
            uploadUrl: String
        ) {
            runOnUiThread {
                startNativeUploadService(title, description, collectionId, token, uploadUrl)
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    hideFullscreen()
                } else if (webView.canGoBack()) {
                    webView.goBack() // Traverses Next.js history routing
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed() // Exit App
                }
            }
        })
    }

    override fun onDestroy() {
        if (instance == this) {
            instance = null
        }
        super.onDestroy()
    }

    companion object {
        private var instance: MainActivity? = null

        fun getWebView(): WebView? {
            return instance?.webView
        }
    }
}
