package com.deepseek.deepseek_chat.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.deepseek.deepseek_chat.service.VoiceSynthesisService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 语音合成控制器
 */
@Slf4j
@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceSynthesisController {

    private final VoiceSynthesisService voiceSynthesisService;

    /**
     * 文本转语音接口
     * @param text 要转换的文本
     * @return 语音数据
     */
    @PostMapping("/synthesize")
    public ResponseEntity<byte[]> synthesizeToSpeech(@RequestBody String text) {
        try {
            log.info("收到语音合成请求，文本内容：{}", text);
            byte[] audioData = voiceSynthesisService.synthesizeToSpeech(text);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("audio/wav"));
            headers.setContentLength(audioData.length);
            
            return new ResponseEntity<>(audioData, headers, HttpStatus.OK);
        } catch (Exception e) {
            log.error("语音合成失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
