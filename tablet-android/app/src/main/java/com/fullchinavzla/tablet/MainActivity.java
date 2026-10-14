package com.fullchinavzla.tablet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.webkit.ValueCallback;

import org.json.JSONObject;

import java.net.URI;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public final class MainActivity extends Activity {
    private static final int FILE_PICKER_REQUEST = 301;
    private static final String SITE_URL = "https://fullchinavzla.vercel.app/";
    private static final String SITE_HOST = "fullchinavzla.vercel.app";
    private static final String PREFS_NAME = "printer_settings";
    private static final String PREF_HOST = "host";
    private static final String PREF_PORT = "port";

    private final ExecutorService jobs = Executors.newSingleThreadExecutor();
    private final ExecutorService discovery = Executors.newSingleThreadExecutor();
    private final AtomicInteger queuedJobs = new AtomicInteger();
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileSelection;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildScreen();
        configureWebView();
        webView.loadUrl(SITE_URL);
    }

    private void buildScreen() {
        webView = new WebView(this);
        setContentView(webView);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new PrinterBridge(), "FullChinaPrinter");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFileSelection != null) pendingFileSelection.onReceiveValue(null);
                pendingFileSelection = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_PICKER_REQUEST);
                } catch (Exception error) {
                    pendingFileSelection = null;
                    callback.onReceiveValue(null);
                    showMessage("No se pudo abrir el selector de archivos.");
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && SITE_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                if (request.isForMainFrame()) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                        showMessage("No se pudo abrir el enlace.");
                    }
                }
                return true;
            }
        });
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_PICKER_REQUEST && pendingFileSelection != null) {
            pendingFileSelection.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFileSelection = null;
        }
    }

    private SharedPreferences printerPrefs() {
        return getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
    }

    private String getPrinterHost() {
        return printerPrefs().getString(PREF_HOST, "");
    }

    private int getPrinterPort() {
        return printerPrefs().getInt(PREF_PORT, 9100);
    }

    private void showMessage(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private static String validIpv4(String raw) {
        String value = raw.trim();
        String[] octets = value.split("\\.", -1);
        if (octets.length != 4) return null;
        int[] parts = new int[4];
        for (int i = 0; i < 4; i++) {
            if (!octets[i].matches("[0-9]{1,3}")) return null;
            parts[i] = Integer.parseInt(octets[i]);
            if (parts[i] > 255) return null;
        }
        boolean privateAddress = parts[0] == 10
            || parts[0] == 192 && parts[1] == 168
            || parts[0] == 172 && parts[1] >= 16 && parts[1] <= 31;
        return privateAddress ? value : null;
    }

    private static int validPort(String raw) {
        try {
            int value = Integer.parseInt(raw.trim());
            return value >= 1 && value <= 65535 ? value : -1;
        } catch (NumberFormatException error) {
            return -1;
        }
    }

    private void showPrinterSettings() {
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(8), dp(20), 0);

        TextView help = new TextView(this);
        help.setText("Conecta la tablet al Wi-Fi del local. Puedes buscar la impresora o escribir su IP y puerto.");
        content.addView(help);

        EditText hostInput = new EditText(this);
        hostInput.setSingleLine(true);
        hostInput.setHint("IP, por ejemplo 192.168.1.130");
        hostInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        hostInput.setText(getPrinterHost());
        content.addView(hostInput);

        EditText portInput = new EditText(this);
        portInput.setSingleLine(true);
        portInput.setHint("Puerto");
        portInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        portInput.setText(String.valueOf(getPrinterPort()));
        content.addView(portInput);

        Button search = new Button(this);
        search.setText("Buscar impresoras en la red");
        search.setAllCaps(false);
        content.addView(search);

        TextView discoveryStatus = new TextView(this);
        content.addView(discoveryStatus);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Impresora XP-80C")
            .setView(content)
            .setPositiveButton("Guardar", null)
            .setNeutralButton("Probar", null)
            .setNegativeButton("Cerrar", null)
            .create();

        search.setOnClickListener(view -> {
            int port = validPort(portInput.getText().toString());
            if (port < 0) {
                portInput.setError("Puerto inválido");
                return;
            }
            search.setEnabled(false);
            discoveryStatus.setText("Buscando dispositivos en la red...");
            discovery.execute(() -> {
                List<String> found = PrinterDiscovery.find(port);
                runOnUiThread(() -> {
                    if (!dialog.isShowing()) return;
                    search.setEnabled(true);
                    if (found.isEmpty()) {
                        discoveryStatus.setText("No se encontró una impresora. Escribe su IP manualmente.");
                    } else if (found.size() == 1) {
                        hostInput.setText(found.get(0));
                        discoveryStatus.setText("Encontrada: " + found.get(0) + ". Usa Probar para confirmarla.");
                    } else {
                        discoveryStatus.setText("Se encontraron " + found.size() + " dispositivos. Selecciona la impresora y pulsa Probar.");
                        new AlertDialog.Builder(this)
                            .setTitle("Dispositivos encontrados")
                            .setItems(found.toArray(new String[0]), (choice, which) -> hostInput.setText(found.get(which)))
                            .show();
                    }
                });
            });
        });

        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
                String host = validIpv4(hostInput.getText().toString());
                int port = validPort(portInput.getText().toString());
                if (host == null) {
                    hostInput.setError("Usa una dirección IP privada válida");
                    return;
                }
                if (port < 0) {
                    portInput.setError("Puerto inválido");
                    return;
                }
                printerPrefs().edit().putString(PREF_HOST, host).putInt(PREF_PORT, port).apply();
                dialog.dismiss();
                showMessage("Impresora guardada.");
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(view -> {
                String host = validIpv4(hostInput.getText().toString());
                int port = validPort(portInput.getText().toString());
                if (host == null || port < 0) {
                    discoveryStatus.setText("Escribe una IP y un puerto válidos para hacer la prueba.");
                    return;
                }
                discoveryStatus.setText("Enviando ticket de prueba...");
                jobs.execute(() -> {
                    try {
                        ReceiptPrinter.printTest(host, port);
                        runOnUiThread(() -> {
                            if (dialog.isShowing()) discoveryStatus.setText("Prueba enviada. Comprueba que salió en la XP-80C.");
                        });
                    } catch (Exception error) {
                        runOnUiThread(() -> {
                            if (dialog.isShowing()) discoveryStatus.setText("No se pudo imprimir: " + error.getMessage());
                        });
                    }
                });
            });
        });
        dialog.show();
    }

    private boolean trustedPageIsOpen() {
        try {
            URI url = new URI(webView.getUrl());
            return "https".equalsIgnoreCase(url.getScheme()) && SITE_HOST.equalsIgnoreCase(url.getHost());
        } catch (Exception error) {
            return false;
        }
    }

    private final class PrinterBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(MainActivity.this::showPrinterSettings);
        }

        @JavascriptInterface
        public String getStatus() {
            String host = getPrinterHost();
            return host.isEmpty() ? "Sin configurar" : "Configurada: " + host + ":" + getPrinterPort();
        }

        @JavascriptInterface
        public void printReceipt(String json) {
            if (json == null || json.length() > 250_000) {
                runOnUiThread(() -> showMessage("El ticket es demasiado largo para enviarlo."));
                return;
            }
            runOnUiThread(() -> {
                if (!trustedPageIsOpen()) return;
                String host = getPrinterHost();
                if (host.isEmpty()) {
                    showMessage("Configura la impresora antes de imprimir.");
                    showPrinterSettings();
                    return;
                }
                if (queuedJobs.incrementAndGet() > 3) {
                    queuedJobs.decrementAndGet();
                    showMessage("Hay varias impresiones pendientes. Espera un momento.");
                    return;
                }
                int port = getPrinterPort();
                jobs.execute(() -> {
                    try {
                        ReceiptPrinter.print(host, port, new JSONObject(json));
                        runOnUiThread(() -> showMessage("Ticket enviado a la impresora."));
                    } catch (Exception error) {
                        runOnUiThread(() -> new AlertDialog.Builder(MainActivity.this)
                            .setTitle("No se pudo imprimir")
                            .setMessage(error.getMessage() + "\n\nRevisa el Wi-Fi y la configuración de impresión.")
                            .setPositiveButton("Entendido", null)
                            .show());
                    } finally {
                        queuedJobs.decrementAndGet();
                    }
                });
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (pendingFileSelection != null) pendingFileSelection.onReceiveValue(null);
        webView.destroy();
        jobs.shutdownNow();
        discovery.shutdownNow();
        super.onDestroy();
    }
}
