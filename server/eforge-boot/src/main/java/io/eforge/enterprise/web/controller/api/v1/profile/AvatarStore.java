package io.eforge.enterprise.web.controller.api.v1.profile;

import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import io.eforge.enterprise.common.config.RuoYiConfig;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Bounded decoded raster images, normalized to PNG under an owned avatar path. */
@Component
public class AvatarStore
{
    private static final String PREFIX = "/profile/avatar/canonical/";
    public BufferedImage decode(MultipartFile file)
    {
        String filename = Objects.toString(file.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        if (file.isEmpty() || file.getSize() > 10 * 1024 * 1024 ||
                !filename.matches(".*\\.(png|jpe?g|gif|bmp)$")) throw invalid();
        try (var stream = file.getInputStream(); var input = ImageIO.createImageInputStream(stream))
        {
            if (input == null) throw invalid();
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try
            {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 16_000_000) throw invalid();
                BufferedImage image = reader.read(0);
                if (image == null) throw invalid();
                return image;
            }
            finally { reader.dispose(); }
        }
        catch (ApiFailure exception) { throw exception; }
        catch (IOException | RuntimeException exception) { throw invalid(); }
    }
    public String save(BufferedImage image)
    {
        String filename = UUID.randomUUID() + ".png";
        Path target = directory().resolve(filename);
        try
        {
            Files.createDirectories(target.getParent());
            try (var output = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW))
            { if (!ImageIO.write(image, "png", output)) throw new IOException(); }
            return PREFIX + filename;
        }
        catch (IOException exception)
        {
            delete(PREFIX + filename);
            throw new ApiFailure(503, "AVATAR_STORAGE_UNAVAILABLE", "The avatar could not be stored.");
        }
    }
    public void delete(String url)
    {
        // Never resolve a legacy/database-provided path or delete outside this namespace.
        if (url == null || !url.matches("/profile/avatar/canonical/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.png")) return;
        try { Files.deleteIfExists(directory().resolve(url.substring(PREFIX.length()))); }
        catch (IOException exception) { /* A cleanup failure must not undo a committed profile update. */ }
    }
    private Path directory() { return Path.of(RuoYiConfig.getAvatarPath()).toAbsolutePath().normalize().resolve("canonical"); }
    private static ApiFailure invalid() { return new ApiFailure(400, "AVATAR_INVALID", "Upload a valid raster image of at most 10 MB and 4096 pixels per side."); }
}
