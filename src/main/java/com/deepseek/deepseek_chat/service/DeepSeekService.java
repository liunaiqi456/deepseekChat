package com.deepseek.deepseek_chat.service;

import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationParam;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.Arrays;

@Service
public interface DeepSeekService {

    String processQuestion(String question);

    void processQuestionStream(String question, SseEmitter emitter);

    default String askDeepSeek(String question) {
        try {
            // 创建 DashScope Generation 对象
            Generation gen = new Generation();

            // 构造用户输入
            Message userMsg = Message.builder()
                    .role(Role.USER.getValue())
                    .content(question)
                    .build();
            // 配置请求参数
            GenerationParam param = GenerationParam.builder()
                    .apiKey(System.getenv("DASHSCOPE_API_KEY")) // 确保环境变量已配置
                    .model("deepseek-v3")  // 选择 DeepSeek 模型
                    .messages(Arrays.asList(userMsg))
                    .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                    .build();

            // 发送 API 请求
            GenerationResult result = gen.call(param);

            // 获取 AI 回复
            return result.getOutput().getChoices().get(0).getMessage().getContent();

        } catch (ApiException | NoApiKeyException | InputRequiredException e) {
            return "调用 DeepSeek 失败: " + e.getMessage();
        }
    }
}