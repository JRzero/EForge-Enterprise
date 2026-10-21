package io.eforge.enterprise.workflow.purchase;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import javax.imageio.ImageIO;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Bounded format checks, not a malware scanner. All downloads must be attachments with nosniff. */
final class PurchaseAttachmentContent {
    private PurchaseAttachmentContent() { }
    static byte[] validate(String name,byte[] input){
        if(name==null||name.isBlank()||name.length()>120||name.chars().anyMatch(c->c<32||c==127||"/\\:".indexOf(c)>=0)
            ||input==null||input.length==0||input.length>5*1024*1024)throw invalid();
        byte[] bytes=input.clone();String lower=name.toLowerCase(Locale.ROOT);
        if(lower.endsWith(".pdf")){
            String header=new String(bytes,0,Math.min(8,bytes.length),StandardCharsets.ISO_8859_1);
            String tail=new String(bytes,Math.max(0,bytes.length-1024),Math.min(bytes.length,1024),StandardCharsets.ISO_8859_1);
            if(!header.startsWith("%PDF-")||!tail.contains("%%EOF"))throw invalid();
            return bytes;
        }
        if(!lower.endsWith(".png")&&!lower.endsWith(".jpg")&&!lower.endsWith(".jpeg"))throw invalid();
        try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
            var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw invalid();
            var reader=readers.next();
            try{
                reader.setInput(stream);String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                if(lower.endsWith(".png")?!format.equals("png"):!format.equals("jpeg"))throw invalid();
                long width=reader.getWidth(0),height=reader.getHeight(0);
                if(width<1||height<1||width*height>16000000L)throw invalid();
                if(reader.read(0)==null)throw invalid();
            }finally{reader.dispose();}
            return bytes;
        }catch(ApiFailure failure){throw failure;}catch(Exception failure){throw invalid();}
    }
    private static ApiFailure invalid(){return new ApiFailure(400,"PURCHASE_ATTACHMENT_INVALID","附件须为有效的PDF、PNG或JPEG，单个不超过5MB。");}
}
