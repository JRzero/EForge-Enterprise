package io.eforge.enterprise.web.controller.api.v1.system;

import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import io.eforge.enterprise.common.config.RuoYiConfig;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.junit.jupiter.api.Assertions.*;

class NoticeImageStoreTest
{
    @TempDir Path directory;
    String previous;
    NoticeImageStore store = new NoticeImageStore();
    @BeforeEach void profile() {previous=RuoYiConfig.getProfile();new RuoYiConfig().setProfile(directory.toString());}
    @AfterEach void restore() {new RuoYiConfig().setProfile(previous);}
    Path path(String url) {return directory.resolve(url.substring("/profile/".length()));}
    MockMultipartFile svg(String content) {return new MockMultipartFile("file","图.svg","image/svg+xml",content.getBytes(StandardCharsets.UTF_8));}

    @ParameterizedTest @ValueSource(strings={"png","jpg"})
    void decodesActualRasterAndNormalizesToPngWithAnOwnedPath(String format) throws Exception
    {
        var output=new ByteArrayOutputStream();var image=new BufferedImage(3,2,BufferedImage.TYPE_INT_RGB);image.setRGB(1,1,0xff1122);
        assertTrue(ImageIO.write(image,format,output));output.write("<script>trailing metadata</script>".getBytes(StandardCharsets.UTF_8));
        var result=store.upload(new MockMultipartFile("file","../../任意."+format,"application/octet-stream",output.toByteArray()));
        assertTrue(result.imageUrl().matches("/profile/upload/notices/[0-9a-f-]{36}\\.png"));
        var decoded=ImageIO.read(path(result.imageUrl()).toFile());assertEquals(3,decoded.getWidth());assertEquals(2,decoded.getHeight());
        assertFalse(new String(Files.readAllBytes(path(result.imageUrl())),StandardCharsets.ISO_8859_1).contains("script"));
    }
    @Test void reconstructsVectorGeometryTextStylesGradientsAndInternalUse() throws Exception
    {
        var result=store.upload(svg("<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 10 10'><defs><linearGradient id='paint'><stop offset='0%' stop-color='#ff0000'/><stop offset='100%' stop-color='blue'/></linearGradient><path id='shape' d='M0 0L10 10'/></defs><use xlink:href='#shape' fill='url(#paint)'/><text x='1' y='2' style='fill: red;font-size: 12;font-family:宋体'>中文</text></svg>"));
        var clean=Files.readString(path(result.imageUrl()));assertTrue(clean.contains("viewBox=\"0 0 10 10\""));assertTrue(clean.contains("linearGradient"));assertTrue(clean.contains("href=\"#shape\""));assertTrue(clean.contains("url(#paint)"));assertTrue(clean.contains("中文"));assertTrue(clean.contains("font-size=\"12\""));
        assertTrue(result.imageUrl().endsWith(".svg"));
    }
    @Test void dropsActiveNamespacesScriptsEventsStylesExternalLinksAndInstructions() throws Exception
    {
        var result=store.upload(svg("<?xml-stylesheet href='https://evil.test/sheet'?><svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)' xmlns:h='http://www.w3.org/1999/xhtml'><script>alert(1)</script><foreignObject><h:img src='x' onerror='alert(1)'/></foreignObject><style>@import url(https://evil.test/css)</style><animate attributeName='href' values='javascript:evil'/><use href='https://evil.test/image'/><path d='M0 0L2 2' fill='url(https://evil.test/paint)' style='stroke:green;position:fixed;fill:url(javascript:evil)'/><h:script>evil</h:script></svg>"));
        var clean=Files.readString(path(result.imageUrl()));assertFalse(clean.matches("(?s).*(?:script|foreignObject|onload|onerror|https:|javascript:|animate|position|style).*"));assertTrue(clean.contains("stroke=\"green\""));assertTrue(clean.contains("d=\"M0 0L2 2\""));
    }
    @ParameterizedTest @ValueSource(strings={
        "<!DOCTYPE svg [<!ENTITY e SYSTEM 'file:///local-secret'>]><svg xmlns='http://www.w3.org/2000/svg'>&e;</svg>",
        "<!DOCTYPE svg SYSTEM 'https://evil.test/dtd'><svg xmlns='http://www.w3.org/2000/svg'/>",
        "<html><script>evil</script></html>", "<svg xmlns='https://evil.test/svg'/>", "<svg>",
        "<svg xmlns='http://www.w3.org/2000/svg'><g id='loop'><use href='#loop'/></g></svg>",
        "<svg xmlns='http://www.w3.org/2000/svg'><g id='same'/><g id='same'/></svg>"})
    void rejectsEntityDocumentsInvalidRootsAndCyclicOrAmbiguousReferences(String content)
    {var error=assertThrows(ApiFailure.class,()->store.upload(svg(content)));assertEquals(400,error.status());assertEquals("NOTICE_IMAGE_INVALID",error.code());assertFalse(Files.exists(directory.resolve("upload/notices")));}
    @Test void rejectsFakeContentEmptyExactLimitAndExcessiveDecodedDimensions() throws Exception
    {
        for(var file:new MockMultipartFile[]{new MockMultipartFile("file","fake.png","image/png","<svg/>".getBytes()),new MockMultipartFile("file","empty.png","image/png",new byte[0]),new MockMultipartFile("file","large.png","image/png",new byte[5*1024*1024]),new MockMultipartFile("file","image.html","image/png",new byte[]{1})})
            assertEquals("NOTICE_IMAGE_INVALID",assertThrows(ApiFailure.class,()->store.upload(file)).code());
        var output=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(4097,1,BufferedImage.TYPE_INT_RGB),"png",output);
        assertEquals("NOTICE_IMAGE_INVALID",assertThrows(ApiFailure.class,()->store.upload(new MockMultipartFile("file","wide.png","image/png",output.toByteArray()))).code());
    }
    @Test void storageFailureIs503AndNeverReturnsAPath() throws Exception
    {
        Files.writeString(directory.resolve("upload"),"occupied");
        assertEquals("NOTICE_IMAGE_STORAGE_UNAVAILABLE",assertThrows(ApiFailure.class,()->store.upload(svg("<svg xmlns='http://www.w3.org/2000/svg'><rect width='3' height='2'/></svg>"))).code());
    }
    @Test void rejectsDepthNodeAndReferenceExpansionBudgetsBeforeStorage()
    {
        for (String content: new String[]{"<svg xmlns='http://www.w3.org/2000/svg'>"+"<g>".repeat(65)+"</g>".repeat(65)+"</svg>",
                "<svg xmlns='http://www.w3.org/2000/svg'>"+"<path/>".repeat(10_001)+"</svg>",
                "<svg xmlns='http://www.w3.org/2000/svg'><defs><g id='many'>"+"<path/>".repeat(100)+"</g></defs>"+"<use href='#many'/>".repeat(100)+"</svg>",
                "<svg xmlns='http://www.w3.org/2000/svg'><path class='"+"x".repeat(4097)+"'/></svg>",
                "<svg xmlns='http://www.w3.org/2000/svg'><style>path {fill:"+"x".repeat(4097)+"}</style><path/></svg>"})
            assertEquals("NOTICE_IMAGE_INVALID",assertThrows(ApiFailure.class,()->store.upload(svg(content))).code());
        assertFalse(Files.exists(directory.resolve("upload/notices")));
    }
    @Test void compilesSafeClassIdAndTagStylesIntoInertPresentationAttributes() throws Exception
    {
        var result=store.upload(svg("<svg xmlns='http://www.w3.org/2000/svg'><style>path {fill:blue} .shape {fill:red;stroke:green;stroke-width:2;position:fixed;background:url(https://evil.test)} #specific {fill:#fff}</style><path class='shape' d='M0 0L5 5'/><path id='specific' class='shape' d='M0 0L4 4'/><path class='shape' d='M0 0L3 3' style='fill:yellow;font-family:宋体'/></svg>"));
        var clean=Files.readString(path(result.imageUrl()));assertTrue(clean.contains("fill=\"red\""));assertTrue(clean.contains("fill=\"#fff\""));assertTrue(clean.contains("fill=\"yellow\""));assertTrue(clean.contains("stroke=\"green\""));assertTrue(clean.contains("font-family=\"宋体\""));assertFalse(clean.contains("style"));assertFalse(clean.contains("class="));assertFalse(clean.contains("position"));assertFalse(clean.contains("evil.test"));
    }
    @Test void malformedStylesHaveBoundedParsingWork()
    {
        assertTimeoutPreemptively(java.time.Duration.ofSeconds(3), () -> {
            for (String text : new String[]{"x".repeat(400_000), "/*".repeat(200_000)}) {
                var result = store.upload(svg("<svg xmlns='http://www.w3.org/2000/svg'><style>" + text + "</style><rect width='2' height='2'/></svg>"));
                var clean = Files.readString(path(result.imageUrl()));
                assertTrue(clean.contains("rect")); assertFalse(clean.contains("style"));
            }
            assertEquals("NOTICE_IMAGE_INVALID", assertThrows(ApiFailure.class, () -> store.upload(svg("<svg xmlns='http://www.w3.org/2000/svg'><style>" + "x".repeat(1_048_577) + "</style></svg>"))).code());
        });
    }
}
