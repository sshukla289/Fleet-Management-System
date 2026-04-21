package com.fleet.modules.fuel.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FuelReceiptStorageService {

    private static final Pattern DATA_URL_PATTERN = Pattern.compile("^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$");
    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of("image/png", "image/jpeg", "image/webp");
    private static final long MAX_RECEIPT_BYTES = 5L * 1024 * 1024;

    private final Path receiptsDirectory;

    public FuelReceiptStorageService(@Value("${app.storage.public-root-dir:uploads}") String publicRootDir) {
        this.receiptsDirectory = Path.of(publicRootDir).toAbsolutePath().normalize().resolve("fuel");
    }

    public String store(MultipartFile receipt) {
        if (receipt == null || receipt.isEmpty()) {
            return null;
        }

        String contentType = normalizedContentType(receipt.getContentType());
        if (!SUPPORTED_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel receipt must be a PNG, JPEG, or WebP image.");
        }
        if (receipt.getSize() > MAX_RECEIPT_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel receipt exceeds the 5 MB limit.");
        }

        try {
            return write(receipt.getBytes(), contentType);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store the fuel receipt.");
        }
    }

    public String storeDataUrl(String receiptDataUrl) {
        if (receiptDataUrl == null || receiptDataUrl.isBlank()) {
            return null;
        }

        Matcher matcher = DATA_URL_PATTERN.matcher(receiptDataUrl.trim());
        if (!matcher.matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel receipt payload is not a valid image.");
        }

        String contentType = normalizedContentType(matcher.group(1));
        if (!SUPPORTED_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel receipt must be a PNG, JPEG, or WebP image.");
        }

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(matcher.group(2));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel receipt could not be decoded.");
        }

        if (bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel receipt is empty.");
        }
        if (bytes.length > MAX_RECEIPT_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel receipt exceeds the 5 MB limit.");
        }

        return write(bytes, contentType);
    }

    public String checksum(String receiptDataUrl) {
        if (receiptDataUrl == null || receiptDataUrl.isBlank()) {
            return null;
        }

        Matcher matcher = DATA_URL_PATTERN.matcher(receiptDataUrl.trim());
        if (!matcher.matches()) {
            return null;
        }

        try {
            return sha256(Base64.getDecoder().decode(matcher.group(2)));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private String write(byte[] bytes, String contentType) {
        String filename = "fuel-receipt-" + UUID.randomUUID() + "." + extensionFor(contentType);
        Path target = receiptsDirectory.resolve(filename).normalize();

        try {
            Files.createDirectories(receiptsDirectory);
            Files.write(target, bytes);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store the fuel receipt.");
        }

        return "/uploads/fuel/" + filename;
    }

    private String normalizedContentType(String contentType) {
        return contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
    }

    private String extensionFor(String contentType) {
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(messageDigest.digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 digest is unavailable.", exception);
        }
    }
}
