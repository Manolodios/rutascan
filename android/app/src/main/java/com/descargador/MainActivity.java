package com.descargador.videos;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import java.io.InputStream;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final int TAB_HOME = 0;
    private static final int TAB_DOWNLOADS = 1;
    private static final int TAB_FAVORITES = 2;
    private static final int TAB_HISTORY = 3;
    private static final int TAB_SETTINGS = 4;

    private static final int REQUEST_STORAGE = 1;
    private static final long DUPLICATE_WINDOW_MS = 2000L;
    private static final String PREFS_NAME = "larptok_prefs";
    private static final String PREF_AVATAR_URI = "avatar_uri";
    private static final String[] SUPPORTED_HOSTS = {
            "instagram.com", "tiktok.com", "facebook.com", "fb.watch"
    };

    private EditText editUrl;
    private Button btnProcesar;
    private WebView webView;
    private TextView tvEstado;
    private TextView tvDownloadsSummary;

    private LinearLayout[] tabs;
    private View[] contents;
    private ImageView[] icons;
    private TextView[] labels;
    private TextView badgeDownloads;
    private View badgeHistory;

    private int currentTab = TAB_HOME;
    private int downloadsCount = 0;
    private boolean historyPending = false;
    private boolean pageLoadFailed = false;

    private String lastDownloadUrl;
    private long lastDownloadAt = 0L;

    private String pendingDownloadUrl;
    private String pendingDownloadContentDisposition;
    private String pendingDownloadMimeType;
    private String pendingDownloadUserAgent;

    private View avatarContainer;
    private ImageView imgAvatar;
    private ImageView icAvatarPlaceholder;
    private TextView tvProfileHint;
    private TextView actionRemovePhoto;
    private ActivityResultLauncher<String[]> avatarPicker;
    private String avatarUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        editUrl = findViewById(R.id.editUrl);
        btnProcesar = findViewById(R.id.btnProcesar);
        webView = findViewById(R.id.webView);
        tvEstado = findViewById(R.id.tvEstado);
        tvDownloadsSummary = findViewById(R.id.tvDownloadsSummary);

        tabs = new LinearLayout[]{
                findViewById(R.id.tabHome),
                findViewById(R.id.tabDownloads),
                findViewById(R.id.tabFavorites),
                findViewById(R.id.tabHistory),
                findViewById(R.id.tabSettings)
        };
        contents = new View[]{
                findViewById(R.id.contentHome),
                findViewById(R.id.contentDownloads),
                findViewById(R.id.contentFavorites),
                findViewById(R.id.contentHistory),
                findViewById(R.id.contentSettings)
        };
        icons = new ImageView[]{
                findViewById(R.id.iconHome),
                findViewById(R.id.iconDownloads),
                findViewById(R.id.iconFavorites),
                findViewById(R.id.iconHistory),
                findViewById(R.id.iconSettings)
        };
        labels = new TextView[]{
                findViewById(R.id.labelHome),
                findViewById(R.id.labelDownloads),
                findViewById(R.id.labelFavorites),
                findViewById(R.id.labelHistory),
                findViewById(R.id.labelSettings)
        };
        badgeDownloads = findViewById(R.id.badgeDownloads);
        badgeHistory = findViewById(R.id.badgeHistory);

        avatarContainer = findViewById(R.id.avatarContainer);
        imgAvatar = findViewById(R.id.imgAvatar);
        icAvatarPlaceholder = findViewById(R.id.icAvatarPlaceholder);
        tvProfileHint = findViewById(R.id.tvProfileHint);
        actionRemovePhoto = findViewById(R.id.actionRemovePhoto);

        avatarPicker = registerForActivityResult(
                new ActivityResultContracts.OpenDocument(),
                uri -> {
                    if (uri == null) {
                        return;
                    }
                    try {
                        getContentResolver().takePersistableUriPermission(
                                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (SecurityException ignored) {
                        // Algunos proveedores de imágenes no permiten conservar el permiso.
                    }
                    avatarUri = uri.toString();
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                            .edit()
                            .putString(PREF_AVATAR_URI, avatarUri)
                            .apply();
                    loadAvatar(uri);
                });

        View.OnClickListener chooseAvatar = v -> avatarPicker.launch(new String[]{"image/*"});
        avatarContainer.setOnClickListener(chooseAvatar);
        findViewById(R.id.actionChangePhoto).setOnClickListener(chooseAvatar);
        actionRemovePhoto.setOnClickListener(v -> removeAvatar());

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        avatarUri = prefs.getString(PREF_AVATAR_URI, null);
        if (avatarUri != null) {
            loadAvatar(Uri.parse(avatarUri));
        }

        for (int i = 0; i < tabs.length; i++) {
            final int tab = i;
            tabs[i].setOnClickListener(v -> selectTab(tab));
        }

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.setBackgroundColor(getColor(R.color.surface));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                pageLoadFailed = false;
                tvEstado.setText("Estado: cargando...");
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    pageLoadFailed = true;
                    tvEstado.setText("Estado: Error al cargar (" + error.getDescription() + ")");
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                            WebResourceResponse errorResponse) {
                if (request.isForMainFrame()) {
                    pageLoadFailed = true;
                    tvEstado.setText("Estado: Error HTTP " + errorResponse.getStatusCode());
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!pageLoadFailed) {
                    tvEstado.setText(R.string.status_ready);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (isMediaUrl(url)) {
                    startDownload(url, null, null, null);
                    return true;
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (isMediaUrl(url)) {
                    startDownload(url, null, null, null);
                    return true;
                }
                return false;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
                startDownload(url, contentDisposition, mimeType, userAgent));

        btnProcesar.setOnClickListener(v -> {
            String url = editUrl.getText().toString().trim();
            if (!isSupportedUrl(url)) {
                tvEstado.setText("Estado: URL no válida (se requiere instagram.com, tiktok.com, facebook.com o fb.watch)");
                return;
            }
            hideKeyboard();
            pageLoadFailed = false;
            webView.loadUrl(url);
            tvEstado.setText("Estado: cargando...");
            markHistoryPending();
            requestLegacyStoragePermission();
        });

        selectTab(TAB_HOME);
        updateBadges();
    }

    private void selectTab(int tab) {
        currentTab = tab;
        for (int i = 0; i < tabs.length; i++) {
            boolean selected = i == tab;
            tabs[i].setSelected(selected);
            contents[i].setVisibility(selected ? View.VISIBLE : View.GONE);
            int color = getColor(selected ? R.color.tab_selected : R.color.text_secondary);
            icons[i].setColorFilter(color);
            labels[i].setTextColor(color);
        }
        if (tab == TAB_HISTORY) {
            historyPending = false;
        }
        updateBadges();
    }

    private void updateBadges() {
        if (downloadsCount > 0) {
            badgeDownloads.setText(downloadsCount > 99 ? "99+" : String.valueOf(downloadsCount));
            badgeDownloads.setVisibility(View.VISIBLE);
            tvDownloadsSummary.setText(getString(R.string.downloads_summary, downloadsCount));
        } else {
            badgeDownloads.setVisibility(View.GONE);
            tvDownloadsSummary.setText(R.string.empty_downloads);
        }
        badgeHistory.setVisibility(historyPending ? View.VISIBLE : View.GONE);
    }

    private void markHistoryPending() {
        historyPending = true;
        updateBadges();
    }

    private boolean isSupportedUrl(String url) {
        try {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if (scheme == null) {
                return false;
            }
            scheme = scheme.toLowerCase(Locale.ROOT);
            if (!scheme.equals("https") && !scheme.equals("http")) {
                return false;
            }
            if (uri.getUserInfo() != null) {
                return false;
            }
            String host = uri.getHost();
            if (host == null) {
                return false;
            }
            host = host.toLowerCase(Locale.ROOT);
            for (String domain : SUPPORTED_HOSTS) {
                if (host.equals(domain) || host.endsWith("." + domain)) {
                    return true;
                }
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }

    private boolean isMediaUrl(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        return lower.contains(".mp4")
                || lower.contains(".jpg")
                || lower.contains(".jpeg")
                || lower.contains(".png")
                || lower.contains(".webp");
    }

    private void startDownload(String url, String contentDisposition, String mimeType, String userAgent) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            tvEstado.setText("Estado: enlace no descargable");
            return;
        }

        if (!hasStoragePermission()) {
            pendingDownloadUrl = url;
            pendingDownloadContentDisposition = contentDisposition;
            pendingDownloadMimeType = mimeType;
            pendingDownloadUserAgent = userAgent;
            tvEstado.setText("Estado: permiso de almacenamiento necesario");
            requestLegacyStoragePermission();
            return;
        }

        long now = System.currentTimeMillis();
        if (url.equals(lastDownloadUrl) && now - lastDownloadAt < DUPLICATE_WINDOW_MS) {
            tvEstado.setText("Estado: descarga ya iniciada");
            return;
        }

        String fileName = buildFileName(url, contentDisposition, mimeType);
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        if (mimeType != null && !mimeType.isEmpty()) {
            request.setMimeType(mimeType);
        }
        if (userAgent != null && !userAgent.isEmpty()) {
            request.addRequestHeader("User-Agent", userAgent);
        }
        String cookie = CookieManager.getInstance().getCookie(url);
        if (cookie != null) {
            request.addRequestHeader("Cookie", cookie);
        }
        String referer = webView.getUrl();
        if (referer != null) {
            request.addRequestHeader("Referer", referer);
        }
        request.setTitle(fileName);
        request.setDescription("larptok · descarga de contenido público");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            tvEstado.setText("Estado: no se pudo iniciar la descarga");
            return;
        }

        try {
            dm.enqueue(request);
            lastDownloadUrl = url;
            lastDownloadAt = now;
            downloadsCount++;
            updateBadges();
            markHistoryPending();
            tvEstado.setText("Estado: descargando " + fileName);
        } catch (SecurityException | IllegalArgumentException e) {
            tvEstado.setText("Estado: no se pudo iniciar la descarga (" + e.getMessage() + ")");
        }
    }

    private String buildFileName(String url, String contentDisposition, String mimeType) {
        String guessed = URLUtil.guessFileName(url, contentDisposition, mimeType);
        if (guessed == null || guessed.trim().isEmpty() || !guessed.contains(".")) {
            guessed = "media" + extensionFromUrl(url);
        }
        return "larptok_" + System.currentTimeMillis() + "_" + guessed;
    }

    private String extensionFromUrl(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains(".webp")) {
            return ".webp";
        }
        if (lower.contains(".png")) {
            return ".png";
        }
        if (lower.contains(".jpeg")) {
            return ".jpeg";
        }
        if (lower.contains(".jpg")) {
            return ".jpg";
        }
        return ".mp4";
    }

    private boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.P) {
            return true;
        }
        return checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLegacyStoragePermission() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && !hasStoragePermission()) {
            requestPermissions(
                    new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    REQUEST_STORAGE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_STORAGE) {
            return;
        }
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            if (pendingDownloadUrl != null) {
                String url = pendingDownloadUrl;
                String contentDisposition = pendingDownloadContentDisposition;
                String mimeType = pendingDownloadMimeType;
                String userAgent = pendingDownloadUserAgent;
                clearPendingDownload();
                startDownload(url, contentDisposition, mimeType, userAgent);
            }
        } else {
            clearPendingDownload();
            tvEstado.setText("Estado: permiso de almacenamiento denegado");
        }
    }

    private void clearPendingDownload() {
        pendingDownloadUrl = null;
        pendingDownloadContentDisposition = null;
        pendingDownloadMimeType = null;
        pendingDownloadUserAgent = null;
    }

    private void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) {
            imm.hideSoftInputFromWindow(editUrl.getWindowToken(), 0);
        }
    }

    private void loadAvatar(Uri uri) {
        final String uriString = uri.toString();
        new Thread(() -> {
            Bitmap bitmap = decodeAvatar(uri);
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed() || !uriString.equals(avatarUri)) {
                    return;
                }
                if (bitmap == null) {
                    imgAvatar.setImageDrawable(null);
                    imgAvatar.setVisibility(View.GONE);
                    icAvatarPlaceholder.setVisibility(View.VISIBLE);
                    actionRemovePhoto.setVisibility(View.VISIBLE);
                    tvProfileHint.setText(R.string.profile_photo_error);
                    return;
                }
                imgAvatar.setImageBitmap(bitmap);
                imgAvatar.setVisibility(View.VISIBLE);
                icAvatarPlaceholder.setVisibility(View.GONE);
                actionRemovePhoto.setVisibility(View.VISIBLE);
                tvProfileHint.setText(R.string.profile_photo_hint_saved);
            });
        }, "larptok-avatar").start();
    }

    private Bitmap decodeAvatar(Uri uri) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            try (InputStream input = getContentResolver().openInputStream(uri)) {
                if (input == null) {
                    return null;
                }
                BitmapFactory.decodeStream(input, null, bounds);
            }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                return null;
            }

            int sampleSize = 1;
            int shortestSide = Math.min(bounds.outWidth, bounds.outHeight);
            while (shortestSide / sampleSize > 512) {
                sampleSize *= 2;
            }

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sampleSize;
            try (InputStream input = getContentResolver().openInputStream(uri)) {
                if (input == null) {
                    return null;
                }
                return BitmapFactory.decodeStream(input, null, options);
            }
        } catch (Exception e) {
            return null;
        }
    }

    private void removeAvatar() {
        if (avatarUri != null) {
            try {
                getContentResolver().releasePersistableUriPermission(
                        Uri.parse(avatarUri), Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // El permiso pudo haberse liberado antes; no afecta la limpieza local.
            }
        }
        avatarUri = null;
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .remove(PREF_AVATAR_URI)
                .apply();
        imgAvatar.setImageDrawable(null);
        imgAvatar.setVisibility(View.GONE);
        icAvatarPlaceholder.setVisibility(View.VISIBLE);
        actionRemovePhoto.setVisibility(View.GONE);
        tvProfileHint.setText(R.string.profile_photo_hint);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putInt("currentTab", currentTab);
        outState.putInt("downloadsCount", downloadsCount);
        outState.putBoolean("historyPending", historyPending);
        outState.putString("lastDownloadUrl", lastDownloadUrl);
        outState.putLong("lastDownloadAt", lastDownloadAt);
        webView.saveState(outState);
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        currentTab = savedInstanceState.getInt("currentTab", TAB_HOME);
        downloadsCount = savedInstanceState.getInt("downloadsCount", 0);
        historyPending = savedInstanceState.getBoolean("historyPending", false);
        lastDownloadUrl = savedInstanceState.getString("lastDownloadUrl");
        lastDownloadAt = savedInstanceState.getLong("lastDownloadAt", 0L);
        webView.restoreState(savedInstanceState);
        selectTab(currentTab);
        updateBadges();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        webView.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (currentTab != TAB_HOME) {
            selectTab(TAB_HOME);
            return;
        }
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
