<template>
  <div class="chat-window">
    <div class="messages">
      <ChatMessage v-for="(msg, index) in messages" :key="index" :msg="msg" />
    </div>
    <ChatInput @sendMessage="handleSendMessage" />
  </div>
</template>

<script setup>
import { ref } from "vue";
import ChatMessage from "./ChatMessage.vue";
import ChatInput from "./ChatInput.vue";

const messages = ref([
  { text: "我是 DeepSeek，很高兴见到你！", sender: "bot" }
]);

const handleSendMessage = (text) => {
  messages.value.push({ text, sender: "user" });
  // 模拟 AI 回复
  setTimeout(() => {
    messages.value.push({ text: "AI 回复：" + text, sender: "bot" });
  }, 1000);
};
</script>

<style>
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}
</style>