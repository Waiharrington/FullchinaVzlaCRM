package com.fullchinavzla.tablet;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.SimpleDateFormat;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/** Envía una imagen ESC/POS de 576 puntos de ancho; la altura crece con la comanda. */
final class ReceiptPrinter {
    private static final int WIDTH = 576;
    private static final int SIDE = 12;
    private static final int MIN_HEIGHT = 640; // Mínimo de 8 cm a 203 dpi.
    private static final int BAND_HEIGHT = 128;
    private static final Locale VENEZUELA = new Locale("es", "VE");

    private ReceiptPrinter() {}

    static void printTest(String host, int port) throws IOException, JSONException {
        JSONObject sample = new JSONObject();
        sample.put("kind", "precuenta");
        sample.put("createdAt", OffsetDateTime.now().toString());
        sample.put("orderNumber", "PRUEBA");
        sample.put("orderType", "Impresión de prueba");
        sample.put("employeeName", "Full China");
        sample.put("customerName", "Impresora de la tablet");
        sample.put("totalUsd", 0);
        sample.put("items", new JSONArray().put(new JSONObject()
            .put("name", "Conexión por red correcta")
            .put("quantity", 1)
            .put("unitPrice", 0)));
        print(host, port, sample);
    }

    static void print(String host, int port, JSONObject receipt) throws IOException, JSONException {
        if (!receipt.has("items") || !receipt.has("orderNumber")) {
            throw new JSONException("El ticket no tiene los datos necesarios.");
        }
        Layout layout = buildLayout(receipt);
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 4000);
            socket.setTcpNoDelay(true);
            OutputStream out = socket.getOutputStream();
            out.write(new byte[]{0x1b, 0x40}); // ESC @: inicializar.
            layout.writeRaster(out);
            out.write(new byte[]{0x1b, 0x64, 0x02}); // Dos líneas hasta el corte.
            out.write(new byte[]{0x1d, 0x56, 0x00}); // Corte completo.
            out.flush();
        }
    }

    private static Layout buildLayout(JSONObject data) throws JSONException {
        Layout page = new Layout();
        page.text(formatDate(data.optString("createdAt")));
        page.text("Orden: " + data.optString("orderNumber"));
        String type = data.optString("orderType");
        if (!data.isNull("tableNumber") && data.optInt("tableNumber") > 0) {
            type = "Mesa " + data.optInt("tableNumber");
        }
        page.text("Orden " + type);
        page.text("Empleado: " + fallback(data.optString("employeeName"), "Usuario del sistema"));
        page.text("Nombre y Apellido: " + fallback(data.optString("customerName"), "Cliente general"));
        page.separator();

        JSONArray items = data.getJSONArray("items");
        double subtotal = data.optDouble("deliveryFeeUsd", 0);
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            double quantity = item.optDouble("quantity", 0);
            double unitPrice = item.optDouble("unitPrice", 0);
            if (quantity <= 0 || unitPrice < 0) continue;
            subtotal += quantity * unitPrice;
            page.pair(quantity(quantity) + " " + item.optString("name"), usd(quantity * unitPrice), true, 0);
            JSONArray modifiers = item.optJSONArray("modifiers");
            if (modifiers != null) {
                for (int j = 0; j < modifiers.length(); j++) {
                    JSONObject modifier = modifiers.getJSONObject(j);
                    double modifierQuantity = modifier.optDouble("quantity", 0);
                    double price = modifier.optDouble("unitPrice", 0);
                    double totalQuantity = modifierQuantity * quantity;
                    subtotal += totalQuantity * price;
                    if (totalQuantity <= 0) continue;
                    String suffix = totalQuantity > 1 ? " ×" + quantity(totalQuantity) : "";
                    page.pair("+ " + modifier.optString("name") + suffix, usd(totalQuantity * price), false, 24);
                }
            }
        }
        double delivery = data.optDouble("deliveryFeeUsd", 0);
        if (delivery > 0) page.pair("1 Delivery", usd(delivery), true, 0);
        page.separator();
        page.pair("Subtotal:", usd(subtotal), false, 0);
        double rate = data.optDouble("bcvRate", 0);
        if (rate > 0) page.pair("Subtotal:", ves(subtotal * rate), false, 0);
        double total = data.optDouble("totalUsd", 0);
        page.pair("Total:", usd(total), true, 0);
        if (rate > 0) page.pair("Total:", ves(total * rate), true, 0);

        if ("venta".equals(data.optString("kind"))) {
            page.separator();
            JSONArray payments = data.optJSONArray("payments");
            if (payments == null || payments.length() == 0) {
                page.text("Pago registrado");
            } else {
                for (int i = 0; i < payments.length(); i++) {
                    JSONObject payment = payments.getJSONObject(i);
                    String method = paymentName(payment.optString("method"));
                    double amount = payment.optDouble("amount", 0);
                    page.pair("Pago " + method, usd(amount), false, 0);
                    if (rate > 0) page.pair("Pago " + method + " (Bs)", ves(amount * rate), false, 0);
                    String reference = payment.optString("referenceNumber", "").trim();
                    if (!reference.isEmpty() && !"null".equals(reference)) page.text("Referencia: " + reference);
                }
            }
        }
        page.space(14);
        page.space(42); // Conserva el espacio del pie sin imprimir texto.
        return page;
    }

    private static String fallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private static String formatDate(String raw) {
        try {
            Date date = Date.from(OffsetDateTime.parse(raw).toInstant());
            SimpleDateFormat formatter = new SimpleDateFormat("dd/MM/yyyy hh:mm a", VENEZUELA);
            formatter.setTimeZone(TimeZone.getTimeZone("America/Caracas"));
            return formatter.format(date);
        } catch (Exception ignored) {
            return raw;
        }
    }

    private static String quantity(double number) {
        return number == Math.floor(number) ? String.valueOf((long) number) : number(number);
    }

    private static String number(double value) {
        DecimalFormat format = new DecimalFormat("#,##0.00", new DecimalFormatSymbols(VENEZUELA));
        return format.format(value);
    }

    private static String usd(double value) {
        return "$" + number(value);
    }

    private static String ves(double value) {
        return "Bs. " + number(value);
    }

    private static String paymentName(String method) {
        switch (method) {
            case "cash": return "Efectivo";
            case "mobile": return "Pago móvil";
            case "card": return "Punto";
            case "transfer": return "Transferencia";
            case "binance": return "Binance";
            case "zelle": return "Zelle";
            case "personal_account": return "Cuenta personal";
            case "other": return "Otro";
            default: return method;
        }
    }

    private static final class Layout {
        private final List<Line> lines = new ArrayList<>();
        private int y = 8; // 1 mm de espacio superior.

        void text(String value) {
            for (String line : wrap(value, WIDTH - SIDE * 2, false)) {
                lines.add(Line.text(SIDE, y, line, false));
                y += 39;
            }
        }

        void center(String value) {
            lines.add(Line.center(y, value));
            y += 42;
        }

        void pair(String label, String amount, boolean bold, int indent) {
            Paint paint = Line.paint(bold);
            int available = WIDTH - SIDE * 2 - indent - Math.round(paint.measureText(amount)) - 12;
            List<String> wrappedLines = wrap(label, Math.max(120, available), bold);
            for (int i = 0; i < wrappedLines.size(); i++) {
                String wrapped = wrappedLines.get(i);
                lines.add(Line.text(SIDE + indent, y, wrapped, bold));
                if (i == 0) {
                    lines.add(Line.right(WIDTH - SIDE, y, amount, bold));
                }
                y += bold ? 43 : 39;
            }
        }

        void separator() {
            y += 12;
            lines.add(Line.rule(y));
            y += 24;
        }

        void space(int pixels) {
            y += pixels;
        }

        private static List<String> wrap(String raw, int width, boolean bold) {
            String value = raw == null ? "" : raw.trim().replace('\n', ' ');
            List<String> result = new ArrayList<>();
            Paint paint = Line.paint(bold);
            String current = "";
            for (String word : value.split("\\s+")) {
                String candidate = current.isEmpty() ? word : current + " " + word;
                if (paint.measureText(candidate) <= width) {
                    current = candidate;
                    continue;
                }
                if (!current.isEmpty()) result.add(current);
                current = "";
                for (int i = 0; i < word.length(); i++) {
                    String next = current + word.charAt(i);
                    if (paint.measureText(next) > width && !current.isEmpty()) {
                        result.add(current);
                        current = "";
                    }
                    current += word.charAt(i);
                }
            }
            if (!current.isEmpty()) result.add(current);
            if (result.isEmpty()) result.add("");
            return result;
        }

        void writeRaster(OutputStream out) throws IOException {
            int height = Math.max(MIN_HEIGHT, y + 32);
            if (height > 30_000) throw new IOException("La comanda supera el largo máximo permitido.");
            for (int top = 0; top < height; top += BAND_HEIGHT) {
                int rows = Math.min(BAND_HEIGHT, height - top);
                Bitmap bitmap = Bitmap.createBitmap(WIDTH, rows, Bitmap.Config.ARGB_8888);
                try {
                    bitmap.eraseColor(Color.WHITE);
                    Canvas canvas = new Canvas(bitmap);
                    canvas.translate(0, -top);
                    for (Line line : lines) {
                        if (line.y >= top - 44 && line.y < top + rows + 44) line.draw(canvas);
                    }
                    writeBand(out, bitmap, rows);
                } finally {
                    bitmap.recycle();
                }
            }
        }

        private void writeBand(OutputStream out, Bitmap bitmap, int rows) throws IOException {
            int bytesPerRow = WIDTH / 8;
            out.write(new byte[]{0x1d, 0x76, 0x30, 0x00,
                (byte) (bytesPerRow & 0xff), (byte) (bytesPerRow >> 8),
                (byte) (rows & 0xff), (byte) (rows >> 8)});
            byte[] pixels = new byte[rows * bytesPerRow];
            int[] row = new int[WIDTH];
            for (int y = 0; y < rows; y++) {
                bitmap.getPixels(row, 0, WIDTH, 0, y, WIDTH, 1);
                for (int x = 0; x < WIDTH; x++) {
                    int color = row[x];
                    int luminance = (Color.red(color) * 299 + Color.green(color) * 587 + Color.blue(color) * 114) / 1000;
                    if (luminance < 185) pixels[y * bytesPerRow + x / 8] |= (byte) (0x80 >> (x % 8));
                }
            }
            out.write(pixels);
            out.flush();
        }
    }

    private static final class Line {
        private static final int TEXT = 0;
        private static final int RIGHT = 1;
        private static final int CENTER = 2;
        private static final int RULE = 3;
        final int kind;
        final int x;
        final int y;
        final String value;
        final boolean bold;

        private Line(int kind, int x, int y, String value, boolean bold) {
            this.kind = kind;
            this.x = x;
            this.y = y;
            this.value = value;
            this.bold = bold;
        }

        static Line text(int x, int y, String value, boolean bold) { return new Line(TEXT, x, y, value, bold); }
        static Line right(int x, int y, String value, boolean bold) { return new Line(RIGHT, x, y, value, bold); }
        static Line center(int y, String value) { return new Line(CENTER, WIDTH / 2, y, value, false); }
        static Line rule(int y) { return new Line(RULE, 0, y, "", false); }

        static Paint paint(boolean bold) {
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setColor(Color.BLACK);
            paint.setTextSize(bold ? 32 : 30);
            paint.setTypeface(bold ? android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
                : android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL));
            return paint;
        }

        void draw(Canvas canvas) {
            if (kind == RULE) {
                Paint rulePaint = new Paint();
                rulePaint.setColor(Color.BLACK);
                rulePaint.setStrokeWidth(2);
                for (int start = SIDE; start < WIDTH - SIDE; start += 13) {
                    canvas.drawLine(start, y, Math.min(start + 7, WIDTH - SIDE), y, rulePaint);
                }
                return;
            }
            Paint textPaint = paint(bold);
            if (kind == RIGHT) textPaint.setTextAlign(Paint.Align.RIGHT);
            if (kind == CENTER) textPaint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(value, x, y + 31, textPaint);
        }
    }
}
