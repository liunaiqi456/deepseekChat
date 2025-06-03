package com.deepseek.deepseek_chat.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.aliyuncs.CommonRequest;
import com.aliyuncs.CommonResponse;
import com.aliyuncs.DefaultAcsClient;
import com.aliyuncs.IAcsClient;
import com.aliyuncs.exceptions.ClientException;
import com.aliyuncs.exceptions.ServerException;
import com.aliyuncs.http.MethodType;
import com.aliyuncs.profile.DefaultProfile;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 语音对话服务
 * 使用阿里云智能语音对话服务处理语音对话
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoiceChatService {

    @Value("${aliyun.access-key-id:${ALIYUN_ACCESS_KEY_ID:${ALIYUN_AK_ID:}}}")
    private String accessKeyId;
    
    @Value("${aliyun.access-key-secret:${ALIYUN_ACCESS_KEY_SECRET:${ALIYUN_AK_SECRET:}}}")
    private String accessKeySecret;
    
    @Value("${aliyun.nls.appkey:${NLS_APP_KEY:}}")
    private String appKey;
    
    private final VoiceSynthesisService voiceSynthesisService;
    private final ObjectMapper objectMapper;
    
    // 存储每个会话的对话ID
    private final Map<String, String> sessionDialogueIds = new ConcurrentHashMap<>();
    
    /**
     * 创建阿里云API客户端
     * @return 阿里云API客户端实例
     */
    private IAcsClient createClient() {
        DefaultProfile profile = DefaultProfile.getProfile(
                "cn-shanghai",  // 区域代码
                accessKeyId,     // AccessKey ID
                accessKeySecret  // AccessKey Secret
        );
        return new DefaultAcsClient(profile);
    }
    
    /**
     * 处理用户输入并生成回复
     * @param userInput 用户输入文本
     * @param sessionId 会话ID
     * @return 系统回复文本
     */
    public String chat(String userInput, String sessionId) {
        log.info("收到用户输入: {}, 会话ID: {}", userInput, sessionId);
        
        try {
            // 创建客户端
            IAcsClient client = createClient();
            
            // 获取对话ID（如果存在）
            String dialogueId = sessionDialogueIds.get(sessionId);
            
            // 构建通用请求
            CommonRequest request = new CommonRequest();
            request.setSysMethod(MethodType.POST);
            request.setSysDomain("nls-meta.cn-shanghai.aliyuncs.com"); // 智能语音交互服务域名
            request.setSysVersion("2019-02-28");
            request.setSysAction("ChatBot"); // API名称
            
            // 设置请求参数
            request.putQueryParameter("AppKey", appKey);
            request.putQueryParameter("Text", userInput);
            
            // 如果存在对话ID，则添加到请求中以保持对话上下文
            if (dialogueId != null && !dialogueId.isEmpty()) {
                request.putQueryParameter("SessionId", dialogueId);
            }
            
            // 调用智能语音对话 API
            CommonResponse response = client.getCommonResponse(request);
            String responseData = response.getData();
            log.info("原始响应数据: {}", responseData);
            
            // 解析响应JSON
            JSONObject jsonObject = JSON.parseObject(responseData);
            
            // 保存对话ID用于后续对话
            if (jsonObject.containsKey("SessionId")) {
                String newSessionId = jsonObject.getString("SessionId");
                sessionDialogueIds.put(sessionId, newSessionId);
            }
            
            // 获取回复文本
            String responseText = "";
            if (jsonObject.containsKey("Message")) {
                responseText = jsonObject.getString("Message");
            }
            log.info("生成的回复: {}", responseText);
            
            return responseText;
        } catch (ServerException e) {
            log.error("服务器错误: {}", e.getErrMsg());
            return "对不起，服务器出现了问题，请稍后再试。";
        } catch (ClientException e) {
            log.error("客户端错误: {}", e.getErrMsg());
            return "对不起，连接服务器时出现了问题，请检查网络设置。";
        } catch (Exception e) {
            log.error("调用智能语音对话 API时发生错误", e);
            return "对不起，处理您的请求时出现了问题，请稍后再试。";
        }
    }
    
    /**
     * 处理用户输入并生成语音回复
     * @param userInput 用户输入文本
     * @param session WebSocket会话
     * @throws IOException 如果发送WebSocket消息时出错
     */
    public void processAndRespond(String userInput, WebSocketSession session) throws IOException {
        log.info("处理用户输入: {}", userInput);
        
        // 使用会话ID作为对话ID
        String sessionId = session.getId();
        
        try {
            // 发送文本消息到前端，表示开始处理
            Map<String, Object> processingMessage = new HashMap<>();
            processingMessage.put("type", "processing");
            processingMessage.put("text", userInput);
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(processingMessage)));
            
            // 调用智能对话服务获取回复
            String responseText = chat(userInput, sessionId);
            
            // 发送文本回复到前端
            Map<String, Object> textResponse = new HashMap<>();
            textResponse.put("type", "text_response");
            textResponse.put("text", responseText);
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(textResponse)));
            
            // 调用语音合成服务并发送语音数据
            voiceSynthesisService.synthesizeAndSend(responseText, session);
            
            // 发送完成消息
            Map<String, Object> completeMessage = new HashMap<>();
            completeMessage.put("type", "complete");
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(completeMessage)));
            
        } catch (Exception e) {
            log.error("处理用户输入时出错", e);
            
            // 发送错误消息到前端
            Map<String, Object> errorMessage = new HashMap<>();
            errorMessage.put("type", "error");
            errorMessage.put("message", "处理您的请求时出现错误，请重试");
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorMessage)));
        }
    }
    
    /**
     * 清除会话历史
     * @param sessionId 会话ID
     */
    public void clearHistory(String sessionId) {
        sessionDialogueIds.remove(sessionId);
        log.info("已清除会话历史: {}", sessionId);
    }
}
