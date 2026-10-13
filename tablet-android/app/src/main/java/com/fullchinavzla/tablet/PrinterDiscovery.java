package com.fullchinavzla.tablet;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

final class PrinterDiscovery {
    private PrinterDiscovery() {}

    static List<String> find(int port) {
        byte[] address = localWifiAddress();
        if (address == null) return Collections.emptyList();
        String prefix = (address[0] & 0xff) + "." + (address[1] & 0xff) + "." + (address[2] & 0xff) + ".";
        int self = address[3] & 0xff;
        List<String> found = Collections.synchronizedList(new ArrayList<>());
        ExecutorService pool = Executors.newFixedThreadPool(24);
        CountDownLatch pending = new CountDownLatch(254);
        try {
            for (int last = 1; last <= 254; last++) {
                final int current = last;
                pool.execute(() -> {
                    try {
                        if (current == self) return;
                        String host = prefix + current;
                        try (Socket socket = new Socket()) {
                            socket.connect(new InetSocketAddress(host, port), 220);
                            found.add(host);
                        }
                    } catch (Exception ignored) {
                        // Los dispositivos que no aceptan el puerto no son impresoras disponibles.
                    } finally {
                        pending.countDown();
                    }
                });
            }
            pending.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } finally {
            pool.shutdownNow();
        }
        Collections.sort(found, (left, right) -> Integer.compare(
            Integer.parseInt(left.substring(left.lastIndexOf('.') + 1)),
            Integer.parseInt(right.substring(right.lastIndexOf('.') + 1))));
        return found;
    }

    private static byte[] localWifiAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            byte[] fallback = null;
            while (interfaces != null && interfaces.hasMoreElements()) {
                NetworkInterface network = interfaces.nextElement();
                if (!network.isUp() || network.isLoopback()) continue;
                for (InterfaceAddress item : network.getInterfaceAddresses()) {
                    InetAddress address = item.getAddress();
                    if (!(address instanceof Inet4Address) || !address.isSiteLocalAddress()) continue;
                    byte[] bytes = address.getAddress();
                    if (network.getName().startsWith("wlan")) return bytes;
                    if (fallback == null) fallback = bytes;
                }
            }
            return fallback;
        } catch (Exception ignored) {
            return null;
        }
    }
}
