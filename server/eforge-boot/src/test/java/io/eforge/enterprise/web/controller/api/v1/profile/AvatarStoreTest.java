package io.eforge.enterprise.web.controller.api.v1.profile;

import java.io.*;
import java.nio.file.*;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import io.eforge.enterprise.common.config.RuoYiConfig;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.junit.jupiter.api.Assertions.*;

class AvatarStoreTest
{
    @TempDir Path directory;
    AvatarStore store = new AvatarStore(); String previous;
    @BeforeEach void configure() { previous = RuoYiConfig.getProfile(); new RuoYiConfig().setProfile(directory.toString()); }
    @AfterEach void restore() { new RuoYiConfig().setProfile(previous); }
    private byte[] image(String format, int width, int height) throws IOException
    { var output = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB), format, output); return output.toByteArray(); }
    @Test void actualRasterFormatsNormalizeToOwnedPngAndCanBeDeleted() throws Exception
    {
        for (String format : new String[]{"png", "jpg", "gif", "bmp"})
        {
            var decoded = store.decode(new MockMultipartFile("file", "../../client."+format, "application/octet-stream", image(format,3,2)));
            String url = store.save(decoded); assertTrue(url.matches("/profile/avatar/canonical/[0-9a-f-]+\\.png"));
            Path file = directory.resolve(url.substring("/profile/".length()));
            assertEquals(3, ImageIO.read(file.toFile()).getWidth()); store.delete(url); assertFalse(Files.exists(file));
        }
    }
    @Test void rejectsEmptyFakeSvgAndOversizedImageBeforeFullDecode() throws Exception
    {
        for (var file : new MockMultipartFile[]{new MockMultipartFile("file","empty.png","image/png",new byte[0]),
                new MockMultipartFile("file","fake.png","image/png","<script>private</script>".getBytes()),
                new MockMultipartFile("file","image.svg","image/svg+xml",image("png",2,2)),
                new MockMultipartFile("file","large.png","image/png",image("png",4097,1)),
                new MockMultipartFile("file","huge.png","image/png",new byte[10*1024*1024+1])})
            assertEquals("AVATAR_INVALID", assertThrows(ApiFailure.class, () -> store.decode(file)).code());
    }
    @Test void deletionNeverFollowsDatabasePathsOutsideOwnedNamespace() throws Exception
    {
        Path retained = directory.resolve("keep.png"); Files.writeString(retained,"retained");
        for (String url : new String[]{"/profile/avatar/canonical/../../keep.png", "/profile/keep.png", "https://invalid/keep.png", "/profile/avatar/canonical/not-a-uuid.png"}) store.delete(url);
        assertTrue(Files.exists(retained));
    }
}
