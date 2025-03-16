package com.deepseek.deepseek_chat.util;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.nio.charset.StandardCharsets;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import java.io.IOException;

public class ResponseFormatterUtil {

    /**
     * 格式化 AI 响应文本：让句号后面换行，增强可读性
     *
     * @param answer 原始 AI 响应文本
     * @return 格式化后的文本
     */
    public static String formatAnswer(String answer) {
        return answer.replace(". ", ".\n\n");
    }

    /**
     * 生成 UTF-8 编码的 HTTP 响应头，避免乱码
     *
     * @return HttpHeaders 对象
     */
    public static HttpHeaders createUtf8Headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(new MediaType("text", "plain", StandardCharsets.UTF_8));
        return headers;
    }

    /**
     * 以流式方式逐步发送格式化文本
     *
     * @param emitter ResponseBodyEmitter 负责流式传输
     * @param answer  AI 生成的原始响应
     */
    public static void sendFormattedStream(ResponseBodyEmitter emitter, String answer) {
        new Thread(() -> {
            try {
                // 先格式化内容
                String formattedAnswer = formatAnswer(answer);

                // 按句子发送，确保中文正确显示
                String[] sentences = formattedAnswer.split("(?<=[。！？])");
                for (String sentence : sentences) {
                    if (!sentence.trim().isEmpty()) {
                        emitter.send(sentence + "\n", MediaType.TEXT_PLAIN);
                        Thread.sleep(100); // 调整发送速度
                    }
                }

                emitter.complete();
            } catch (IOException | InterruptedException e) {
                emitter.completeWithError(e);
            }
        }).start();
    }

}