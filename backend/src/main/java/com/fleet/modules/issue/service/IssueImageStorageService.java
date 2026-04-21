package com.fleet.modules.issue.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class IssueImageStorageService {

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    private final Path issuesDirectory;

    public IssueImageStorageService(@Value("${app.storage.public-root-dir:uploads}") String publicRootDir) {
        this.issuesDirectory = Path.of(publicRootDir).toAbsolutePath().normalize().resolve("issues");
    }

    public String store(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return null;
        }

        String contentType = image.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only image uploads are supported.");
        }

        String extension = resolveExtension(image.getOriginalFilename(), contentType);
        String filename = "issue-" + UUID.randomUUID() + "." + extension;
        Path target = issuesDirectory.resolve(filename).normalize();

        try {
            Files.createDirectories(issuesDirectory);
            Files.copy(image.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store the uploaded image.");
        }

        return "/uploads/issues/" + filename;
    }

    private String resolveExtension(String originalFilename, String contentType) {
        if (originalFilename != null) {
            int extensionIndex = originalFilename.lastIndexOf('.');
            if (extensionIndex >= 0 && extensionIndex < originalFilename.length() - 1) {
                String extension = originalFilename.substring(extensionIndex + 1).toLowerCase(Locale.ROOT);
                if (SUPPORTED_EXTENSIONS.contains(extension)) {
                    return extension;
                }
            }
        }

        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            default -> "jpg";
        };
    }
}
